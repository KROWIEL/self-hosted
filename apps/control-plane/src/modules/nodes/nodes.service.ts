import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { DRIZZLE, Database } from '../../db/database.module';
import { managedDatabases, nodes, projects, services } from '../../db/schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AgentClient } from './agent.client';

interface CreateNodeInput {
  name: string;
  fqdn: string;
  agentPort?: number;
  cpuTotal?: number;
  memTotal?: number;
}

@Injectable()
export class NodesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly agent: AgentClient,
  ) {}

  list() {
    return this.db.select().from(nodes).orderBy(nodes.createdAt);
  }

  async create(input: CreateNodeInput) {
    const daemonToken = randomBytes(32).toString('hex');
    const hostCpu = os.cpus().length * 100;
    const hostMemMb = Math.floor(os.totalmem() / 1024 / 1024);
    const rows = await this.db
      .insert(nodes)
      .values({
        name: input.name,
        fqdn: input.fqdn,
        agentPort: input.agentPort ?? 8443,
        cpuTotal: input.cpuTotal ?? hostCpu,
        memTotal: input.memTotal ?? hostMemMb,
        daemonToken: this.crypto.encrypt(daemonToken),
      })
      .returning();
    // Return the plaintext token ONCE so the operator can configure the agent.
    return { ...rows[0], daemonTokenPlaintext: daemonToken };
  }

  async get(id: string) {
    const rows = await this.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Node not found');
    return rows[0];
  }

  async configuration(id: string) {
    const node = await this.get(id);
    return {
      nodeId: node.id,
      agentPort: node.agentPort,
      panelPublicKey: node.publicKey,
    };
  }

  async remove(id: string) {
    await this.get(id);
    await this.db.delete(nodes).where(eq(nodes.id, id));
    return { ok: true };
  }

  async updateCapacity(
    id: string,
    input: { cpuTotal: number; memTotal: number },
  ) {
    await this.get(id);
    const rows = await this.db
      .update(nodes)
      .set({
        cpuTotal: input.cpuTotal,
        memTotal: input.memTotal,
        updatedAt: new Date(),
      })
      .where(eq(nodes.id, id))
      .returning();
    return rows[0];
  }

  /** Live Docker-level metrics from the node's agent (reachable only if up). */
  async systemInfo(id: string) {
    const node = await this.get(id);
    try {
      return await this.agent.getSystem(node);
    } catch (e) {
      return {
        version: 'unreachable',
        reachable: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /** Aggregate live CPU/RAM usage across all containers on the node. */
  async stats(id: string) {
    const node = await this.get(id);
    try {
      return await this.agent.getNodeStats(node);
    } catch {
      return { reachable: false, cpuPerc: 0, memUsageMb: 0, containers: 0 };
    }
  }

  /** Reclaims disk on the node via docker prune (manual cleanup button). */
  async prune(id: string, opts: { all?: boolean; volumes?: boolean }) {
    const node = await this.get(id);
    return this.agent.prune(node, opts);
  }

  /** Services and managed databases hosted on this node (for the node card). */
  async workloads(id: string) {
    await this.get(id);
    const svc = await this.db
      .select({
        id: services.id,
        name: services.name,
        type: services.type,
        status: services.status,
        projectId: services.projectId,
        projectName: projects.name,
      })
      .from(services)
      .leftJoin(projects, eq(services.projectId, projects.id))
      .where(eq(services.nodeId, id))
      .orderBy(services.name);
    const dbs = await this.db
      .select({
        id: managedDatabases.id,
        name: managedDatabases.name,
        engine: managedDatabases.engine,
        status: managedDatabases.status,
        projectId: managedDatabases.projectId,
        projectName: projects.name,
      })
      .from(managedDatabases)
      .leftJoin(projects, eq(managedDatabases.projectId, projects.id))
      .where(eq(managedDatabases.nodeId, id))
      .orderBy(managedDatabases.name);
    return { services: svc, databases: dbs };
  }
}
