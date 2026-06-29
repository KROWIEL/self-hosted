import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PowerAction } from '@selfhosted/shared';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, Database } from '../../db/database.module';
import {
  deployments,
  domains,
  envVars,
  nodes,
  services,
} from '../../db/schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AgentClient } from '../nodes/agent.client';
import { CreateServiceDto } from './dto/create-service.dto';
import { SetDomainDto, SetEnvDto } from './dto/set-env.dto';
import { DEPLOY_QUEUE, DeployJobData } from './deploy.constants';

@Injectable()
export class ServicesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly agent: AgentClient,
    @Inject(DEPLOY_QUEUE) private readonly deployQueue: Queue<DeployJobData>,
  ) {}

  private async node(nodeId: string) {
    const rows = await this.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Node not found');
    return rows[0];
  }

  async create(projectId: string, dto: CreateServiceDto) {
    const rows = await this.db
      .insert(services)
      .values({
        name: dto.name,
        type: dto.type,
        projectId,
        nodeId: dto.nodeId,
        templateId: dto.templateId,
        repoUrl: dto.repoUrl,
        branch: dto.branch ?? 'main',
        gitCredId: dto.gitCredId,
        useRepoDockerfile: dto.useRepoDockerfile ?? false,
        buildCommand: dto.buildCommand,
        runCommand: dto.runCommand,
        port: dto.port,
        cpuLimit: dto.cpuLimit ?? 100,
        memLimit: dto.memLimit ?? 512,
      })
      .returning();
    const service = rows[0];

    if (dto.env) {
      await this.setEnv(service.id, {
        vars: Object.entries(dto.env).map(([key, value]) => ({ key, value })),
      });
    }

    return service;
  }

  async get(id: string) {
    const rows = await this.db
      .select()
      .from(services)
      .where(eq(services.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Service not found');
    return rows[0];
  }

  /** Opens the runtime log stream for a service from its node's agent. */
  async openLogStream(id: string, signal?: AbortSignal) {
    const service = await this.get(id);
    const node = await this.node(service.nodeId);
    return this.agent.streamLogs(node, id, signal);
  }

  /** Live resource + health stats for a service container. */
  async stats(id: string) {
    const service = await this.get(id);
    const node = await this.node(service.nodeId);
    return this.agent.getStats(node, id);
  }

  async remove(id: string) {
    const service = await this.get(id);
    try {
      const node = await this.node(service.nodeId);
      await this.agent.remove(node, id);
    } catch {
      // Best-effort: still remove the record even if the agent is unreachable.
    }
    await this.db.delete(services).where(eq(services.id, id));
    return { ok: true };
  }

  async setEnv(id: string, dto: SetEnvDto) {
    await this.get(id);
    for (const v of dto.vars) {
      await this.db
        .insert(envVars)
        .values({
          serviceId: id,
          key: v.key,
          valueEnc: this.crypto.encrypt(v.value),
          isSecret: v.isSecret ?? false,
        })
        .onConflictDoUpdate({
          target: [envVars.serviceId, envVars.key],
          set: {
            valueEnc: this.crypto.encrypt(v.value),
            isSecret: v.isSecret ?? false,
          },
        });
    }
    return this.listEnv(id);
  }

  async listEnv(id: string) {
    const rows = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.serviceId, id));
    return rows.map((v) => ({
      key: v.key,
      value: v.isSecret ? '••••••' : this.crypto.decrypt(v.valueEnc),
      isSecret: v.isSecret,
    }));
  }

  /** Decrypts all env vars; used by the build/run pipeline only. */
  async resolveEnv(id: string): Promise<Record<string, string>> {
    const rows = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.serviceId, id));
    return Object.fromEntries(
      rows.map((v) => [v.key, this.crypto.decrypt(v.valueEnc)]),
    );
  }

  async setDomain(id: string, dto: SetDomainDto) {
    await this.get(id);
    const rows = await this.db
      .insert(domains)
      .values({ serviceId: id, host: dto.host, https: dto.https ?? true })
      .onConflictDoUpdate({
        target: domains.serviceId,
        set: { host: dto.host, https: dto.https ?? true },
      })
      .returning();
    return rows[0];
  }

  /**
   * Record a Deployment and enqueue a BullMQ job. The DeployWorker drives the
   * build + run pipeline on the target node and updates the rows as it goes.
   */
  async deploy(id: string) {
    await this.get(id);
    const rows = await this.db
      .insert(deployments)
      .values({ serviceId: id, status: 'QUEUED' })
      .returning();
    const deployment = rows[0];
    await this.deployQueue.add(
      'deploy',
      { deploymentId: deployment.id, serviceId: id },
      { removeOnComplete: 50, removeOnFail: 100 },
    );
    return deployment;
  }

  /**
   * Redeploys a previous successful deployment's image without rebuilding.
   * Creates a new deployment row and enqueues a rollback job.
   */
  async rollback(deploymentId: string) {
    const source = await this.getDeployment(deploymentId);
    if (!source) throw new NotFoundException('Deployment not found');
    if (source.status !== 'SUCCESS' || !source.imageTag) {
      throw new BadRequestException(
        'Only a successful deployment with a built image can be rolled back to',
      );
    }
    await this.get(source.serviceId);
    const rows = await this.db
      .insert(deployments)
      .values({
        serviceId: source.serviceId,
        status: 'QUEUED',
        commitSha: source.commitSha,
        imageTag: source.imageTag,
      })
      .returning();
    const deployment = rows[0];
    await this.deployQueue.add(
      'deploy',
      {
        deploymentId: deployment.id,
        serviceId: source.serviceId,
        rollbackImageTag: source.imageTag,
        rollbackCommitSha: source.commitSha ?? undefined,
      },
      { removeOnComplete: 50, removeOnFail: 100 },
    );
    return deployment;
  }

  /** Deterministic webhook token for a service (HMAC, no DB column needed). */
  webhookToken(id: string): string {
    const secret =
      process.env.WEBHOOK_SECRET ?? process.env.JWT_SECRET ?? 'webhook-secret';
    return createHmac('sha256', secret).update(id).digest('hex').slice(0, 32);
  }

  /** Returns the auto-deploy webhook URL + token for a service. */
  async getWebhook(id: string) {
    await this.get(id);
    const token = this.webhookToken(id);
    return { token, path: `/webhooks/services/${id}/${token}` };
  }

  /** Validates a webhook token and triggers a deploy (used by the public hook). */
  async deployViaWebhook(id: string, token: string) {
    const expected = this.webhookToken(id);
    if (
      token.length !== expected.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      throw new NotFoundException('Invalid webhook token');
    }
    return this.deploy(id);
  }

  listDeployments(id: string) {
    return this.db
      .select()
      .from(deployments)
      .where(eq(deployments.serviceId, id))
      .orderBy(desc(deployments.createdAt));
  }

  /** Returns a single deployment row (or undefined). */
  async getDeployment(id: string) {
    return (
      await this.db
        .select()
        .from(deployments)
        .where(eq(deployments.id, id))
        .limit(1)
    )[0];
  }

  /** Power action (start/stop/restart/kill) — proxied to the node agent. */
  async power(id: string, action: PowerAction) {
    const service = await this.get(id);
    const node = await this.node(service.nodeId);
    await this.agent.power(node, id, action);
    const status =
      action === PowerAction.STOP || action === PowerAction.KILL
        ? 'STOPPED'
        : 'RUNNING';
    await this.db
      .update(services)
      .set({ status })
      .where(eq(services.id, service.id));
    return this.get(service.id);
  }
}
