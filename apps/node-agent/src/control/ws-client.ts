import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { io, Socket } from "socket.io-client";

import { AgentConfig } from "../config";
import { DeployService } from "../deploy/deploy.service";
import { DockerService } from "../docker/docker.service";
import { LogForwarder } from "../logs/log-forwarder";
import { TunnelService } from "../tunnel/tunnel.service";

type CommandEnvelope = {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
};

type AgentState = {
  nodeId?: string;
  nodeToken?: string;
};

export class AgentControlClient {
  private socket!: Socket;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private state: AgentState = {};

  constructor(
    private readonly config: AgentConfig,
    private readonly dockerService: DockerService,
    private readonly deployService: DeployService,
    private readonly logForwarder: LogForwarder,
    private readonly tunnelService: TunnelService
  ) {}

  async start() {
    this.state = await this.loadState();
    const auth = this.buildAuthPayload();
    this.socket = io(`${this.config.API_BASE_URL}/agent-control`, {
      auth,
      transports: ["websocket"],
      reconnection: true
    });

    this.socket.on("connect", () => {
      // eslint-disable-next-line no-console
      console.log("Connected to agent-control");
      this.startHeartbeat();
    });

    this.socket.on("disconnect", () => {
      this.stopHeartbeat();
    });

    this.socket.on("enrolled", async (payload: { nodeId: string; nodeToken: string }) => {
      this.state = {
        nodeId: payload.nodeId,
        nodeToken: payload.nodeToken
      };
      await this.saveState(this.state);
      // eslint-disable-next-line no-console
      console.log(`Agent enrolled as ${payload.nodeId}`);
    });

    this.socket.on("command", async (command: CommandEnvelope) => {
      await this.handleCommand(command);
    });
  }

  private async handleCommand(command: CommandEnvelope) {
    try {
      const result = await this.executeCommand(command.type, command.payload);
      this.socket.emit("command_result", {
        jobId: command.jobId,
        success: true,
        result
      });
    } catch (error) {
      this.socket.emit("command_result", {
        jobId: command.jobId,
        success: false,
        result: (error as Error).message
      });
    }
  }

  private async executeCommand(type: string, payload: Record<string, unknown>) {
    switch (type) {
      case "app.start": {
        const composePath = String(payload.composePath);
        const serviceName = String(payload.serviceName);
        const appId = String(payload.appId);
        const result = await this.dockerService.start(composePath, serviceName);
        this.startStreamingLogs(appId, composePath, serviceName);
        return result;
      }
      case "app.stop": {
        const composePath = String(payload.composePath);
        const serviceName = String(payload.serviceName);
        const appId = String(payload.appId);
        const result = await this.dockerService.stop(composePath, serviceName);
        this.logForwarder.stop(appId);
        return result;
      }
      case "app.restart": {
        const composePath = String(payload.composePath);
        const serviceName = String(payload.serviceName);
        const appId = String(payload.appId);
        const result = await this.dockerService.restart(composePath, serviceName);
        this.startStreamingLogs(appId, composePath, serviceName);
        return result;
      }
      case "app.deploy": {
        const deployPayload = payload as unknown as Parameters<DeployService["deploy"]>[0];
        const deployResult = await this.deployService.deploy(deployPayload, (stage, message) => {
          this.socket.emit("deploy_progress", {
            appId: deployPayload.app.id,
            deployJobId: String(payload.deployJobId),
            stage,
            message
          });
        });
        this.startStreamingLogs(
          deployPayload.app.id,
          deployResult.composeFile,
          deployResult.serviceName
        );
        return deployResult;
      }
      case "tunnel.sync": {
        const services = (payload.services as Array<{ serviceName: string; targetPort: number }>) ?? [];
        return this.tunnelService.sync({ services });
      }
      default:
        throw new Error(`Unsupported command: ${type}`);
    }
  }

  private startStreamingLogs(appId: string, composePath: string, serviceName: string) {
    this.logForwarder.start(appId, composePath, serviceName, (line) => {
      this.socket.emit("log_line", {
        appId: line.appId,
        stream: line.stream,
        line: line.line,
        ts: new Date().toISOString()
      });
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.socket.emit("heartbeat");
    }, this.config.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private buildAuthPayload() {
    if (this.state.nodeId && this.state.nodeToken) {
      return {
        nodeId: this.state.nodeId,
        nodeToken: this.state.nodeToken,
        agentVersion: this.config.AGENT_VERSION
      };
    }

    if (!this.config.ENROLLMENT_TOKEN) {
      throw new Error("ENROLLMENT_TOKEN is required for first startup");
    }

    return {
      enrollmentToken: this.config.ENROLLMENT_TOKEN,
      nodeName: this.config.AGENT_NODE_NAME,
      agentVersion: this.config.AGENT_VERSION
    };
  }

  private async loadState(): Promise<AgentState> {
    const statePath = resolve(this.config.AGENT_STATE_FILE);
    if (!existsSync(statePath)) {
      return {};
    }
    const content = await readFile(statePath, "utf8");
    return JSON.parse(content) as AgentState;
  }

  private async saveState(state: AgentState) {
    const statePath = resolve(this.config.AGENT_STATE_FILE);
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  }
}
