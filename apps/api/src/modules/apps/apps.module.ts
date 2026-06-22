import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AppsController } from "./apps.controller";
import { AppsService } from "./apps.service";

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService]
})
export class AppsModule {}
