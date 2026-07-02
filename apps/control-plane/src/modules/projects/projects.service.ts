import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import os from 'node:os';
import { DRIZZLE, Database } from '../../db/database.module';
import { managedDatabases, nodes, projects, services } from '../../db/schema';
import { AgentClient } from '../nodes/agent.client';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly agent: AgentClient,
  ) {}

  async list(ownerId: string) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.createdAt));
    return this.attachServices(rows);
  }

  async create(
    ownerId: string,
    name: string,
    limits?: { cpuLimit?: number; memLimit?: number },
  ) {
    const available = await this.availablePlatformCapacity();
    const cpuLimit = limits?.cpuLimit ?? available.cpu;
    const memLimit = limits?.memLimit ?? available.memMb;
    await this.ensurePlatformCapacity(cpuLimit, memLimit);
    return this.db
      .insert(projects)
      .values({
        name,
        ownerId,
        cpuLimit,
        memLimit,
      })
      .returning()
      .then((r) => r[0]);
  }

  async get(id: string, ownerId: string) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Project not found');
    const [withServices] = await this.attachServices(rows);
    return withServices;
  }

  async remove(id: string, ownerId: string) {
    await this.get(id, ownerId);
    // Free node resources (containers, images, DB volumes) before dropping the
    // rows. Best-effort per workload so an unreachable node can't block delete.
    await this.freeProjectResources(id);
    await this.db.delete(projects).where(eq(projects.id, id));
    return { ok: true };
  }

  /**
   * Removes every container/image of the project's services and every managed
   * database container + volume from their nodes. Best-effort: failures are
   * swallowed so the DB cascade still runs.
   */
  private async freeProjectResources(projectId: string) {
    const [svcRows, dbRows] = await Promise.all([
      this.db.select().from(services).where(eq(services.projectId, projectId)),
      this.db
        .select()
        .from(managedDatabases)
        .where(eq(managedDatabases.projectId, projectId)),
    ]);

    const nodeIds = Array.from(
      new Set([
        ...svcRows.map((s) => s.nodeId),
        ...dbRows.map((d) => d.nodeId),
      ]),
    );
    if (nodeIds.length === 0) return;
    const nodeRows = await this.db
      .select()
      .from(nodes)
      .where(inArray(nodes.id, nodeIds));
    const nodeById = new Map(nodeRows.map((n) => [n.id, n]));

    for (const svc of svcRows) {
      const node = nodeById.get(svc.nodeId);
      if (!node) continue;
      try {
        await this.agent.remove(node, svc.id);
        await this.agent.gc(node, svc.id, '');
      } catch {
        // Node unreachable — skip; row is removed by the cascade regardless.
      }
    }

    for (const db of dbRows) {
      const node = nodeById.get(db.nodeId);
      if (!node) continue;
      try {
        // Deleting the project destroys its data, so drop the volume too.
        await this.agent.removeDatabase(
          node,
          db.containerName,
          db.volumeName,
          false,
        );
      } catch {
        // Node unreachable — skip.
      }
    }
  }

  async updateLimits(
    id: string,
    ownerId: string,
    limits: { cpuLimit: number; memLimit: number },
  ) {
    await this.get(id, ownerId);
    const svc = await this.db
      .select()
      .from(services)
      .where(eq(services.projectId, id));
    const allocatedCpu = svc.reduce((sum, s) => sum + s.cpuLimit, 0);
    const allocatedMemMb = svc.reduce((sum, s) => sum + s.memLimit, 0);
    if (limits.cpuLimit < allocatedCpu || limits.memLimit < allocatedMemMb) {
      throw new BadRequestException(
        'Project limit cannot be lower than resources already allocated to services.',
      );
    }
    await this.ensurePlatformCapacity(limits.cpuLimit, limits.memLimit, id);
    const rows = await this.db
      .update(projects)
      .set({
        cpuLimit: limits.cpuLimit,
        memLimit: limits.memLimit,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .returning();
    return rows[0];
  }

  async platformResourceSummary(ownerId: string) {
    const [projectRows, nodeRows] = await Promise.all([
      this.db.select().from(projects).where(eq(projects.ownerId, ownerId)),
      this.db.select().from(nodes),
    ]);
    const servicesRows = projectRows.length
      ? await this.db
          .select()
          .from(services)
          .where(inArray(services.projectId, projectRows.map((p) => p.id)))
      : [];
    const host = this.hostCapacity();
    const configuredCpu = nodeRows.reduce((sum, n) => sum + (n.cpuTotal ?? 0), 0);
    const configuredMemMb = nodeRows.reduce((sum, n) => sum + (n.memTotal ?? 0), 0);
    const capacityCpu = configuredCpu > 0 ? configuredCpu : host.cpu;
    const capacityMemMb = configuredMemMb > 0 ? configuredMemMb : host.memMb;
    const projectCpuLimit = projectRows.reduce((sum, p) => sum + p.cpuLimit, 0);
    const projectMemLimit = projectRows.reduce((sum, p) => sum + p.memLimit, 0);
    const serviceCpuAllocated = servicesRows.reduce((sum, s) => sum + s.cpuLimit, 0);
    const serviceMemAllocated = servicesRows.reduce((sum, s) => sum + s.memLimit, 0);

    // Best-effort live consumption aggregated across reachable nodes.
    let currentCpuPerc = 0;
    let currentMemMb = 0;
    await Promise.all(
      nodeRows.map(async (node) => {
        try {
          const s = await this.agent.getNodeStats(node);
          currentCpuPerc += s.cpuPerc ?? 0;
          currentMemMb += s.memUsageMb ?? 0;
        } catch {
          /* node unreachable — skip */
        }
      }),
    );

    return {
      nodes: nodeRows.length,
      projects: projectRows.length,
      services: servicesRows.length,
      hostCpuCores: host.cpuCores,
      hostMemMb: host.memMb,
      capacityCpu,
      capacityMemMb,
      projectCpuLimit,
      projectMemLimit,
      serviceCpuAllocated,
      serviceMemAllocated,
      availableProjectCpu: Math.max(0, capacityCpu - projectCpuLimit),
      availableProjectMemMb: Math.max(0, capacityMemMb - projectMemLimit),
      currentCpuPerc: Number(currentCpuPerc.toFixed(2)),
      currentMemMb: Number(currentMemMb.toFixed(1)),
    };
  }

  private async ensurePlatformCapacity(
    cpuLimit: number,
    memLimit: number,
    excludeProjectId?: string,
  ) {
    const [projectRows, nodeRows] = await Promise.all([
      this.db.select().from(projects),
      this.db.select().from(nodes),
    ]);
    const host = this.hostCapacity();
    const configuredCpu = nodeRows.reduce((sum, n) => sum + (n.cpuTotal ?? 0), 0);
    const configuredMemMb = nodeRows.reduce((sum, n) => sum + (n.memTotal ?? 0), 0);
    const capacityCpu = configuredCpu > 0 ? configuredCpu : host.cpu;
    const capacityMemMb = configuredMemMb > 0 ? configuredMemMb : host.memMb;
    const reservedCpu = projectRows
      .filter((p) => p.id !== excludeProjectId)
      .reduce((sum, p) => sum + p.cpuLimit, 0);
    const reservedMemMb = projectRows
      .filter((p) => p.id !== excludeProjectId)
      .reduce((sum, p) => sum + p.memLimit, 0);
    if (capacityCpu > 0 && reservedCpu + cpuLimit > capacityCpu) {
      throw new BadRequestException('Project CPU limit exceeds platform capacity.');
    }
    if (capacityMemMb > 0 && reservedMemMb + memLimit > capacityMemMb) {
      throw new BadRequestException('Project memory limit exceeds platform capacity.');
    }
  }

  private async availablePlatformCapacity() {
    const [projectRows, nodeRows] = await Promise.all([
      this.db.select().from(projects),
      this.db.select().from(nodes),
    ]);
    const host = this.hostCapacity();
    const configuredCpu = nodeRows.reduce((sum, n) => sum + (n.cpuTotal ?? 0), 0);
    const configuredMemMb = nodeRows.reduce((sum, n) => sum + (n.memTotal ?? 0), 0);
    const capacityCpu = configuredCpu > 0 ? configuredCpu : host.cpu;
    const capacityMemMb = configuredMemMb > 0 ? configuredMemMb : host.memMb;
    const reservedCpu = projectRows.reduce((sum, p) => sum + p.cpuLimit, 0);
    const reservedMemMb = projectRows.reduce((sum, p) => sum + p.memLimit, 0);
    return {
      cpu: Math.max(0, capacityCpu - reservedCpu),
      memMb: Math.max(0, capacityMemMb - reservedMemMb),
    };
  }

  private hostCapacity() {
    return {
      cpuCores: os.cpus().length,
      cpu: os.cpus().length * 100,
      memMb: Math.floor(os.totalmem() / 1024 / 1024),
    };
  }

  private async attachServices(
    rows: (typeof projects.$inferSelect)[],
  ) {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const svc = await this.db
      .select()
      .from(services)
      .where(inArray(services.projectId, ids));
    return rows.map((p) => ({
      ...p,
      services: svc.filter((s) => s.projectId === p.id),
    }));
  }
}
