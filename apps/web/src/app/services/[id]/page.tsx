'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Deployment,
  EnvVar,
  Service,
  ServiceStats,
  deleteService,
  deployService,
  getService,
  getServiceStats,
  getWebhook,
  listDeployments,
  listEnv,
  powerService,
  rollbackDeployment,
  setDomain,
  setEnv,
  streamDeploymentLogs,
  streamServiceLogs,
  API_URL,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import { Card, EmptyState, ErrorBox, Spinner, StatusBadge } from '@/components/ui';
import { useI18n, useTypeLabel } from '@/i18n';

export default function ServicePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useI18n();
  const typeLabel = useTypeLabel();

  const [service, setService] = useState<Service | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [env, setEnvState] = useState<EnvVar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [s, d, e] = await Promise.all([
      getService(id),
      listDeployments(id),
      listEnv(id).catch(() => [] as EnvVar[]),
    ]);
    setService(s);
    setDeployments(d);
    setEnvState(e);
    return s;
  }, [id]);

  useEffect(() => {
    refresh()
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    const active =
      service?.status === 'BUILDING' ||
      deployments[0]?.status === 'QUEUED' ||
      deployments[0]?.status === 'BUILDING' ||
      deployments[0]?.status === 'DEPLOYING';
    if (active && !timer.current) {
      timer.current = setInterval(() => {
        refresh().catch(() => {});
      }, 2500);
    }
    if (!active && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [service?.status, deployments, refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {service && (
        <Link
          href={`/projects/${service.projectId}`}
          className="text-sm text-neutral-400 transition-colors hover:text-white"
        >
          {t('service.back')}
        </Link>
      )}

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {service && (
        <>
          <header className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {service.name}
              </h1>
              <p className="mt-1 font-mono text-sm text-neutral-500">
                {typeLabel(service.type)} · {service.repoUrl} · {service.branch}
              </p>
              {service.currentImage && (
                <p className="mt-1 font-mono text-xs text-neutral-600">
                  {t('service.image')}: {service.currentImage}
                </p>
              )}
            </div>
            <StatusBadge status={service.status} />
          </header>

          <Card className="mb-8 flex flex-wrap items-center gap-2 p-3">
            <button
              onClick={() => act(() => deployService(id))}
              disabled={busy}
              className="btn-primary"
            >
              ⟳ {t('service.deploy')}
            </button>
            <button
              onClick={() => act(() => powerService(id, 'start'))}
              disabled={busy}
              className="btn-ghost"
            >
              {t('service.start')}
            </button>
            <button
              onClick={() => act(() => powerService(id, 'stop'))}
              disabled={busy}
              className="btn-ghost"
            >
              {t('service.stop')}
            </button>
            <button
              onClick={() => act(() => powerService(id, 'restart'))}
              disabled={busy}
              className="btn-ghost"
            >
              {t('service.restart')}
            </button>
            <button
              onClick={() => {
                if (confirm(t('service.confirmDelete')))
                  act(() => deleteService(id)).then(() => {
                    window.location.href = `/projects/${service.projectId}`;
                  });
              }}
              disabled={busy}
              className="btn-danger ml-auto"
            >
              {t('service.delete')}
            </button>
          </Card>

          <MetricsPanel id={id} status={service.status} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {t('service.deployments')}
              </h2>
              {deployments.length === 0 ? (
                <EmptyState>{t('service.noDeployments')}</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {deployments.map((d) => {
                    const active =
                      d.status === 'QUEUED' ||
                      d.status === 'BUILDING' ||
                      d.status === 'DEPLOYING';
                    return (
                      <Card key={d.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <StatusBadge status={d.status} />
                            <span className="font-mono text-neutral-500">
                              {d.commitSha ? d.commitSha.slice(0, 7) : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {!active && d.status === 'SUCCESS' && (
                              <button
                                onClick={() => {
                                  if (confirm(t('service.rollbackConfirm')))
                                    act(() => rollbackDeployment(d.id));
                                }}
                                disabled={busy}
                                className="text-xs text-neutral-400 transition-colors hover:text-indigo-300"
                              >
                                {t('service.rollback')}
                              </button>
                            )}
                            {!active && (d.buildLog || d.errorMsg) && (
                              <button
                                onClick={() =>
                                  setOpenLog(openLog === d.id ? null : d.id)
                                }
                                className="text-xs text-neutral-400 transition-colors hover:text-white"
                              >
                                {openLog === d.id
                                  ? t('service.hideLog')
                                  : t('service.showLog')}
                              </button>
                            )}
                          </div>
                        </div>
                        {active ? (
                          <BuildLogStream deploymentId={d.id} />
                        ) : (
                          openLog === d.id && (
                            <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-ink-950/80 p-3 font-mono text-xs text-neutral-300">
                              {d.errorMsg ? `ERROR: ${d.errorMsg}\n\n` : ''}
                              {d.buildLog ?? t('service.noBuildLog')}
                            </pre>
                          )
                        )}
                      </Card>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-6">
              <EnvEditor id={id} env={env} onSaved={refresh} />
              <DomainBox id={id} onSaved={refresh} />
              <WebhookBox id={id} />
            </section>
          </div>

          <section className="mt-6">
            <LogViewer id={id} />
          </section>
        </>
      )}
    </AppShell>
  );
}

function WebhookBox({ id }: { id: string }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getWebhook(id)
      .then((w) => setUrl(`${API_URL}${w.path}`))
      .catch(() => {});
  }, [id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (insecure context) — ignore
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('service.webhook')}
      </h2>
      <Card>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="field-mono flex-1 text-xs"
          />
          <button onClick={copy} disabled={!url} className="btn-ghost py-1.5">
            {copied ? t('service.copied') : t('service.copy')}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">{t('service.webhookHint')}</p>
      </Card>
    </div>
  );
}

function MetricsPanel({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ServiceStats | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      getServiceStats(id)
        .then((s) => {
          if (alive) setStats(s);
        })
        .catch(() => {});
    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, status]);

  const healthColor =
    stats?.health === 'healthy'
      ? 'text-emerald-400'
      : stats?.health === 'unhealthy'
        ? 'text-red-400'
        : 'text-neutral-400';

  return (
    <Card className="mb-8 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('service.metrics')}
        </h2>
        <span className={`font-mono text-xs ${healthColor}`}>
          {stats?.state ?? '—'}
          {stats?.health && stats.health !== 'none' ? ` · ${stats.health}` : ''}
        </span>
      </div>
      {stats?.running ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t('metrics.cpu')} value={stats.cpuPerc ?? '—'} />
          <Metric
            label={t('metrics.memory')}
            value={stats.memPerc ?? '—'}
            sub={stats.memUsage}
          />
          <Metric label={t('metrics.network')} value={stats.netIO ?? '—'} />
          <Metric label={t('metrics.pids')} value={stats.pids ?? '—'} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{t('metrics.notRunning')}</p>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-white">{value}</p>
      {sub && <p className="font-mono text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function BuildLogStream({ deploymentId }: { deploymentId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await streamDeploymentLogs(deploymentId, ac.signal);
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          setText((prev) => (prev + decoder.decode(value, { stream: true })).slice(-20000));
        }
      } catch {
        // aborted or stream error — ignore
      }
    })();
    return () => ac.abort();
  }, [deploymentId]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {t('service.buildLogLive')}
      </p>
      <pre
        ref={boxRef}
        className="max-h-72 overflow-auto rounded-xl bg-ink-950/80 p-3 font-mono text-xs text-neutral-300"
      >
        {text || t('service.buildLogWaiting')}
      </pre>
    </div>
  );
}

function LogViewer({ id }: { id: string }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLPreElement>(null);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    setStreaming(false);
  }, []);

  const start = useCallback(async () => {
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setLines([]);
    setStreaming(true);
    try {
      const res = await streamServiceLogs(id, ac.signal);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        if (parts.length) {
          setLines((prev) => [...prev, ...parts].slice(-1000));
        }
      }
      if (buf.trim()) setLines((prev) => [...prev, buf].slice(-1000));
      setLines((prev) => [...prev, t('service.logsEnded')]);
    } catch {
      // aborted by user or stream error — nothing to surface
    } finally {
      if (ctrl.current === ac) ctrl.current = null;
      setStreaming(false);
    }
  }, [id, t]);

  useEffect(() => () => ctrl.current?.abort(), []);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('service.logs')}
        </h2>
        <div className="flex items-center gap-2">
          {streaming ? (
            <button onClick={stop} className="btn-ghost py-1.5">
              {t('service.logsStop')}
            </button>
          ) : (
            <button onClick={start} className="btn-primary py-1.5">
              {t('service.logsStart')}
            </button>
          )}
          <button
            onClick={() => setLines([])}
            disabled={lines.length === 0}
            className="text-xs text-neutral-400 transition-colors hover:text-white disabled:opacity-40"
          >
            {t('service.logsClear')}
          </button>
        </div>
      </div>
      <pre
        ref={boxRef}
        className="h-80 overflow-auto rounded-2xl border border-white/10 bg-ink-950/80 p-4 font-mono text-xs leading-relaxed text-neutral-300"
      >
        {lines.length === 0
          ? streaming
            ? t('service.logsConnecting')
            : t('service.logsEmpty')
          : lines.join('\n')}
      </pre>
    </div>
  );
}

function EnvEditor({
  id,
  env,
  onSaved,
}: {
  id: string;
  env: EnvVar[];
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await setEnv(id, [{ key: key.trim(), value, isSecret: secret }]);
      setKey('');
      setValue('');
      setSecret(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('service.environment')}
      </h2>
      <Card>
        {err && <ErrorBox message={err} />}
        {env.length === 0 ? (
          <p className="mb-3 text-sm text-neutral-500">{t('service.noVariables')}</p>
        ) : (
          <ul className="mb-4 space-y-1.5 text-sm">
            {env.map((v) => (
              <li
                key={v.key}
                className="flex justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono"
              >
                <span className="text-neutral-300">{v.key}</span>
                <span className="text-neutral-500">
                  {v.isSecret ? '••••••' : v.value}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="space-y-2">
          <div className="flex gap-2">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('service.keyPlaceholder')}
              className="field-mono w-1/3"
            />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('service.valuePlaceholder')}
              className="field-mono flex-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={secret}
                onChange={(e) => setSecret(e.target.checked)}
                className="accent-indigo-500"
              />
              {t('service.secret')}
            </label>
            <button type="submit" disabled={busy} className="btn-ghost py-1.5">
              {t('common.set')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function DomainBox({
  id,
  onSaved,
}: {
  id: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [host, setHost] = useState('');
  const [https, setHttps] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await setDomain(id, host.trim(), https);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('service.domain')}
      </h2>
      <Card>
        {err && <ErrorBox message={err} />}
        <form onSubmit={save} className="space-y-2">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder={t('service.domainPlaceholder')}
            className="field"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={https}
                onChange={(e) => setHttps(e.target.checked)}
                className="accent-indigo-500"
              />
              {t('service.https')}
            </label>
            <button type="submit" disabled={busy} className="btn-ghost py-1.5">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
