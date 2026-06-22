import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { SessionAuthGuard } from "../rbac/session-auth.guard";
import { CreateEnrollmentTokenDto } from "./dto/create-enrollment-token.dto";
import { NodesService } from "./nodes.service";

@Controller("nodes")
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class NodesController {
  constructor(
    private readonly nodesService: NodesService,
    private readonly auditService: AuditService
  ) {}

  @Post("enrollment-tokens")
  @Permissions("nodes.enroll")
  async createEnrollmentToken(
    @Body() body: CreateEnrollmentTokenDto,
    @Req() request: AuthenticatedRequest
  ) {
    const token = await this.nodesService.createEnrollmentToken({
      nodeName: body.nodeName,
      expiresInMinutes: body.expiresInMinutes,
      createdById: request.session.userId
    });

    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "nodes.enroll.token.create",
      entityType: "enrollment_token",
      entityId: token.id,
      metaJson: {
        nodeName: body.nodeName,
        expiresAt: token.expiresAt
      }
    });

    return token;
  }

  @Get()
  @Permissions("nodes.read")
  listNodes() {
    return this.nodesService.listNodes();
  }

  @Get(":id")
  @Permissions("nodes.read")
  getNode(@Param("id") nodeId: string) {
    return this.nodesService.getNode(nodeId);
  }

  @Post(":id/reconnect")
  @Permissions("nodes.enroll")
  async reconnectNode(@Param("id") nodeId: string, @Req() request: AuthenticatedRequest) {
    const node = await this.nodesService.reconnectNode(nodeId);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "nodes.reconnect",
      entityType: "node",
      entityId: nodeId
    });
    return node;
  }
}
