import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { RbacController } from "./rbac.controller";
import { PermissionsGuard } from "./permissions.guard";
import { RbacService } from "./rbac.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Module({
  imports: [AuditModule],
  controllers: [RbacController],
  providers: [RbacService, SessionAuthGuard, PermissionsGuard],
  exports: [RbacService, SessionAuthGuard, PermissionsGuard]
})
export class RbacModule {}
