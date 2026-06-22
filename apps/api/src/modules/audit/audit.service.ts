import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";

export interface AuditEventInput {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metaJson?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditEventInput) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metaJson: input.metaJson
      }
    });
  }

  async list(params: {
    actorUserId?: string;
    entityType?: string;
    entityId?: string;
    take?: number;
  }) {
    return this.prisma.auditEvent.findMany({
      where: {
        actorUserId: params.actorUserId,
        entityType: params.entityType,
        entityId: params.entityId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: params.take ?? 100
    });
  }
}
