import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { NodeStatus } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../database/prisma.service";

@Injectable()
export class NodesService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnrollmentToken(input: {
    nodeName: string;
    createdById?: string;
    expiresInMinutes?: number;
  }) {
    const token = randomBytes(24).toString("hex");
    const tokenHash = this.hashValue(token);
    const expiresInMinutes = input.expiresInMinutes ?? 30;

    const record = await this.prisma.enrollmentToken.create({
      data: {
        tokenHash,
        createdById: input.createdById,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60_000)
      }
    });

    return {
      id: record.id,
      token,
      nodeName: input.nodeName,
      expiresAt: record.expiresAt
    };
  }

  async enrollNode(input: { token: string; nodeName: string; agentVersion?: string; metadata?: unknown }) {
    const tokenHash = this.hashValue(input.token);
    const enrollment = await this.prisma.enrollmentToken.findUnique({
      where: { tokenHash }
    });

    if (!enrollment || enrollment.usedAt || enrollment.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Invalid enrollment token");
    }

    const nodeAccessToken = randomBytes(24).toString("hex");
    const nodeAccessTokenHash = this.hashValue(nodeAccessToken);

    const node = await this.prisma.node.create({
      data: {
        name: input.nodeName,
        status: NodeStatus.online,
        agentVersion: input.agentVersion,
        accessTokenHash: nodeAccessTokenHash,
        lastSeenAt: new Date(),
        metadataJson: input.metadata as object | undefined
      }
    });

    await this.prisma.enrollmentToken.update({
      where: { id: enrollment.id },
      data: {
        usedAt: new Date(),
        nodeId: node.id
      }
    });

    return {
      node,
      nodeAccessToken
    };
  }

  async validateNodeAccess(nodeId: string, token: string) {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || !node.accessTokenHash) {
      return false;
    }
    return node.accessTokenHash === this.hashValue(token);
  }

  async listNodes() {
    return this.prisma.node.findMany({
      include: {
        apps: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getNode(nodeId: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      include: {
        apps: {
          include: {
            routes: true
          }
        }
      }
    });

    if (!node) {
      throw new NotFoundException("Node not found");
    }

    return node;
  }

  async markNodeOnline(nodeId: string, agentVersion?: string) {
    return this.prisma.node.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.online,
        agentVersion,
        lastSeenAt: new Date()
      }
    });
  }

  async markNodeOffline(nodeId: string) {
    return this.prisma.node.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.offline
      }
    });
  }

  async heartbeat(nodeId: string) {
    return this.prisma.node.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.online,
        lastSeenAt: new Date()
      }
    });
  }

  async reconnectNode(nodeId: string) {
    return this.prisma.node.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.unknown
      }
    });
  }

  private hashValue(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
