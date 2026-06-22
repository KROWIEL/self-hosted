import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AppStatus } from "@prisma/client";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { SessionAuthGuard } from "../rbac/session-auth.guard";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateAppDto, UpdateAppDto } from "./dto/app.dto";
import { AppsService } from "./apps.service";

@Controller("apps")
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly realtimeService: RealtimeService,
    private readonly auditService: AuditService
  ) {}

  @Post()
  @Permissions("apps.write")
  async createApp(@Body() body: CreateAppDto, @Req() request: AuthenticatedRequest) {
    const app = await this.appsService.createApp(body);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.create",
      entityType: "app",
      entityId: app.id
    });
    return app;
  }

  @Get()
  @Permissions("apps.read")
  listApps() {
    return this.appsService.listApps();
  }

  @Get(":id")
  @Permissions("apps.read")
  getApp(@Param("id") appId: string) {
    return this.appsService.getApp(appId);
  }

  @Patch(":id")
  @Permissions("apps.write")
  async updateApp(
    @Param("id") appId: string,
    @Body() body: UpdateAppDto,
    @Req() request: AuthenticatedRequest
  ) {
    const app = await this.appsService.updateApp(appId, body);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.update",
      entityType: "app",
      entityId: appId
    });
    return app;
  }

  @Delete(":id")
  @Permissions("apps.write")
  async deleteApp(@Param("id") appId: string, @Req() request: AuthenticatedRequest) {
    const result = await this.appsService.deleteApp(appId);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.delete",
      entityType: "app",
      entityId: appId
    });
    return result;
  }

  @Post(":id/start")
  @Permissions("apps.control")
  async startApp(@Param("id") appId: string, @Req() request: AuthenticatedRequest) {
    const spec = await this.appsService.getAppDeploymentSpec(appId);
    const result = await this.realtimeService.dispatchCommand(spec.app.nodeId, "app.start", {
      appId,
      composePath: spec.app.composePath,
      serviceName: spec.app.serviceName
    });
    await this.appsService.updateAppStatus(appId, AppStatus.running);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.start",
      entityType: "app",
      entityId: appId
    });
    return result;
  }

  @Post(":id/stop")
  @Permissions("apps.control")
  async stopApp(@Param("id") appId: string, @Req() request: AuthenticatedRequest) {
    const spec = await this.appsService.getAppDeploymentSpec(appId);
    const result = await this.realtimeService.dispatchCommand(spec.app.nodeId, "app.stop", {
      appId,
      composePath: spec.app.composePath,
      serviceName: spec.app.serviceName
    });
    await this.appsService.updateAppStatus(appId, AppStatus.stopped);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.stop",
      entityType: "app",
      entityId: appId
    });
    return result;
  }

  @Post(":id/restart")
  @Permissions("apps.control")
  async restartApp(@Param("id") appId: string, @Req() request: AuthenticatedRequest) {
    const spec = await this.appsService.getAppDeploymentSpec(appId);
    const result = await this.realtimeService.dispatchCommand(spec.app.nodeId, "app.restart", {
      appId,
      composePath: spec.app.composePath,
      serviceName: spec.app.serviceName
    });
    await this.appsService.updateAppStatus(appId, AppStatus.running);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.restart",
      entityType: "app",
      entityId: appId
    });
    return result;
  }
}
