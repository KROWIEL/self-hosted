import "dotenv/config";

import { loadConfig } from "./config";
import { AgentControlClient } from "./control/ws-client";
import { DeployService } from "./deploy/deploy.service";
import { DockerService } from "./docker/docker.service";
import { LogForwarder } from "./logs/log-forwarder";
import { TunnelService } from "./tunnel/tunnel.service";

async function bootstrap() {
  const config = loadConfig();
  const dockerService = new DockerService();
  const deployService = new DeployService(config);
  const logForwarder = new LogForwarder();
  const tunnelService = new TunnelService(config);
  const client = new AgentControlClient(
    config,
    dockerService,
    deployService,
    logForwarder,
    tunnelService
  );
  await client.start();
}

void bootstrap();
