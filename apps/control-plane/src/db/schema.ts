import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums (mirror @selfhosted/shared).
export const roleEnum = pgEnum('role', ['ADMIN', 'USER']);
export const nodeStatusEnum = pgEnum('node_status', ['ONLINE', 'OFFLINE']);
export const gitProviderEnum = pgEnum('git_provider', ['GITHUB', 'GITLAB']);
export const serviceTypeEnum = pgEnum('service_type', ['BACKEND', 'FRONTEND']);
export const serviceStatusEnum = pgEnum('service_status', [
  'CREATED',
  'BUILDING',
  'RUNNING',
  'STOPPED',
  'ERROR',
]);
export const deployStatusEnum = pgEnum('deploy_status', [
  'QUEUED',
  'BUILDING',
  'DEPLOYING',
  'SUCCESS',
  'FAILED',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  totpSecret: text('totp_secret'),
  role: roleEnum('role').notNull().default('USER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/// A server running the Go agent that manages containers.
export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  fqdn: text('fqdn').notNull(),
  agentPort: integer('agent_port').notNull().default(8443),
  daemonToken: text('daemon_token').notNull(),
  publicKey: text('public_key'),
  status: nodeStatusEnum('status').notNull().default('OFFLINE'),
  cpuTotal: integer('cpu_total'),
  memTotal: integer('mem_total'),
  diskTotal: integer('disk_total'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/// Git credentials (PAT). PAT is encrypted at rest (AES-256-GCM).
export const gitCredentials = pgTable('git_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: gitProviderEnum('provider').notNull().default('GITHUB'),
  username: text('username'),
  patEnc: text('pat_enc').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/// A stack template describing how to build & run a service.
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  type: serviceTypeEnum('type').notNull(),
  baseImage: text('base_image').notNull(),
  dockerfilePath: text('dockerfile_path'),
  installImage: text('install_image').notNull(),
  installScript: text('install_script').notNull(),
  defaultBuildCommand: text('default_build_command').notNull(),
  defaultRunCommand: text('default_run_command').notNull(),
  defaultPort: integer('default_port').notNull().default(8080),
  healthcheckPath: text('healthcheck_path'),
  // JSON array of TemplateVariable (see @selfhosted/shared).
  variables: jsonb('variables').notNull().default(sql`'[]'::jsonb`),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/// A deployable unit (backend or frontend).
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: serviceTypeEnum('type').notNull(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => nodes.id),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id),
  repoUrl: text('repo_url').notNull(),
  branch: text('branch').notNull().default('main'),
  gitCredId: uuid('git_cred_id').references(() => gitCredentials.id),
  // When true, build from the repo's own Dockerfile (if present) instead of the
  // selected template's Dockerfile. Default: use the template (predictable builds).
  useRepoDockerfile: boolean('use_repo_dockerfile').notNull().default(false),
  buildCommand: text('build_command'),
  runCommand: text('run_command'),
  port: integer('port'),
  cpuLimit: integer('cpu_limit').notNull().default(100),
  memLimit: integer('mem_limit').notNull().default(512),
  containerId: text('container_id'),
  currentImage: text('current_image'),
  status: serviceStatusEnum('status').notNull().default('CREATED'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/// Env var / secret for a service. Secret values encrypted at rest.
export const envVars = pgTable(
  'env_vars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    valueEnc: text('value_enc').notNull(),
    isSecret: boolean('is_secret').notNull().default(false),
  },
  (t) => ({
    serviceKeyUnique: unique('env_vars_service_key_unique').on(
      t.serviceId,
      t.key,
    ),
  }),
);

/// One build + release attempt of a service.
export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  commitSha: text('commit_sha'),
  imageTag: text('image_tag'),
  status: deployStatusEnum('status').notNull().default('QUEUED'),
  buildLog: text('build_log'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
});

/// Public domain mapped to a service via the reverse proxy.
export const domains = pgTable('domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id')
    .notNull()
    .unique()
    .references(() => services.id, { onDelete: 'cascade' }),
  host: text('host').notNull().unique(),
  https: boolean('https').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type DbSchema = {
  users: typeof users;
  nodes: typeof nodes;
  projects: typeof projects;
  gitCredentials: typeof gitCredentials;
  templates: typeof templates;
  services: typeof services;
  envVars: typeof envVars;
  deployments: typeof deployments;
  domains: typeof domains;
};
