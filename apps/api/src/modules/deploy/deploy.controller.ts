import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { SessionAuthGuard } from "../rbac/session-auth.guard";
import { DeployAppDto, RollbackAppDto } from "./dto/deploy.dto";
import { DeployService } from "./deploy.service";

@Controller("apps")
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class DeployController {
  constructor(
    private readonly deployService: DeployService,
    private readonly auditService: AuditService
  ) {}

  @Post(":id/deploy")
  @Permissions("apps.deploy")
  async deployApp(
    @Param("id") appId: string,
    @Body() body: DeployAppDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.deployService.deployApp({
      appId,
      triggeredById: request.session.userId,
      gitRef: body.gitRef
    });

    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.deploy",
      entityType: "app",
      entityId: appId,
      metaJson: {
        gitRef: body.gitRef
      }
    });

    return result;
  }

  @Post(":id/rollback")
  @Permissions("apps.deploy")
  async rollbackApp(
    @Param("id") appId: string,
    @Body() body: RollbackAppDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.deployService.rollbackApp({
      appId,
      triggeredById: request.session.userId,
      gitRef: body.gitRef
    });

    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "apps.rollback",
      entityType: "app",
      entityId: appId,
      metaJson: {
        gitRef: body.gitRef ?? result.rollbackRef
      }
    });

    return result;
  }
}
