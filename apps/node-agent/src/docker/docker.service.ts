import Docker from "dockerode";

import { runCommand } from "../utils/exec";

export class DockerService {
  private readonly docker = new Docker();

  async start(composePath: string, serviceName: string) {
    await runCommand(`docker compose -f "${composePath}" up -d "${serviceName}"`);
    return { ok: true };
  }

  async stop(composePath: string, serviceName: string) {
    await runCommand(`docker compose -f "${composePath}" stop "${serviceName}"`);
    return { ok: true };
  }

  async restart(composePath: string, serviceName: string) {
    await runCommand(`docker compose -f "${composePath}" restart "${serviceName}"`);
    return { ok: true };
  }

  async listContainersByService(serviceName: string) {
    const containers = await this.docker.listContainers({ all: true });
    return containers.filter((container) =>
      container.Names.some((name) => name.toLowerCase().includes(serviceName.toLowerCase()))
    );
  }
}
