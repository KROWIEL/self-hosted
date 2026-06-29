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
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  services: Service[];
}

export interface Node {
  id: string;
  name: string;
  fqdn: string;
  agentPort: number;
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
export const createProject = (name: string) =>
  api<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteProject = (id: string) =>
  api<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' });

// ---- Nodes ----

export const listNodes = () => api<Node[]>('/nodes');
export const createNode = (body: {
  name: string;
  fqdn: string;
  agentPort?: number;
}) =>
  api<NodeWithToken>('/nodes', { method: 'POST', body: JSON.stringify(body) });
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
export const setDomain = (id: string, host: string, https = true) =>
  api<unknown>(`/services/${id}/domain`, {
    method: 'PUT',
    body: JSON.stringify({ host, https }),
  });
