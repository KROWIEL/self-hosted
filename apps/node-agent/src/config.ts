import { z } from "zod";

const configSchema = z.object({
  API_BASE_URL: z.string().default("http://localhost:4000"),
  AGENT_NODE_NAME: z.string().default("local-node"),
  AGENT_VERSION: z.string().default("0.1.0"),
  ENROLLMENT_TOKEN: z.string().optional(),
  NODE_ID: z.string().optional(),
  NODE_TOKEN: z.string().optional(),
  AGENT_STATE_FILE: z.string().default(".agent-state.json"),
  AGENT_WORKDIR: z.string().default("./agent-workdir"),
  HEARTBEAT_INTERVAL_MS: z
    .string()
    .default("15000")
    .transform((value) => Number(value)),
  CONTROL_CHANNEL_SHARED_SECRET: z.string().default("self-hosted"),
  RATHOLE_SERVER_ADDR: z.string().default("127.0.0.1:2333"),
  RATHOLE_CLIENT_CONFIG_PATH: z.string().default("/etc/rathole/client.toml"),
  RATHOLE_CLIENT_RELOAD_COMMAND: z.string().default("systemctl reload rathole-client")
});

export type AgentConfig = z.infer<typeof configSchema>;

export function loadConfig(): AgentConfig {
  return configSchema.parse(process.env);
}
