import { Controller, Get, Query } from "@nestjs/common";

import { AuditService } from "./audit.service";

@Controller("audit-events")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Query("actor") actorUserId?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string
  ) {
    return this.auditService.list({
      actorUserId,
      entityType,
      entityId
    });
  }
}
