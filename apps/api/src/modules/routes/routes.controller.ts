import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuditService } from "../audit/audit.service";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { SessionAuthGuard } from "../rbac/session-auth.guard";
import { CreateRouteDto, UpdateRouteDto } from "./dto/route.dto";
import { RoutesService } from "./routes.service";

@Controller("routes")
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class RoutesController {
  constructor(
    private readonly routesService: RoutesService,
    private readonly auditService: AuditService
  ) {}

  @Post()
  @Permissions("routes.write")
  async createRoute(@Body() body: CreateRouteDto, @Req() request: AuthenticatedRequest) {
    const route = await this.routesService.createRoute(body);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "routes.create",
      entityType: "route",
      entityId: route.id
    });
    return route;
  }

  @Get()
  @Permissions("routes.read")
  listRoutes() {
    return this.routesService.listRoutes();
  }

  @Patch(":id")
  @Permissions("routes.write")
  async updateRoute(
    @Param("id") routeId: string,
    @Body() body: UpdateRouteDto,
    @Req() request: AuthenticatedRequest
  ) {
    const route = await this.routesService.updateRoute(routeId, body);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "routes.update",
      entityType: "route",
      entityId: routeId
    });
    return route;
  }

  @Delete(":id")
  @Permissions("routes.write")
  async deleteRoute(@Param("id") routeId: string, @Req() request: AuthenticatedRequest) {
    const result = await this.routesService.deleteRoute(routeId);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "routes.delete",
      entityType: "route",
      entityId: routeId
    });
    return result;
  }

  @Post(":id/sync")
  @Permissions("routes.sync")
  async syncRoute(@Param("id") routeId: string, @Req() request: AuthenticatedRequest) {
    const route = await this.routesService.syncRoute(routeId);
    await this.auditService.log({
      actorUserId: request.session.userId,
      action: "routes.sync",
      entityType: "route",
      entityId: routeId
    });
    return route;
  }
}
