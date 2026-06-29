import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { CryptoService } from './common/crypto/crypto.service';
import { ServicesService } from './modules/services/services.service';

const EXEC_PATH = /^\/api\/v1\/services\/([^/]+)\/exec$/;

/**
 * Raw WebSocket proxy for interactive container shells:
 *   browser (JWT in ?token) ⟷ control plane ⟷ agent (daemon token) ⟷ docker exec.
 * Kept off the Nest gateway layer so we can stream raw PTY frames untouched.
 */
export function setupExecProxy(app: INestApplication): void {
  const server = app.getHttpServer() as Server;
  const jwt = app.get(JwtService, { strict: false });
  const services = app.get(ServicesService, { strict: false });
  const crypto = app.get(CryptoService, { strict: false });
  const wss = new WebSocketServer({ noServer: true });
  const secret = process.env.JWT_SECRET ?? 'change-me-access-secret';

  server.on('upgrade', (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '', 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }

    const match = EXEC_PATH.exec(url.pathname);
    if (!match) {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token') ?? '';
    try {
      jwt.verify(token, { secret });
    } catch {
      socket.destroy();
      return;
    }

    const serviceId = match[1];
    wss.handleUpgrade(req, socket, head, (client) => {
      void bridge(client, serviceId, services, crypto);
    });
  });
}

async function bridge(
  client: WebSocket,
  serviceId: string,
  services: ServicesService,
  crypto: CryptoService,
): Promise<void> {
  let node: Awaited<ReturnType<ServicesService['getNodeRow']>>;
  try {
    node = await services.getNodeRow(serviceId);
  } catch {
    client.close(1011, 'service not found');
    return;
  }

  const daemonToken = crypto.decrypt(node.daemonToken);
  const scheme = process.env.AGENT_INSECURE_HTTP === '1' ? 'ws' : 'wss';
  const upstream = new WebSocket(
    `${scheme}://${node.fqdn}:${node.agentPort}/api/servers/${serviceId}/exec`,
    { headers: { Authorization: `Bearer ${daemonToken}` } },
  );

  const queue: Array<[RawData, boolean]> = [];
  let open = false;

  client.on('message', (data, isBinary) => {
    if (open) upstream.send(data, { binary: isBinary });
    else queue.push([data, isBinary]);
  });

  upstream.on('open', () => {
    open = true;
    for (const [data, isBinary] of queue) upstream.send(data, { binary: isBinary });
    queue.length = 0;
  });

  upstream.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });

  const closeClient = () => {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  };
  const closeUpstream = () => {
    try {
      upstream.close();
    } catch {
      /* ignore */
    }
  };

  upstream.on('close', closeClient);
  upstream.on('error', closeClient);
  client.on('close', closeUpstream);
  client.on('error', closeUpstream);
}
