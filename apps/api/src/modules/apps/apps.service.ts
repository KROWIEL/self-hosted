import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppStatus, GitCredentialType, Prisma } from "@prisma/client";

import { EncryptionService } from "../security/encryption.service";
import { PrismaService } from "../database/prisma.service";
import { CreateAppDto, UpdateAppDto } from "./dto/app.dto";

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService
  ) {}

  async createApp(input: CreateAppDto) {
    this.validateResourceLimits(input.cpuLimit, input.memoryLimit, true);

    return this.prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({
        where: { id: input.nodeId }
      });
      if (!node) {
        throw new NotFoundException("Node not found");
      }

      const app = await tx.app.create({
        data: {
          nodeId: input.nodeId,
          name: input.name,
          repoUrl: input.repoUrl,
          branch: input.branch,
          composePath: input.composePath,
          serviceName: input.serviceName,
          healthcheckUrl: input.healthcheckUrl,
          cpuLimit: input.cpuLimit,
          memoryLimit: input.memoryLimit,
          status: AppStatus.unknown
        }
      });

      if (input.envVars.length > 0) {
        await tx.appEnvVar.createMany({
          data: input.envVars.map((envVar) => ({
            appId: app.id,
            key: envVar.key,
            valueEncrypted: this.encryptionService.encrypt(envVar.value),
            isSecret: envVar.isSecret ?? true
          }))
        });
      }

      if (input.gitCredential) {
        await tx.gitCredential.create({
          data: {
            appId: app.id,
            type: input.gitCredential.type === "ssh_key" ? GitCredentialType.ssh_key : GitCredentialType.pat,
            username: input.gitCredential.username,
            secretEncrypted: this.encryptionService.encrypt(input.gitCredential.secret)
          }
        });
      }

      return this.getApp(app.id);
    });
  }

  async listApps() {
    const apps = await this.prisma.app.findMany({
      include: {
        envVars: true,
        gitCredentials: true,
        routes: true,
        node: true
      },
      orderBy: { createdAt: "desc" }
    });
    return apps.map((app) => this.sanitizeApp(app));
  }

  async getApp(appId: string) {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: {
        envVars: true,
        gitCredentials: true,
        routes: true,
        node: true
      }
    });
    if (!app) {
      throw new NotFoundException("App not found");
    }
    return this.sanitizeApp(app);
  }

  async updateApp(appId: string, input: UpdateAppDto) {
    if (input.cpuLimit !== undefined || input.memoryLimit !== undefined) {
      this.validateResourceLimits(input.cpuLimit, input.memoryLimit, false);
    }

    const existing = await this.prisma.app.findUnique({ where: { id: appId } });
    if (!existing) {
      throw new NotFoundException("App not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.app.update({
        where: { id: appId },
        data: {
          name: input.name,
          repoUrl: input.repoUrl,
          branch: input.branch,
          composePath: input.composePath,
          serviceName: input.serviceName,
          healthcheckUrl: input.healthcheckUrl,
          cpuLimit: input.cpuLimit,
          memoryLimit: input.memoryLimit
        }
      });

      if (input.envVars) {
        await tx.appEnvVar.deleteMany({
          where: { appId }
        });
        await tx.appEnvVar.createMany({
          data: input.envVars.map((envVar) => ({
            appId,
            key: envVar.key,
            valueEncrypted: this.encryptionService.encrypt(envVar.value),
            isSecret: envVar.isSecret ?? true
          }))
        });
      }

      if (input.gitCredential) {
        await tx.gitCredential.deleteMany({ where: { appId } });
        await tx.gitCredential.create({
          data: {
            appId,
            type: input.gitCredential.type === "ssh_key" ? GitCredentialType.ssh_key : GitCredentialType.pat,
            username: input.gitCredential.username,
            secretEncrypted: this.encryptionService.encrypt(input.gitCredential.secret)
          }
        });
      }
    });

    return this.getApp(appId);
  }

  async deleteApp(appId: string) {
    await this.prisma.app.delete({
      where: { id: appId }
    });
    return { success: true };
  }

  async updateAppStatus(appId: string, status: AppStatus) {
    return this.prisma.app.update({
      where: { id: appId },
      data: { status }
    });
  }

  async getAppDeploymentSpec(appId: string) {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: {
        envVars: true,
        gitCredentials: true,
        node: true
      }
    });
    if (!app) {
      throw new NotFoundException("App not found");
    }

    const envVars = app.envVars.map((envVar) => ({
      key: envVar.key,
      value: this.encryptionService.decrypt(envVar.valueEncrypted),
      isSecret: envVar.isSecret
    }));

    const gitCredentials = app.gitCredentials.map((credential) => ({
      type: credential.type,
      username: credential.username,
      secret: this.encryptionService.decrypt(credential.secretEncrypted)
    }));

    return {
      app,
      envVars,
      gitCredentials
    };
  }

  private sanitizeApp(
    app: Prisma.AppGetPayload<{
      include: { envVars: true; gitCredentials: true; routes: true; node: true };
    }>
  ) {
    return {
      ...app,
      envVars: app.envVars.map((envVar) => ({
        id: envVar.id,
        key: envVar.key,
        isSecret: envVar.isSecret,
        hasValue: Boolean(envVar.valueEncrypted)
      })),
      gitCredentials: app.gitCredentials.map((credential) => ({
        id: credential.id,
        type: credential.type,
        username: credential.username,
        hasSecret: Boolean(credential.secretEncrypted)
      }))
    };
  }

  private validateResourceLimits(cpuLimit?: string, memoryLimit?: string, requireBoth = false) {
    if (requireBoth) {
      if (!cpuLimit) {
        throw new BadRequestException("cpuLimit is required");
      }
      if (!memoryLimit) {
        throw new BadRequestException("memoryLimit is required");
      }
      return;
    }

    if (cpuLimit !== undefined && cpuLimit.trim().length === 0) {
      throw new BadRequestException("cpuLimit cannot be empty");
    }
    if (memoryLimit !== undefined && memoryLimit.trim().length === 0) {
      throw new BadRequestException("memoryLimit cannot be empty");
    }
  }
}
