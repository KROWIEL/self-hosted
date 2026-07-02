import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE, Database } from '../../db/database.module';
import {
  deployments,
  domains,
  envVars,
  gitCredentials,
  nodes,
  services,
  templates,
  volumes,
} from '../../db/schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AgentClient } from '../nodes/agent.client';
import { BuildLogService } from './build-log.service';
import {
  DEPLOY_QUEUE_NAME,
  DeployJobData,
  createRedisConnection,
} from './deploy.constants';

/**
 * Consumes deploy jobs and drives the full pipeline on the target node:
 * build image from git -> run container -> update service/deployment rows.
 */
@Injectable()
export class DeployWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeployWorker.name);
  private worker?: Worker<DeployJobData>;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly agent: AgentClient,
    private readonly buildLog: BuildLogService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<DeployJobData>(
      DEPLOY_QUEUE_NAME,
      (job) => this.process(job),
      { connection: createRedisConnection(), concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Deploy ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<DeployJobData>) {
    const { deploymentId, serviceId, rollbackImageTag, rollbackCommitSha } =
      job.data;

    const svc = (
      await this.db
        .select()
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1)
    )[0];
    if (!svc) throw new Error(`service ${serviceId} not found`);

    const node = (
      await this.db.select().from(nodes).where(eq(nodes.id, svc.nodeId)).limit(1)
    )[0];
    if (!node) throw new Error(`node ${svc.nodeId} not found`);

    const tpl = (
      await this.db
        .select()
        .from(templates)
        .where(eq(templates.id, svc.templateId))
        .limit(1)
    )[0];
    if (!tpl) throw new Error(`template ${svc.templateId} not found`);

    let patToken: string | undefined;
    let gitUsername: string | undefined;
    if (svc.gitCredId) {
      const cred = (
        await this.db
          .select()
          .from(gitCredentials)
          .where(eq(gitCredentials.id, svc.gitCredId))
          .limit(1)
      )[0];
      if (cred) {
        patToken = this.crypto.decrypt(cred.patEnc);
        gitUsername = cred.username ?? undefined;
      }
    }

    const env = await this.resolveEnv(serviceId);
    const domainRow = (
      await this.db
        .select()
        .from(domains)
        .where(eq(domains.serviceId, serviceId))
        .limit(1)
    )[0];
    const volumeRows = await this.db
      .select()
      .from(volumes)
      .where(eq(volumes.serviceId, serviceId));

    const isRollback = !!rollbackImageTag;
    const imageTag =
      rollbackImageTag ??
      `svc-${serviceId.slice(0, 8)}:${deploymentId.slice(0, 8)}`;

    try {
      if (isRollback) {
        // Reuse a previously built image — no clone/build step.
        await this.buildLog.publish(
          deploymentId,
          `>> rollback: redeploying existing image ${imageTag}\n`,
        );
        await this.setDeploy(deploymentId, {
          status: 'DEPLOYING',
          commitSha: rollbackCommitSha,
          imageTag,
          buildLog: `Rollback: reused image ${imageTag}`,
        });
        await this.setService(serviceId, { status: 'BUILDING' });
      } else {
        await this.setDeploy(deploymentId, { status: 'BUILDING' });
        await this.setService(serviceId, { status: 'BUILDING' });

        const build = await this.agent.build(
          node,
          {
            serviceId,
            repoUrl: svc.repoUrl,
            branch: svc.branch,
            patToken,
            gitUsername,
            buildImage: tpl.installImage,
            runImage: tpl.baseImage,
            dockerfile: tpl.dockerfilePath ?? undefined,
            useRepoDockerfile: svc.useRepoDockerfile,
            imageTag,
          },
          (chunk) => void this.buildLog.publish(deploymentId, chunk),
        );

        await this.setDeploy(deploymentId, {
          status: 'DEPLOYING',
          commitSha: build.commitSha,
          imageTag,
          buildLog: build.buildLog,
        });
      }

      const run = await this.agent.run(node, {
        serviceId,
        image: imageTag,
        port: svc.port ?? tpl.defaultPort,
        cpuLimit: svc.cpuLimit,
        memLimit: svc.memLimit,
        env,
        domain: domainRow?.host,
        https: domainRow?.https,
        volumes: volumeRows.map((v) => ({
          name: v.name,
          mountPath: v.mountPath,
        })),
      });
      if (!run.ok) {
        throw new Error(run.error ?? 'agent run failed');
      }

      await this.setService(serviceId, {
        status: 'RUNNING',
        containerId: run.containerId,
        currentImage: imageTag,
      });
      await this.setDeploy(deploymentId, {
        status: 'SUCCESS',
        finishedAt: new Date(),
      });

      // Housekeeping: drop older images of this service to reclaim disk.
      // Best-effort — never fail a successful deploy over cleanup.
      try {
        await this.agent.gc(node, serviceId, imageTag);
      } catch (gcErr) {
        this.logger.warn(
          `GC for ${serviceId} failed: ${
            gcErr instanceof Error ? gcErr.message : String(gcErr)
          }`,
        );
      }
    } catch (e) {
      const err = e as Error & { buildLog?: string };
      await this.buildLog.publish(deploymentId, `\nERROR: ${err.message}\n`);
      await this.setService(serviceId, { status: 'ERROR' });
      await this.setDeploy(deploymentId, {
        status: 'FAILED',
        errorMsg: err.message,
        ...(err.buildLog ? { buildLog: err.buildLog } : {}),
        finishedAt: new Date(),
      });
      throw err;
    } finally {
      await this.buildLog.end(deploymentId);
    }
  }

  private async resolveEnv(serviceId: string): Promise<Record<string, string>> {
    const rows = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.serviceId, serviceId));
    return Object.fromEntries(
      rows.map((v) => [v.key, this.crypto.decrypt(v.valueEnc)]),
    );
  }

  private setDeploy(
    id: string,
    set: Partial<typeof deployments.$inferInsert>,
  ) {
    return this.db.update(deployments).set(set).where(eq(deployments.id, id));
  }

  private setService(id: string, set: Partial<typeof services.$inferInsert>) {
    return this.db.update(services).set(set).where(eq(services.id, id));
  }
}
