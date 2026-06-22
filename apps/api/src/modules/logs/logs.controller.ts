import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { SessionAuthGuard } from "../rbac/session-auth.guard";
import { LogsService } from "./logs.service";

class LogsQueryDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

@Controller("apps")
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get(":id/logs")
  @Permissions("logs.read")
  getAppLogs(@Param("id") appId: string, @Query() query: LogsQueryDto) {
    return this.logsService.getLogs(appId, query);
  }
}
