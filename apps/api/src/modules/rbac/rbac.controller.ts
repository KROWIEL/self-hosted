import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { AssignRolesDto } from "./dto/assign-roles.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { SetUserActiveDto } from "./dto/set-user-active.dto";
import { Permissions } from "./permissions.decorator";
import { PermissionsGuard } from "./permissions.guard";
import { RbacService } from "./rbac.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService
  ) {}

  @Get("users")
  @Permissions("users.read")
  listUsers() {
    return this.rbacService.listUsers();
  }

  @Post("users/invite")
  @Permissions("users.invite")
  async inviteUser(@Body() body: InviteUserDto, @Req() request: AuthenticatedRequest) {
    if (!body.githubLogin && !body.email) {
      throw new BadRequestException("Either githubLogin or email is required");
    }

    const invite = await this.rbacService.inviteUser({
      githubLogin: body.githubLogin,
      email: body.email,
      roleName: body.roleName,
      createdById: request.session.userId
    });

    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "users.invite",
      entityType: "user_invite",
      entityId: invite.id,
      metaJson: {
        githubLogin: body.githubLogin,
        email: body.email,
        roleName: body.roleName
      }
    });

    return invite;
  }

  @Patch("users/:id/roles")
  @Permissions("users.roles.write")
  async assignRoles(
    @Param("id") userId: string,
    @Body() body: AssignRolesDto,
    @Req() request: AuthenticatedRequest
  ) {
    const user = await this.rbacService.assignRoles(userId, body.roles);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "users.roles.write",
      entityType: "user",
      entityId: userId,
      metaJson: {
        roles: body.roles
      }
    });
    return user;
  }

  @Patch("users/:id/active")
  @Permissions("users.active.write")
  async setUserActive(
    @Param("id") userId: string,
    @Body() body: SetUserActiveDto,
    @Req() request: AuthenticatedRequest
  ) {
    const user = await this.rbacService.setUserActive(userId, body.isActive);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "users.active.write",
      entityType: "user",
      entityId: userId,
      metaJson: {
        isActive: body.isActive
      }
    });
    return user;
  }

  @Get("roles")
  @Permissions("roles.read")
  listRoles() {
    return this.rbacService.listRoles();
  }

  @Get("permissions")
  @Permissions("roles.read")
  listPermissions() {
    return this.rbacService.listPermissions();
  }
}
