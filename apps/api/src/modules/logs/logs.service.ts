import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../database/prisma.service";

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestLog(input: { appId: string; nodeId: string; stream: string; line: string; ts: Date }) {
    return this.prisma.appLog.create({
      data: {
        appId: input.appId,
        nodeId: input.nodeId,
        stream: input.stream,
        line: input.line,
        ts: input.ts
      }
    });
  }

  async getLogs(appId: string, query: { from?: Date; to?: Date; limit?: number }) {
    return this.prisma.appLog.findMany({
      where: {
        appId,
        ts: {
          gte: query.from,
          lte: query.to
        }
      },
      orderBy: {
        ts: "desc"
      },
      take: query.limit ?? 500
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async enforceRetention() {
    const retentionMs = 7 * 24 * 60 * 60 * 1000;
    const threshold = new Date(Date.now() - retentionMs);
    await this.prisma.appLog.deleteMany({
      where: {
        ts: {
          lt: threshold
        }
      }
    });
  }
}
