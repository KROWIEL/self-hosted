export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---- Domain types (mirror the control plane responses) ----

export type ServiceType = 'BACKEND' | 'FRONTEND';
export type ServiceStatus =
  | 'CREATED'
  | 'BUILDING'
  | 'RUNNING'
  | 'STOPPED'
  | 'ERROR';
export type DeployStatus =
  | 'QUEUED'
  | 'BUILDING'
  | 'DEPLOYING'
  | 'SUCCESS'
  | 'FAILED';

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  projectId: string;
  nodeId: string;
  templateId: string;
  repoUrl: string;
  branch: string;
  useRepoDockerfile: boolean;
  port: number | null;
  cpuLimit: number;
  memLimit: number;
  gitCredId: string | null;
  containerId: string | null;
  currentImage: string | null;
  zeroDowntime: boolean;
  activeColor: string | null;
  healthcheckPath: string | null;
  healthTimeoutS: number;
  // Present only on the detail endpoint (getService).
  node?: { id: string; name: string; fqdn: string; agentPort: number } | null;
  template?: {
    id: string;
    name: string;
    defaultPort: number;
    type: ServiceType;
  } | null;
  domain?: { host: string; https: boolean } | null;
}

export interface UpdateServiceBody {
  name?: string;
  repoUrl?: string;
  branch?: string;
  gitCredId?: string;
  useRepoDockerfile?: boolean;
  port?: number;
  cpuLimit?: number;
  memLimit?: number;
  zeroDowntime?: boolean;
  healthcheckPath?: string;
  healthTimeoutS?: number;
}

export interface Project {
  id: string;
  name: string;
  cpuLimit: number;
  memLimit: number;
  createdAt: string;
  services: Service[];
}

export interface Node {
  id: string;
  name: string;
  fqdn: string;
  agentPort: number;
  cpuTotal: number | null;
  memTotal: number | null;
  status: 'ONLINE' | 'OFFLINE';
  createdAt: string;
}

export interface NodeWithToken extends Node {
  daemonTokenPlaintext: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  defaultPort: number;
  isBuiltIn: boolean;
}

export interface Deployment {
  id: string;
  serviceId: string;
  status: DeployStatus;
  commitSha: string | null;
  imageTag: string | null;
  buildLog: string | null;
  errorMsg: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export type GitProvider = 'GITHUB' | 'GITLAB';

export interface GitCredential {
  id: string;
  name: string;
  provider: GitProvider;
  username: string | null;
  createdAt: string;
}

// ---- Auth token storage ----

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('accessToken');
}

export function isAuthed(): boolean {
  return getToken() !== null;
}

export function logout() {
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
}

// ---- Core fetch helper ----

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- Auth ----

export async function login(email: string, password: string) {
  const tokens = await api<{ accessToken: string; refreshToken: string }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  window.localStorage.setItem('accessToken', tokens.accessToken);
  window.localStorage.setItem('refreshToken', tokens.refreshToken);
  return tokens;
}

// ---- Projects ----

export const listProjects = () => api<Project[]>('/projects');
export const getProject = (id: string) => api<Project>(`/projects/${id}`);
export const createProject = (body: {
  name: string;
  cpuLimit?: number;
  memLimit?: number;
}) => api<Project>('/projects', { method: 'POST', body: JSON.stringify(body) });
export const updateProjectLimits = (
  id: string,
  body: { cpuLimit: number; memLimit: number },
) =>
  api<Project>(`/projects/${id}/limits`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const deleteProject = (id: string) =>
  api<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' });

export interface PlatformResourceSummary {
  nodes: number;
  projects: number;
  services: number;
  hostCpuCores: number;
  hostMemMb: number;
  capacityCpu: number;
  capacityMemMb: number;
  projectCpuLimit: number;
  projectMemLimit: number;
  serviceCpuAllocated: number;
  serviceMemAllocated: number;
  availableProjectCpu: number;
  availableProjectMemMb: number;
  currentCpuPerc: number;
  currentMemMb: number;
}

export const getPlatformResourceSummary = () =>
  api<PlatformResourceSummary>('/projects/resource-summary/platform');

// ---- Nodes ----

export const listNodes = () => api<Node[]>('/nodes');
export const createNode = (body: {
  name: string;
  fqdn: string;
  agentPort?: number;
  cpuTotal?: number;
  memTotal?: number;
}) =>
  api<NodeWithToken>('/nodes', { method: 'POST', body: JSON.stringify(body) });
export const updateNodeCapacity = (
  id: string,
  body: { cpuTotal: number; memTotal: number },
) =>
  api<Node>(`/nodes/${id}/capacity`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const deleteNode = (id: string) =>
  api<{ ok: boolean }>(`/nodes/${id}`, { method: 'DELETE' });

export interface AgentStatus {
  enabled: boolean;
  running: boolean;
  startedAt: string | null;
  logs: string[];
}

export const startNodeAgent = (id: string) =>
  api<AgentStatus>(`/nodes/${id}/agent/start`, { method: 'POST' });
export const stopNodeAgent = (id: string) =>
  api<{ running: boolean }>(`/nodes/${id}/agent/stop`, { method: 'POST' });
export const nodeAgentStatus = (id: string) =>
  api<AgentStatus>(`/nodes/${id}/agent/status`);

// ---- Templates ----

export const listTemplates = () => api<Template[]>('/templates');

// ---- Git credentials ----

export const listGitCredentials = () =>
  api<GitCredential[]>('/git-credentials');
export const createGitCredential = (body: {
  name: string;
  provider: GitProvider;
  username?: string;
  pat: string;
}) =>
  api<GitCredential>('/git-credentials', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const verifyGitCredential = (id: string, repoUrl: string) =>
  api<{ ok: boolean; message: string }>(`/git-credentials/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl }),
  });
export const deleteGitCredential = (id: string) =>
  api<{ ok: boolean }>(`/git-credentials/${id}`, { method: 'DELETE' });

// ---- Services ----

export interface CreateServiceBody {
  name: string;
  type: ServiceType;
  nodeId: string;
  templateId: string;
  repoUrl: string;
  branch?: string;
  gitCredId?: string;
  useRepoDockerfile?: boolean;
  port?: number;
  cpuLimit?: number;
  memLimit?: number;
  env?: Record<string, string>;
}

export const getService = (id: string) => api<Service>(`/services/${id}`);
export const createService = (projectId: string, body: CreateServiceBody) =>
  api<Service>(`/projects/${projectId}/services`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const deleteService = (id: string) =>
  api<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' });
export const deployService = (id: string) =>
  api<Deployment>(`/services/${id}/deploy`, { method: 'POST' });
export const listDeployments = (id: string) =>
  api<Deployment[]>(`/services/${id}/deployments`);
export const powerService = (
  id: string,
  action: 'start' | 'stop' | 'restart',
) => api<Service>(`/services/${id}/${action}`, { method: 'POST' });
/**
 * Opens the live runtime log stream for a service. Returns the raw Response so
 * the caller can read `response.body` as a ReadableStream.
 */
export async function streamServiceLogs(
  id: string,
  signal?: AbortSignal,
): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_URL}/services/${id}/logs/stream`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`API ${res.status}`);
  }
  return res;
}

/**
 * Builds the WebSocket URL for an interactive container shell. The access token
 * is passed as a query param because browsers can't set WS headers.
 */
export function execSocketUrl(serviceId: string): string {
  const token = getToken() ?? '';
  const wsBase = API_URL.replace(/^http/, 'ws');
  return `${wsBase}/services/${serviceId}/exec?token=${encodeURIComponent(token)}`;
}

/** Opens the live build-log stream for a deployment (see streamServiceLogs). */
export async function streamDeploymentLogs(
  deploymentId: string,
  signal?: AbortSignal,
): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_URL}/deployments/${deploymentId}/logs/stream`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`API ${res.status}`);
  }
  return res;
}

export interface ServiceStats {
  running: boolean;
  state: string;
  error?: string;
  health?: string;
  cpuPerc?: string;
  memUsage?: string;
  memPerc?: string;
  netIO?: string;
  blockIO?: string;
  pids?: string;
}

export const getServiceStats = (id: string) =>
  api<ServiceStats>(`/services/${id}/stats`);

export interface NodeSystem {
  version: string;
  reachable?: boolean;
  error?: string;
  containersRunning?: number;
  containersTotal?: number;
  imagesCount?: string;
  imagesSize?: string;
  imagesReclaimable?: string;
  volumesSize?: string;
  buildCacheSize?: string;
}

export const getNodeSystem = (id: string) =>
  api<NodeSystem>(`/nodes/${id}/system`);

export interface NodeStats {
  reachable: boolean;
  /** Aggregate CPU across all containers, in Docker units (100 = one core). */
  cpuPerc: number;
  /** Aggregate used memory across all containers, in MB. */
  memUsageMb: number;
  containers: number;
}

export const getNodeStats = (id: string) =>
  api<NodeStats>(`/nodes/${id}/stats`);

export interface NodePruneResult {
  ok: boolean;
  error?: string;
  system?: string;
  builder?: string;
  volumes?: string;
  imagesReclaimable?: string;
}

export const pruneNode = (
  id: string,
  opts: { all?: boolean; volumes?: boolean } = {},
) =>
  api<NodePruneResult>(`/nodes/${id}/prune`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });

export interface NodeWorkloadService {
  id: string;
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  projectId: string;
  projectName: string | null;
}

export interface NodeWorkloadDatabase {
  id: string;
  name: string;
  engine: DbEngine;
  status: ServiceStatus;
  projectId: string;
  projectName: string | null;
}

export interface NodeWorkloads {
  services: NodeWorkloadService[];
  databases: NodeWorkloadDatabase[];
}

export const getNodeWorkloads = (id: string) =>
  api<NodeWorkloads>(`/nodes/${id}/workloads`);

export interface ProjectResourceSummary {
  servicesTotal: number;
  servicesRunning: number;
  allocatedCpu: number;
  allocatedMemMb: number;
  cpuLimit: number;
  memLimit: number;
  availableCpu: number;
  availableMemMb: number;
  currentCpuPerc: number;
  currentMemMb: number;
  partial: boolean;
  unavailable: { serviceId: string; name: string; error: string }[];
}

export const getProjectResourceSummary = (id: string) =>
  api<ProjectResourceSummary>(`/projects/${id}/resource-summary`);

export const updateService = (id: string, body: UpdateServiceBody) =>
  api<Service>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const rollbackDeployment = (deploymentId: string) =>
  api<Deployment>(`/deployments/${deploymentId}/rollback`, { method: 'POST' });

export const getWebhook = (id: string) =>
  api<{ token: string; path: string }>(`/services/${id}/webhook`);

export const listEnv = (id: string) => api<EnvVar[]>(`/services/${id}/env`);
export const setEnv = (
  id: string,
  vars: { key: string; value: string; isSecret?: boolean }[],
) =>
  api<EnvVar[]>(`/services/${id}/env`, {
    method: 'PUT',
    body: JSON.stringify({ vars }),
  });
export const deleteEnv = (id: string, key: string) =>
  api<EnvVar[]>(`/services/${id}/env/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });

// ---- Repo auto-setup (scan .env.example + databases) ----

export type DbRole = 'url' | 'host' | 'port' | 'name' | 'user' | 'password';

export interface InspectEnvKey {
  key: string;
  example: string;
  dbRole?: DbRole;
  dbName?: string;
}

export interface DatabaseNeed {
  engine: DbEngine;
  schemas: string[];
}

export interface RepoInspect {
  envFile: string;
  envKeys: InspectEnvKey[];
  databases: DatabaseNeed[];
  existingKeys: string[];
}

export const inspectRepo = (serviceId: string) =>
  api<RepoInspect>(`/services/${serviceId}/inspect`);
export const setupFromRepo = (
  serviceId: string,
  body: { databases: DatabaseNeed[]; envKeys: InspectEnvKey[] },
) =>
  api<{ databases: ManagedDatabase[]; envSet: number }>(
    `/services/${serviceId}/setup`,
    { method: 'POST', body: JSON.stringify(body) },
  );
export const setDomain = (id: string, host: string, https = true) =>
  api<unknown>(`/services/${id}/domain`, {
    method: 'PUT',
    body: JSON.stringify({ host, https }),
  });

// ---- Persistent volumes ----

export interface Volume {
  id: string;
  serviceId: string;
  name: string;
  mountPath: string;
  createdAt: string;
}

export const listVolumes = (serviceId: string) =>
  api<Volume[]>(`/services/${serviceId}/volumes`);
export const addVolume = (serviceId: string, mountPath: string) =>
  api<Volume>(`/services/${serviceId}/volumes`, {
    method: 'POST',
    body: JSON.stringify({ mountPath }),
  });
export const removeVolume = (serviceId: string, volumeId: string) =>
  api<{ ok: boolean }>(`/services/${serviceId}/volumes/${volumeId}`, {
    method: 'DELETE',
  });

// ---- Managed databases ----

export type DbEngine = 'POSTGRES' | 'MYSQL';

export interface ManagedDatabase {
  id: string;
  projectId: string;
  nodeId: string;
  name: string;
  engine: DbEngine;
  version: string;
  status: ServiceStatus;
  host: string;
  port: number;
  dbName: string;
  username: string;
}

export interface DbCredentials {
  host: string;
  port: number;
  dbName: string;
  username: string;
  password: string;
  url: string;
}

export interface DbStatus {
  running: boolean;
  state: string;
  ready: boolean;
}

export interface CreateDatabaseBody {
  name: string;
  engine: DbEngine;
  version?: string;
  nodeId: string;
  dbName?: string;
  username?: string;
}

export const listDatabases = (projectId: string) =>
  api<ManagedDatabase[]>(`/projects/${projectId}/databases`);
export const createDatabase = (projectId: string, body: CreateDatabaseBody) =>
  api<ManagedDatabase>(`/projects/${projectId}/databases`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const databaseStatus = (id: string) =>
  api<DbStatus>(`/databases/${id}/status`);
export const databaseCredentials = (id: string) =>
  api<DbCredentials>(`/databases/${id}/credentials`);
export const powerDatabase = (id: string, action: 'start' | 'stop' | 'restart') =>
  api<ManagedDatabase>(`/databases/${id}/power`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
export const attachDatabase = (id: string, serviceId: string) =>
  api<{ ok: boolean }>(`/databases/${id}/attach`, {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  });
export const deleteDatabase = (id: string, keepVolume: boolean) =>
  api<{ ok: boolean }>(
    `/databases/${id}?keepVolume=${keepVolume ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );

// ---- Backups ----

export type BackupKind = 'VOLUME' | 'DATABASE';
export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface Backup {
  id: string;
  kind: BackupKind;
  refId: string;
  nodeId: string;
  fileName: string;
  sizeBytes: number | null;
  status: BackupStatus;
  errorMsg: string | null;
  createdAt: string;
}

export interface BackupSchedule {
  id: string;
  kind: BackupKind;
  refId: string;
  cron: string;
  keepLast: number;
  enabled: boolean;
  createdAt: string;
}

export const listBackups = (kind: BackupKind, refId: string) =>
  api<Backup[]>(`/backups?kind=${kind}&refId=${refId}`);
export const createBackup = (kind: BackupKind, refId: string) =>
  api<Backup>('/backups', {
    method: 'POST',
    body: JSON.stringify({ kind, refId }),
  });
export const restoreBackup = (id: string) =>
  api<{ ok: boolean }>(`/backups/${id}/restore`, { method: 'POST' });
export const deleteBackup = (id: string) =>
  api<{ ok: boolean }>(`/backups/${id}`, { method: 'DELETE' });

/** Streams a backup file to the browser as a download (auth via header). */
export async function downloadBackup(id: string, fileName: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}/backups/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const listBackupSchedules = (kind: BackupKind, refId: string) =>
  api<BackupSchedule[]>(`/backup-schedules?kind=${kind}&refId=${refId}`);
export const createBackupSchedule = (body: {
  kind: BackupKind;
  refId: string;
  cron: string;
  keepLast?: number;
}) =>
  api<BackupSchedule>('/backup-schedules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const deleteBackupSchedule = (id: string) =>
  api<{ ok: boolean }>(`/backup-schedules/${id}`, { method: 'DELETE' });

// ---- Tunnels (exposure via public VDS relay) ----

export interface Tunnel {
  id: string;
  name: string;
  serverHost: string;
  controlPort: number;
  relayPorts: string;
  targetHost: string;
  proxyProtocol: boolean;
  enabled: boolean;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string | null;
  running: boolean;
  connected: boolean;
  createdAt: string;
}

export interface TunnelStatus {
  enabled: boolean;
  running: boolean;
  connected: boolean;
  status: 'ONLINE' | 'OFFLINE';
  startedAt: string | null;
  logs: string[];
}

export interface TunnelInstall extends Tunnel {
  token: string;
  serverAddr: string;
  binUrls: Record<string, string>;
  commands: { linux: string; windows: string };
  offline: { download: string; copy: string; run: string };
}

export interface CreateTunnelBody {
  name: string;
  serverHost: string;
  controlPort?: number;
  relayPorts?: string;
  targetHost?: string;
  proxyProtocol?: boolean;
}

export const listTunnels = () => api<Tunnel[]>('/tunnels');
export const createTunnel = (body: CreateTunnelBody) =>
  api<Tunnel>('/tunnels', { method: 'POST', body: JSON.stringify(body) });
export const updateTunnel = (id: string, body: Partial<CreateTunnelBody>) =>
  api<Tunnel>(`/tunnels/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteTunnel = (id: string) =>
  api<{ ok: boolean }>(`/tunnels/${id}`, { method: 'DELETE' });
export const startTunnel = (id: string) =>
  api<TunnelStatus>(`/tunnels/${id}/start`, { method: 'POST' });
export const stopTunnel = (id: string) =>
  api<TunnelStatus>(`/tunnels/${id}/stop`, { method: 'POST' });
export const tunnelStatus = (id: string) =>
  api<TunnelStatus>(`/tunnels/${id}/status`);
export const tunnelInstall = (id: string) =>
  api<TunnelInstall>(`/tunnels/${id}/install`);
