import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { NodesController } from "./nodes.controller";
import { NodesService } from "./nodes.service";

@Module({
  imports: [AuditModule, RbacModule],
  controllers: [NodesController],
  providers: [NodesService],
  exports: [NodesService]
})
export class NodesModule {}
