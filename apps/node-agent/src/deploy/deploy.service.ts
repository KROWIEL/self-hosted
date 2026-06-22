import axios from "axios";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { AgentConfig } from "../config";
import { runCommand } from "../utils/exec";

type DeploymentPayload = {
  app: {
    id: string;
    name: string;
    repoUrl: string;
    branch: string;
    composePath: string;
    serviceName: string;
    healthcheckUrl?: string | null;
    cpuLimit?: string;
    memoryLimit?: string;
  };
  gitRef: string;
  envVars: Array<{ key: string; value: string; isSecret: boolean }>;
  gitCredentials: Array<{ type: "pat" | "ssh_key"; username?: string | null; secret: string }>;
};

export class DeployService {
  constructor(private readonly config: AgentConfig) {}

  async deploy(payload: DeploymentPayload, onProgress: (stage: string, message: string) => void) {
    const appDir = resolve(this.config.AGENT_WORKDIR, payload.app.id);
    await mkdir(appDir, { recursive: true });

    const repoUrl = this.decorateRepoUrl(payload.app.repoUrl, payload.gitCredentials);
    const hasGit = await this.pathExists(join(appDir, ".git"));

    if (!hasGit) {
      onProgress("git_clone", `Cloning ${payload.app.repoUrl}`);
      await runCommand(`git clone "${repoUrl}" "${appDir}"`);
    } else {
      onProgress("git_fetch", "Fetching latest refs");
      await runCommand("git fetch --all --tags", appDir);
    }

    onProgress("git_checkout", `Checking out ${payload.gitRef}`);
    await runCommand(`git checkout "${payload.gitRef}"`, appDir);
    await runCommand(`git reset --hard "${payload.gitRef}"`, appDir);

    const envFilePath = join(appDir, ".env.selfhosted");
    const envText = payload.envVars.map((entry) => `${entry.key}=${this.escapeEnvValue(entry.value)}`).join("\n");
    await writeFile(envFilePath, `${envText}\n`, "utf8");

    const composeFile = resolve(appDir, payload.app.composePath);
    onProgress("compose_build", `Building ${payload.app.serviceName}`);
    await runCommand(
      `docker compose --env-file "${envFilePath}" -f "${composeFile}" build "${payload.app.serviceName}"`,
      dirname(composeFile)
    );

    onProgress("compose_up", `Starting ${payload.app.serviceName}`);
    await runCommand(
      `docker compose --env-file "${envFilePath}" -f "${composeFile}" up -d "${payload.app.serviceName}"`,
      dirname(composeFile)
    );

    if (payload.app.healthcheckUrl) {
      await this.waitForHealthcheck(payload.app.healthcheckUrl, onProgress);
    }

    onProgress("done", "Deployment finished");
    return {
      appId: payload.app.id,
      composeFile,
      serviceName: payload.app.serviceName
    };
  }

  private decorateRepoUrl(repoUrl: string, credentials: DeploymentPayload["gitCredentials"]) {
    const patCredential = credentials.find((credential) => credential.type === "pat");
    if (!patCredential) {
      return repoUrl;
    }
    try {
      const url = new URL(repoUrl);
      const username = patCredential.username ?? "x-access-token";
      url.username = encodeURIComponent(username);
      url.password = encodeURIComponent(patCredential.secret);
      return url.toString();
    } catch {
      return repoUrl;
    }
  }

  private async waitForHealthcheck(url: string, onProgress: (stage: string, message: string) => void) {
    const deadline = Date.now() + 60_000;
    let lastError = "unknown";
    while (Date.now() < deadline) {
      try {
        const response = await axios.get(url, {
          timeout: 4_000
        });
        if (response.status >= 200 && response.status < 400) {
          onProgress("healthcheck", `Healthy: ${url}`);
          return;
        }
        lastError = `Status ${response.status}`;
      } catch (error) {
        lastError = (error as Error).message;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
    }
    throw new Error(`Healthcheck failed for ${url}: ${lastError}`);
  }

  private escapeEnvValue(value: string) {
    if (/[\s#"'`]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }

  private async pathExists(path: string) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
