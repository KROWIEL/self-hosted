import { Injectable } from '@nestjs/common';
import { PowerAction } from '@selfhosted/shared';
import { nodes } from '../../db/schema';
import { CryptoService } from '../../common/crypto/crypto.service';

export type NodeRow = typeof nodes.$inferSelect;

export interface AgentBuildInput {
  serviceId: string;
  repoUrl: string;
  branch: string;
  patToken?: string;
  gitUsername?: string;
  /** Image with build tooling (maven/node). Passed as a Docker build-arg. */
  buildImage: string;
  /** Runtime base image. Passed as a Docker build-arg. */
  runImage: string;
  /** Template Dockerfile path (relative to the agent templates dir). */
  dockerfile?: string;
  /** Prefer the repo's own Dockerfile (if present) over the template. */
  useRepoDockerfile?: boolean;
  imageTag: string;
}

export interface AgentBuildResult {
  commitSha: string;
  imageTag: string;
  buildLog: string;
}

export interface AgentSystem {
  version: string;
  containersRunning?: number;
  containersTotal?: number;
  imagesCount?: string;
  imagesSize?: string;
  imagesReclaimable?: string;
  volumesSize?: string;
  buildCacheSize?: string;
}

export interface AgentStats {
  running: boolean;
  state: string;
  health?: string;
  cpuPerc?: string;
  memUsage?: string;
  memPerc?: string;
  netIO?: string;
  blockIO?: string;
  pids?: string;
}

export interface AgentVolumeMount {
  name: string;
  mountPath: string;
}

export interface AgentRunInput {
  serviceId: string;
  image: string;
  port: number;
  cpuLimit: number;
  memLimit: number;
  env: Record<string, string>;
  domain?: string;
  https?: boolean;
  network?: string;
  volumes?: AgentVolumeMount[];
}

export interface AgentDbCreateInput {
  container: string;
  volume: string;
  image: string;
  network?: string;
  dataDir: string;
  internalPort: number;
  env: Record<string, string>;
}

export interface AgentDbStatus {
  running: boolean;
  state: string;
  ready: boolean;
}

export interface AgentInspectInput {
  repoUrl: string;
  branch: string;
  patToken?: string;
  workId: string;
}

export interface AgentEnvKey {
  key: string;
  example: string;
  dbRole?: 'url' | 'host' | 'port' | 'name' | 'user' | 'password';
  dbName?: string;
}

export interface AgentDatabaseNeed {
  engine: 'POSTGRES' | 'MYSQL';
  schemas: string[];
}

export interface AgentInspectResult {
  envFile: string;
  envKeys: AgentEnvKey[];
  databases: AgentDatabaseNeed[];
}

export interface AgentSchemaInput {
  container: string;
  engine: string;
  user: string;
  password: string;
  schema: string;
}

export interface AgentBackupInput {
  kind: 'VOLUME' | 'DATABASE';
  file: string;
  volume?: string;
  container?: string;
  engine?: string;
  user?: string;
  password?: string;
  dbName?: string;
}

/**
 * Thin HTTP client the control plane uses to talk to a node agent.
 * Requests are authorized with the node's daemon token (decrypted at call time).
 * Set AGENT_INSECURE_HTTP=1 for local dev against an http agent.
 */
@Injectable()
export class AgentClient {
  constructor(private readonly crypto: CryptoService) {}

  private baseUrl(node: NodeRow): string {
    const scheme = process.env.AGENT_INSECURE_HTTP === '1' ? 'http' : 'https';
    return `${scheme}://${node.fqdn}:${node.agentPort}/api`;
  }

  private async request<T>(
    node: NodeRow,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = this.crypto.decrypt(node.daemonToken);
    const res = await fetch(`${this.baseUrl(node)}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(
        `Agent ${node.name} responded ${res.status}: ${await res.text()}`,
      );
    }
    return (await res.json()) as T;
  }

  getSystem(node: NodeRow) {
    return this.request<AgentSystem>(node, '/system');
  }

  /** Clones the repo on the node and detects env keys + databases. */
  inspect(node: NodeRow, input: AgentInspectInput) {
    return this.request<AgentInspectResult>(node, '/inspect', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Creates an additional schema inside an existing managed DB container. */
  createSchema(node: NodeRow, input: AgentSchemaInput) {
    return this.request<{ ok: boolean; error?: string }>(
      node,
      '/databases/schema',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  /**
   * Elevates the managed DB's app user so it can create/manage additional
   * schemas at runtime (multi-tenant apps). Scoped to the dedicated container.
   */
  grantPrivileges(
    node: NodeRow,
    input: { container: string; engine: string; user: string; password: string },
  ) {
    return this.request<{ ok: boolean; error?: string }>(
      node,
      '/databases/grant',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  getStats(node: NodeRow, serviceId: string) {
    return this.request<AgentStats>(node, `/servers/${serviceId}/stats`);
  }

  /** Removes stale images of a service, keeping `keepImage`. Best-effort. */
  gc(node: NodeRow, serviceId: string, keepImage: string) {
    return this.request<{ ok: boolean; removed: number }>(
      node,
      `/servers/${serviceId}/gc`,
      { method: 'POST', body: JSON.stringify({ keepImage }) },
    );
  }

  /**
   * Triggers a build on the node. The agent streams build output as
   * newline-delimited text and ends with a single JSON result line.
   *
   * When `onChunk` is supplied, build output lines are forwarded live as they
   * arrive (the trailing JSON result line is held back and never emitted).
   */
  async build(
    node: NodeRow,
    input: AgentBuildInput,
    onChunk?: (text: string) => void,
  ): Promise<AgentBuildResult> {
    const token = this.crypto.decrypt(node.daemonToken);
    const res = await fetch(
      `${this.baseUrl(node)}/servers/${input.serviceId}/build`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoUrl: input.repoUrl,
          branch: input.branch,
          patToken: input.patToken ?? '',
          gitUsername: input.gitUsername ?? '',
          buildImage: input.buildImage,
          runImage: input.runImage,
          dockerfile: input.dockerfile ?? '',
          useRepoDockerfile: input.useRepoDockerfile ?? false,
          imageTag: input.imageTag,
        }),
      },
    );

    const text = await this.readBuildStream(res, onChunk);
    if (!res.ok) {
      throw new Error(`Agent ${node.name} build HTTP ${res.status}: ${text}`);
    }

    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const last = lines[lines.length - 1] ?? '{}';
    let result: { commitSha?: string; error?: string };
    try {
      result = JSON.parse(last);
    } catch {
      throw new Error(`Agent ${node.name} build: malformed response`);
    }
    const buildLog = lines.slice(0, -1).join('\n');
    if (result.error) {
      const err = new Error(result.error) as Error & { buildLog?: string };
      err.buildLog = buildLog;
      throw err;
    }
    return {
      commitSha: result.commitSha ?? '',
      imageTag: input.imageTag,
      buildLog,
    };
  }

  /**
   * Reads the full build response, optionally forwarding completed output lines
   * to `onChunk` as they stream in. The final JSON result line is withheld (a
   * one-line lag) so callers never see the machine-readable result in the log.
   */
  private async readBuildStream(
    res: Response,
    onChunk?: (text: string) => void,
  ): Promise<string> {
    if (!res.body) return res.text();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buf = '';
    let held: string | null = null;
    const flushHeld = () => {
      if (held !== null) {
        onChunk?.(held + '\n');
        held = null;
      }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      full += decoded;
      if (!onChunk) continue;
      buf += decoded;
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const line of parts) {
        flushHeld();
        held = line;
      }
    }
    return full;
  }

  run(node: NodeRow, input: AgentRunInput) {
    return this.request<{ ok: boolean; containerId: string; error?: string }>(
      node,
      `/servers/${input.serviceId}/run`,
      {
        method: 'POST',
        body: JSON.stringify({
          image: input.image,
          port: input.port,
          cpuLimit: input.cpuLimit,
          memLimit: input.memLimit,
          env: input.env,
          domain: input.domain ?? '',
          https: input.https ?? false,
          network: input.network ?? '',
          volumes: input.volumes ?? [],
        }),
      },
    );
  }

  /** Creates the volume + container for a managed database on the node. */
  createDatabase(node: NodeRow, input: AgentDbCreateInput) {
    return this.request<{ ok: boolean; containerId?: string; error?: string }>(
      node,
      '/databases',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  powerDatabase(node: NodeRow, container: string, action: string) {
    return this.request<{ ok: boolean; error?: string }>(node, '/databases/power', {
      method: 'POST',
      body: JSON.stringify({ container, action: action.toLowerCase() }),
    });
  }

  removeDatabase(
    node: NodeRow,
    container: string,
    volume: string,
    keepVolume: boolean,
  ) {
    return this.request<{ ok: boolean }>(node, '/databases', {
      method: 'DELETE',
      body: JSON.stringify({ container, volume, keepVolume }),
    });
  }

  databaseStatus(
    node: NodeRow,
    input: {
      container: string;
      engine: string;
      user: string;
      password: string;
      dbName: string;
    },
  ) {
    return this.request<AgentDbStatus>(node, '/databases/status', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Removes a Docker named volume on the node (no-op if still in use). */
  removeVolume(node: NodeRow, name: string) {
    return this.request<{ ok: boolean }>(node, '/volumes', {
      method: 'DELETE',
      body: JSON.stringify({ name }),
    });
  }

  backup(node: NodeRow, input: AgentBackupInput) {
    return this.request<{ ok: boolean; sizeBytes?: number; error?: string }>(
      node,
      '/backups',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  restoreBackup(node: NodeRow, input: AgentBackupInput) {
    return this.request<{ ok: boolean; error?: string }>(
      node,
      '/backups/restore',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  deleteBackup(node: NodeRow, file: string) {
    return this.request<{ ok: boolean }>(node, '/backups', {
      method: 'DELETE',
      body: JSON.stringify({ file }),
    });
  }

  /** Opens the raw download stream of a backup file from the node. */
  async downloadBackup(node: NodeRow, file: string, signal?: AbortSignal) {
    const token = this.crypto.decrypt(node.daemonToken);
    const res = await fetch(
      `${this.baseUrl(node)}/backups/download?file=${encodeURIComponent(file)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal },
    );
    if (!res.ok || !res.body) {
      throw new Error(`Agent ${node.name} download HTTP ${res.status}`);
    }
    return res;
  }

  power(node: NodeRow, serviceId: string, action: PowerAction) {
    return this.request<{ ok: boolean }>(
      node,
      `/servers/${serviceId}/power`,
      { method: 'POST', body: JSON.stringify({ action: action.toLowerCase() }) },
    );
  }

  remove(node: NodeRow, serviceId: string) {
    return this.request<{ ok: boolean }>(node, `/servers/${serviceId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Opens the agent's runtime log stream (`docker logs -f`). Returns the raw
   * fetch Response so the caller can pipe the body straight to the browser.
   */
  async streamLogs(
    node: NodeRow,
    serviceId: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const token = this.crypto.decrypt(node.daemonToken);
    const res = await fetch(`${this.baseUrl(node)}/servers/${serviceId}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Agent ${node.name} logs HTTP ${res.status}`);
    }
    return res;
  }
}
