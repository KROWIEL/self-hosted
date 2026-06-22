import { Injectable } from "@nestjs/common";
import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface TunnelServiceInput {
  serviceName: string;
  bindPort: number;
}

@Injectable()
export class TunnelConfigService {
  private readonly serverConfigPath =
    process.env.RATHOLE_SERVER_CONFIG_PATH ?? "/etc/rathole/server.toml";
  private readonly reloadCommand =
    process.env.RATHOLE_RELOAD_COMMAND ?? "systemctl reload rathole-server";

  async syncServerConfig(services: TunnelServiceInput[]) {
    const configText = this.renderServerConfig(services);
    await mkdir(dirname(this.serverConfigPath), { recursive: true });
    await writeFile(this.serverConfigPath, configText, "utf8");
    await execAsync(this.reloadCommand);
  }

  private renderServerConfig(services: TunnelServiceInput[]) {
    const header = [
      "[server]",
      'bind_addr = "0.0.0.0:2333"',
      `default_token = "${process.env.CONTROL_CHANNEL_SHARED_SECRET ?? "self-hosted"}"`,
      ""
    ];

    const serviceSections = services.flatMap((service) => [
      `[server.services.${service.serviceName}]`,
      `bind_addr = "0.0.0.0:${service.bindPort}"`,
      ""
    ]);

    return [...header, ...serviceSections].join("\n");
  }
}
