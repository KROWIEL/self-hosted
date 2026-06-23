import { Module } from "@nestjs/common";

import { AppsModule } from "../apps/apps.module";
import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DeployController } from "./deploy.controller";
import { DeployService } from "./deploy.service";

@Module({
  imports: [AppsModule, RealtimeModule, AuditModule, RbacModule],
  controllers: [DeployController],
  providers: [DeployService],
  exports: [DeployService]
})
export class DeployModule {}
