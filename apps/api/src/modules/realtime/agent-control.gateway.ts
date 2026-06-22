import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { LogsService } from "../logs/logs.service";
import { NodesService } from "../nodes/nodes.service";
import { RealtimeService } from "./realtime.service";

@WebSocketGateway({
  namespace: "/agent-control",
  cors: {
    origin: "*"
  }
})
export class AgentControlGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(AgentControlGateway.name);

  constructor(
    private readonly nodesService: NodesService,
    private readonly realtimeService: RealtimeService,
    private readonly logsService: LogsService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as {
      enrollmentToken?: string;
      nodeName?: string;
      nodeId?: string;
      nodeToken?: string;
      agentVersion?: string;
    };

    try {
      let nodeId = auth.nodeId;
      if (auth.enrollmentToken && auth.nodeName) {
        const enrollment = await this.nodesService.enrollNode({
          token: auth.enrollmentToken,
          nodeName: auth.nodeName,
          agentVersion: auth.agentVersion
        });
        nodeId = enrollment.node.id;
        client.emit("enrolled", {
          nodeId: enrollment.node.id,
          nodeToken: enrollment.nodeAccessToken
        });
      } else if (auth.nodeId && auth.nodeToken) {
        const valid = await this.nodesService.validateNodeAccess(auth.nodeId, auth.nodeToken);
        if (!valid) {
          throw new Error("Invalid node credentials");
        }
      } else {
        throw new Error("Missing enrollmentToken or node credentials");
      }

      if (!nodeId) {
        throw new Error("Failed to resolve node id");
      }

      client.data.nodeId = nodeId;
      await this.nodesService.markNodeOnline(nodeId, auth.agentVersion);
      this.realtimeService.registerAgent(nodeId, client);
      this.logger.log(`Agent connected: ${nodeId}`);
    } catch (error) {
      this.logger.warn(`Agent rejected: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const nodeId = client.data.nodeId as string | undefined;
    if (!nodeId) {
      return;
    }

    await this.nodesService.markNodeOffline(nodeId);
    this.realtimeService.unregisterAgent(nodeId);
    this.logger.log(`Agent disconnected: ${nodeId}`);
  }

  @SubscribeMessage("heartbeat")
  async heartbeat(@ConnectedSocket() client: Socket) {
    const nodeId = client.data.nodeId as string | undefined;
    if (!nodeId) {
      return { ok: false };
    }
    await this.nodesService.heartbeat(nodeId);
    return { ok: true };
  }

  @SubscribeMessage("command_result")
  async commandResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId: string; success: boolean; result?: unknown }
  ) {
    const nodeId = client.data.nodeId as string | undefined;
    this.realtimeService.completeCommand(body.jobId, body.success, body.result);
    this.realtimeService.broadcast("command.result", {
      nodeId,
      ...body
    });
    return { accepted: true };
  }

  @SubscribeMessage("log_line")
  async logLine(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      appId: string;
      stream: string;
      line: string;
      ts?: string;
    }
  ) {
    const nodeId = client.data.nodeId as string | undefined;
    if (!nodeId) {
      return { accepted: false };
    }

    const log = await this.logsService.ingestLog({
      appId: body.appId,
      nodeId,
      stream: body.stream,
      line: body.line,
      ts: body.ts ? new Date(body.ts) : new Date()
    });

    this.realtimeService.broadcast("logs.line", log);
    return { accepted: true };
  }

  @SubscribeMessage("deploy_progress")
  deployProgress(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      appId: string;
      deployJobId: string;
      stage: string;
      message: string;
    }
  ) {
    const nodeId = client.data.nodeId as string | undefined;
    this.realtimeService.broadcast("deploy.progress", {
      ...body,
      nodeId
    });
    return { accepted: true };
  }
}
