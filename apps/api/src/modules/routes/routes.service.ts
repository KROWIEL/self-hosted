import { Injectable, NotFoundException } from "@nestjs/common";
import { RouteStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateRouteDto, UpdateRouteDto } from "./dto/route.dto";
import { CaddyAdminService } from "./caddy-admin.service";
import { TunnelConfigService } from "./tunnel-config.service";

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caddyAdminService: CaddyAdminService,
    private readonly tunnelConfigService: TunnelConfigService,
    private readonly realtimeService: RealtimeService
  ) {}

  async createRoute(input: CreateRouteDto) {
    return this.prisma.appRoute.create({
      data: {
        appId: input.appId,
        domain: input.domain.toLowerCase(),
        bindPort: input.bindPort,
        targetPort: input.targetPort,
        status: RouteStatus.pending
      },
      include: {
        app: true
      }
    });
  }

  async listRoutes() {
    return this.prisma.appRoute.findMany({
      include: {
        app: {
          include: {
            node: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async updateRoute(routeId: string, input: UpdateRouteDto) {
    return this.prisma.appRoute.update({
      where: { id: routeId },
      data: {
        domain: input.domain?.toLowerCase(),
        bindPort: input.bindPort,
        targetPort: input.targetPort,
        status: RouteStatus.pending
      },
      include: {
        app: true
      }
    });
  }

  async deleteRoute(routeId: string) {
    await this.prisma.appRoute.delete({
      where: { id: routeId }
    });
    return { success: true };
  }

  async syncRoute(routeId: string) {
    const route = await this.prisma.appRoute.findUnique({
      where: { id: routeId },
      include: {
        app: {
          include: {
            node: true
          }
        }
      }
    });
    if (!route) {
      throw new NotFoundException("Route not found");
    }

    return this.syncRoutesByIds([routeId]);
  }

  async syncRoutesByIds(routeIds: string[]) {
    const routes = await this.prisma.appRoute.findMany({
      where: {
        id: { in: routeIds }
      },
      include: {
        app: {
          include: { node: true }
        }
      }
    });

    const allRoutes = await this.prisma.appRoute.findMany({
      include: {
        app: {
          include: { node: true }
        }
      }
    });

    try {
      await this.caddyAdminService.syncRoutes(
        allRoutes.map((route) => ({
          domain: route.domain,
          bindPort: route.bindPort
        }))
      );

      await this.tunnelConfigService.syncServerConfig(
        allRoutes.map((route) => ({
          serviceName: this.getServiceName(route.id),
          bindPort: route.bindPort
        }))
      );

      const byNode = new Map<string, typeof allRoutes>();
      for (const route of allRoutes) {
        const nodeId = route.app.nodeId;
        if (!byNode.has(nodeId)) {
          byNode.set(nodeId, []);
        }
        byNode.get(nodeId)!.push(route);
      }

      for (const [nodeId, nodeRoutes] of byNode) {
        if (!this.realtimeService.isNodeConnected(nodeId)) {
          continue;
        }
        await this.realtimeService.dispatchCommand(nodeId, "tunnel.sync", {
          services: nodeRoutes.map((route) => ({
            routeId: route.id,
            serviceName: this.getServiceName(route.id),
            targetPort: route.targetPort,
            bindPort: route.bindPort
          }))
        });
      }

      await this.prisma.appRoute.updateMany({
        where: {
          id: { in: routes.map((route) => route.id) }
        },
        data: {
          status: RouteStatus.synced,
          lastSyncAt: new Date()
        }
      });
    } catch (error) {
      await this.prisma.appRoute.updateMany({
        where: {
          id: { in: routes.map((route) => route.id) }
        },
        data: {
          status: RouteStatus.failed
        }
      });
      throw error;
    }

    return this.prisma.appRoute.findMany({
      where: {
        id: { in: routeIds }
      },
      include: {
        app: true
      }
    });
  }

  private getServiceName(routeId: string) {
    return `route_${routeId.replace(/-/g, "_")}`;
  }
}
