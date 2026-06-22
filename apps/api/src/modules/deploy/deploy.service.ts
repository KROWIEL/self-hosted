import { Injectable, NotFoundException } from "@nestjs/common";
import { DeployStatus } from "@prisma/client";

import { AppsService } from "../apps/apps.service";
import { PrismaService } from "../database/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class DeployService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appsService: AppsService,
    private readonly realtimeService: RealtimeService
  ) {}

  async deployApp(input: { appId: string; triggeredById?: string; gitRef?: string }) {
    const deploymentSpec = await this.appsService.getAppDeploymentSpec(input.appId);
    const gitRef = input.gitRef ?? deploymentSpec.app.branch;

    const job = await this.prisma.deployJob.create({
      data: {
        appId: input.appId,
        triggeredById: input.triggeredById,
        gitRef,
        status: DeployStatus.running,
        startedAt: new Date()
      }
    });

    try {
      const result = await this.realtimeService.dispatchCommand(deploymentSpec.app.nodeId, "app.deploy", {
        deployJobId: job.id,
        gitRef,
        app: {
          id: deploymentSpec.app.id,
          name: deploymentSpec.app.name,
          repoUrl: deploymentSpec.app.repoUrl,
          branch: deploymentSpec.app.branch,
          composePath: deploymentSpec.app.composePath,
          serviceName: deploymentSpec.app.serviceName,
          healthcheckUrl: deploymentSpec.app.healthcheckUrl,
          cpuLimit: deploymentSpec.app.cpuLimit,
          memoryLimit: deploymentSpec.app.memoryLimit
        },
        envVars: deploymentSpec.envVars,
        gitCredentials: deploymentSpec.gitCredentials
      });

      await this.prisma.deployJob.update({
        where: { id: job.id },
        data: {
          status: DeployStatus.succeeded,
          finishedAt: new Date()
        }
      });

      await this.prisma.deployRevision.create({
        data: {
          appId: input.appId,
          gitRef
        }
      });

      return {
        jobId: job.id,
        status: "succeeded",
        result
      };
    } catch (error) {
      await this.prisma.deployJob.update({
        where: { id: job.id },
        data: {
          status: DeployStatus.failed,
          finishedAt: new Date(),
          errorText: (error as Error).message
        }
      });
      throw error;
    }
  }

  async rollbackApp(input: { appId: string; triggeredById?: string; gitRef?: string }) {
    let rollbackRef = input.gitRef;
    if (!rollbackRef) {
      const revisions = await this.prisma.deployRevision.findMany({
        where: {
          appId: input.appId
        },
        orderBy: {
          deployedAt: "desc"
        },
        take: 2
      });

      rollbackRef = revisions[1]?.gitRef ?? revisions[0]?.gitRef;
    }

    if (!rollbackRef) {
      throw new NotFoundException("No deployment revisions available for rollback");
    }

    const deployResult = await this.deployApp({
      appId: input.appId,
      triggeredById: input.triggeredById,
      gitRef: rollbackRef
    });

    return {
      ...deployResult,
      rollbackRef
    };
  }
}
