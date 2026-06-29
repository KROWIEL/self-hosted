import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DRIZZLE, Database } from '../../db/database.module';
import { nodes } from '../../db/schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AgentClient } from './agent.client';

interface CreateNodeInput {
  name: string;
  fqdn: string;
  agentPort?: number;
}

@Injectable()
export class NodesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly agent: AgentClient,
  ) {}

  list() {
    return this.db.select().from(nodes).orderBy(nodes.createdAt);
  }

  async create(input: CreateNodeInput) {
    const daemonToken = randomBytes(32).toString('hex');
    const rows = await this.db
      .insert(nodes)
      .values({
        name: input.name,
        fqdn: input.fqdn,
        agentPort: input.agentPort ?? 8443,
        daemonToken: this.crypto.encrypt(daemonToken),
      })
      .returning();
    // Return the plaintext token ONCE so the operator can configure the agent.
    return { ...rows[0], daemonTokenPlaintext: daemonToken };
  }

  async get(id: string) {
    const rows = await this.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Node not found');
    return rows[0];
  }

  async configuration(id: string) {
    const node = await this.get(id);
    return {
      nodeId: node.id,
      agentPort: node.agentPort,
      panelPublicKey: node.publicKey,
    };
  }

  async remove(id: string) {
    await this.get(id);
    await this.db.delete(nodes).where(eq(nodes.id, id));
    return { ok: true };
  }

  /** Live Docker-level metrics from the node's agent (reachable only if up). */
  async systemInfo(id: string) {
    const node = await this.get(id);
    return this.agent.getSystem(node);
  }
}
