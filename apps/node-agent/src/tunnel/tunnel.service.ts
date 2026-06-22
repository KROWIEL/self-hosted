import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { AgentConfig } from "../config";
import { runCommand } from "../utils/exec";

export class TunnelService {
  constructor(private readonly config: AgentConfig) {}

  async sync(input: { services: Array<{ serviceName: string; targetPort: number }> }) {
    const configText = this.renderClientConfig(input.services);
    await mkdir(dirname(this.config.RATHOLE_CLIENT_CONFIG_PATH), { recursive: true });
    await writeFile(this.config.RATHOLE_CLIENT_CONFIG_PATH, configText, "utf8");
    await runCommand(this.config.RATHOLE_CLIENT_RELOAD_COMMAND);
    return {
      updatedServices: input.services.length
    };
  }

  private renderClientConfig(services: Array<{ serviceName: string; targetPort: number }>) {
    const lines: string[] = [
      "[client]",
      `remote_addr = "${this.config.RATHOLE_SERVER_ADDR}"`,
      `default_token = "${this.config.CONTROL_CHANNEL_SHARED_SECRET}"`,
      ""
    ];

    for (const service of services) {
      lines.push(`[client.services.${service.serviceName}]`);
      lines.push(`local_addr = "127.0.0.1:${service.targetPort}"`);
      lines.push("");
    }

    return lines.join("\n");
  }
}
