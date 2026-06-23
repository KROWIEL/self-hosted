import { Module } from "@nestjs/common";

import { RbacModule } from "../rbac/rbac.module";
import { LogsController } from "./logs.controller";
import { LogsService } from "./logs.service";

@Module({
  imports: [RbacModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService]
})
export class LogsModule {}
