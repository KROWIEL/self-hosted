import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Agent } from 'undici';
import { AgentClient, NodeRow } from './agent.client';
import { AgentTokenService } from './agent-token.service';

// Node's global fetch rejects dispatchers from the `undici` package when the
// majors differ, which made every pinned-TLS agent call fail as "unreachable".
describe('AgentClient doFetch', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => res.end('ok'));
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => new Promise((done) => server.close(done)));

  it('accepts a dispatcher created from the undici package', async () => {
    const client = new AgentClient({} as AgentTokenService);
    const doFetch = (
      client as unknown as {
        doFetch: (n: NodeRow, u: string, i: { dispatcher: Agent }) => Promise<Response>;
      }
    ).doFetch.bind(client);

    const res = await doFetch({ name: 'test' } as NodeRow, url, {
      dispatcher: new Agent(),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});
