'use client';

import { useEffect, useState } from 'react';
import {
  AgentStatus,
  Node,
  NodeWithToken,
  createNode,
  deleteNode,
  listNodes,
  nodeAgentStatus,
  startNodeAgent,
  stopNodeAgent,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import {
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { useI18n } from '@/i18n';

export default function NodesPage() {
  const { t } = useI18n();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', fqdn: '', agentPort: 8443 });
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<NodeWithToken | null>(null);

  function load() {
    setLoading(true);
    listNodes()
      .then(setNodes)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const node = await createNode({
        name: form.name.trim(),
        fqdn: form.fqdn.trim(),
        agentPort: Number(form.agentPort),
      });
      setNewToken(node);
      setForm({ name: '', fqdn: '', agentPort: 8443 });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t('nodes.confirmDelete'))) return;
    try {
      await deleteNode(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('nodes.title')} subtitle={t('nodes.subtitle')} />

      {error && <ErrorBox message={error} />}

      {newToken && (
        <Card className="mb-6 border-amber-400/30 bg-amber-400/[0.06]">
          <p className="mb-2 text-sm text-amber-200">
            {t('nodes.tokenOnce', { name: newToken.name })}
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-950/80 p-3 font-mono text-xs text-neutral-300">
            {`AGENT_DAEMON_TOKEN=${newToken.daemonTokenPlaintext} \\
AGENT_PORT=${newToken.agentPort} go run ./cmd/agent`}
          </pre>
          <button
            onClick={() => setNewToken(null)}
            className="mt-3 text-xs text-neutral-400 transition-colors hover:text-white"
          >
            {t('common.dismiss')}
          </button>
        </Card>
      )}

      <Card className="mb-8">
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('nodes.namePlaceholder')}
            required
            className="field"
          />
          <input
            value={form.fqdn}
            onChange={(e) => setForm({ ...form, fqdn: e.target.value })}
            placeholder={t('nodes.fqdnPlaceholder')}
            required
            className="field"
          />
          <input
            type="number"
            value={form.agentPort}
            onChange={(e) =>
              setForm({ ...form, agentPort: Number(e.target.value) })
            }
            placeholder={t('nodes.portPlaceholder')}
            className="field"
          />
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? t('nodes.adding') : t('nodes.add')}
          </button>
        </form>
      </Card>

      {loading && <Spinner />}
      {!loading && nodes.length === 0 && (
        <EmptyState>{t('nodes.empty')}</EmptyState>
      )}

      <ul className="space-y-3">
        {nodes.map((n) => (
          <NodeItem key={n.id} node={n} onDelete={() => onDelete(n.id)} />
        ))}
      </ul>
    </AppShell>
  );
}

function NodeItem({ node, onDelete }: { node: Node; onDelete: () => void }) {
  const { t } = useI18n();
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  async function refresh() {
    try {
      setAgent(await nodeAgentStatus(node.id));
    } catch {
      /* ignore polling errors */
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      if (agent?.running) await stopNodeAgent(node.id);
      else await startNodeAgent(node.id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || agent?.enabled === false;

  return (
    <Card hover>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="4" width="18" height="6" rx="1.5" />
              <rect x="3" y="14" width="18" height="6" rx="1.5" />
              <path d="M7 7h.01M7 17h.01" />
            </svg>
          </span>
          <div>
            <p className="font-medium text-white">{node.name}</p>
            <p className="font-mono text-xs text-neutral-500">
              {node.fqdn}:{node.agentPort}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={agent?.running ? 'RUNNING' : 'STOPPED'} />
          <button
            onClick={toggle}
            disabled={disabled}
            title={agent?.enabled === false ? t('nodes.disabledTitle') : undefined}
            className={agent?.running ? 'btn-ghost' : 'btn-primary'}
          >
            {busy ? '…' : agent?.running ? t('nodes.stop') : t('nodes.start')}
          </button>
          {agent && agent.logs.length > 0 && (
            <button
              onClick={() => setShowLogs((s) => !s)}
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {showLogs ? t('nodes.hideLog') : t('nodes.log')}
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-neutral-500 transition-colors hover:text-red-400"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>

      {agent?.enabled === false && (
        <p className="mt-3 text-xs text-amber-300">{t('nodes.disabledHint')}</p>
      )}
      {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
      {showLogs && agent && (
        <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-ink-950/80 p-3 font-mono text-xs text-neutral-300">
          {agent.logs.join('\n')}
        </pre>
      )}
    </Card>
  );
}
