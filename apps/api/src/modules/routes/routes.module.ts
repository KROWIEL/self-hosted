import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { CaddyAdminService } from "./caddy-admin.service";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";
import { TunnelConfigService } from "./tunnel-config.service";

@Module({
  imports: [AuditModule, RealtimeModule, RbacModule],
  controllers: [RoutesController],
  providers: [RoutesService, CaddyAdminService, TunnelConfigService],
  exports: [RoutesService]
})
export class RoutesModule {}
