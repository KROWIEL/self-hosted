import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutHandle: NodeJS.Timeout;
};

@Injectable()
export class RealtimeService {
  private readonly agentSockets = new Map<string, Socket>();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private uiServer: Server | null = null;

  attachUiServer(server: Server) {
    this.uiServer = server;
  }

  registerAgent(nodeId: string, socket: Socket) {
    this.agentSockets.set(nodeId, socket);
    this.broadcast("node.status", {
      nodeId,
      connected: true
    });
  }

  unregisterAgent(nodeId: string) {
    this.agentSockets.delete(nodeId);
    this.broadcast("node.status", {
      nodeId,
      connected: false
    });
  }

  isNodeConnected(nodeId: string) {
    return this.agentSockets.has(nodeId);
  }

  async dispatchCommand(nodeId: string, type: string, payload: Record<string, unknown>, timeoutMs = 120_000) {
    const socket = this.agentSockets.get(nodeId);
    if (!socket) {
      throw new Error(`Node ${nodeId} is offline`);
    }

    const jobId = randomUUID();
    const command = {
      jobId,
      type,
      payload
    };

    const result = await new Promise<unknown>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingCommands.delete(jobId);
        reject(new Error(`Command ${type} timed out for node ${nodeId}`));
      }, timeoutMs);

      this.pendingCommands.set(jobId, {
        resolve,
        reject,
        timeoutHandle
      });
      socket.emit("command", command);
    });

    return {
      jobId,
      result
    };
  }

  completeCommand(jobId: string, success: boolean, result: unknown) {
    const pending = this.pendingCommands.get(jobId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutHandle);
    this.pendingCommands.delete(jobId);
    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(typeof result === "string" ? result : JSON.stringify(result)));
    }
  }

  broadcast(event: string, payload: unknown) {
    this.uiServer?.emit(event, payload);
  }
}
