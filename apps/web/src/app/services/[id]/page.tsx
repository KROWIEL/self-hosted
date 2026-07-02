'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Deployment,
  EnvVar,
  GitCredential,
  Service,
  ServiceStats,
  deleteService,
  deployService,
  getService,
  getServiceStats,
  getWebhook,
  listDeployments,
  listEnv,
  listGitCredentials,
  powerService,
  rollbackDeployment,
  setDomain,
  setEnv,
  deleteEnv,
  streamDeploymentLogs,
  streamServiceLogs,
  updateService,
  execSocketUrl,
  listVolumes,
  addVolume,
  removeVolume,
  Volume,
  API_URL,
  inspectRepo,
  setupFromRepo,
  RepoInspect,
  InspectEnvKey,
  DbEngine,
} from '@/lib/api';
import '@xterm/xterm/css/xterm.css';
import { AppShell } from '@/components/shell';
import { BackupsPanel } from '@/components/backups-panel';
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
  const [showHistory, setShowHistory] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
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
              onClick={() => setTermOpen(true)}
              disabled={service.status !== 'RUNNING'}
              title={
                service.status !== 'RUNNING'
                  ? t('service.terminalNotRunning')
                  : undefined
              }
              className="btn-ghost"
            >
              &gt;_ {t('service.terminal')}
            </button>
            <button onClick={() => setSetupOpen(true)} className="btn-ghost">
              ⚙ {t('setup.button')}
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

          <OverviewPanel service={service} />

          <MetricsPanel id={id} status={service.status} />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  {t('service.deployments')}
                </h2>
                {deployments.length === 0 ? (
                  <EmptyState>{t('service.noDeployments')}</EmptyState>
                ) : (
                  <div className="space-y-2">
                    <DeploymentCard
                      d={deployments[0]}
                      openLog={openLog}
                      setOpenLog={setOpenLog}
                      busy={busy}
                      onRollback={(dep) => act(() => rollbackDeployment(dep))}
                    />
                    {deployments.length > 1 && (
                      <>
                        <button
                          onClick={() => setShowHistory((s) => !s)}
                          className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-neutral-400 transition-colors hover:text-white"
                        >
                          {showHistory
                            ? t('service.deploymentsHide')
                            : t('service.deploymentsShowAll', {
                                count: deployments.length - 1,
                              })}
                        </button>
                        {showHistory &&
                          deployments.slice(1).map((d) => (
                            <DeploymentCard
                              key={d.id}
                              d={d}
                              openLog={openLog}
                              setOpenLog={setOpenLog}
                              busy={busy}
                              onRollback={(dep) =>
                                act(() => rollbackDeployment(dep))
                              }
                            />
                          ))}
                      </>
                    )}
                  </div>
                )}
              </section>

              <SettingsBox service={service} onSaved={refresh} />
            </div>

            <section className="space-y-6">
              <EnvEditor id={id} env={env} onSaved={refresh} />
              <VolumesBox id={id} />
              <DomainBox id={id} onSaved={refresh} />
              <WebhookBox id={id} />
            </section>
          </div>

          <section className="mt-6">
            <LogViewer id={id} />
          </section>

          {termOpen && (
            <TerminalModal serviceId={id} onClose={() => setTermOpen(false)} />
          )}

          {setupOpen && (
            <ScanSetupModal
              serviceId={id}
              onClose={() => setSetupOpen(false)}
              onApplied={() => {
                setSetupOpen(false);
                void refresh();
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function ScanSetupModal({
  serviceId,
  onClose,
  onApplied,
}: {
  serviceId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RepoInspect | null>(null);
  const [dbs, setDbs] = useState<Set<DbEngine>>(new Set());
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    inspectRepo(serviceId)
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setDbs(new Set(r.databases.map((d) => d.engine)));
        const existing = new Set(r.existingKeys);
        setKeys(
          new Set(
            r.envKeys
              .filter((k) => !!k.dbRole || !existing.has(k.key))
              .map((k) => k.key),
          ),
        );
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [serviceId]);

  function toggle<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    setErr(null);
    try {
      await setupFromRepo(serviceId, {
        databases: result.databases.filter((d) => dbs.has(d.engine)),
        envKeys: result.envKeys.filter((k) => keys.has(k.key)),
      });
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  const existing = new Set(result?.existingKeys ?? []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/10 bg-ink-850 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {t('setup.title')}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-neutral-500">{t('setup.hint')}</p>

        {err && <ErrorBox message={err} />}
        {loading ? (
          <Spinner label={t('setup.scanning')} />
        ) : result ? (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {t('setup.databases')}
              </h4>
              {result.databases.length === 0 ? (
                <p className="text-xs text-neutral-500">{t('setup.noDatabases')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {result.databases.map((d) => (
                    <li key={d.engine}>
                      <label className="flex items-center gap-2 text-sm text-neutral-300">
                        <input
                          type="checkbox"
                          checked={dbs.has(d.engine)}
                          onChange={() => setDbs((s) => toggle(s, d.engine))}
                          className="accent-indigo-500"
                        />
                        {d.engine === 'POSTGRES' ? 'PostgreSQL' : 'MySQL'}
                        <span className="text-xs text-neutral-500">
                          {t('setup.willCreate')}
                        </span>
                      </label>
                      {d.schemas.length > 0 && (
                        <p className="ml-6 mt-0.5 font-mono text-[11px] text-neutral-500">
                          {t('setup.schemas')}: {d.schemas.join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {result.envFile
                  ? t('setup.envFrom', { file: result.envFile })
                  : t('setup.envNone')}
              </h4>
              {result.envKeys.length === 0 ? (
                <p className="text-xs text-neutral-500">{t('setup.envNone')}</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-auto">
                  {result.envKeys.map((k) => (
                    <li key={k.key}>
                      <label className="flex items-center gap-2 rounded-lg px-1 py-1 font-mono text-xs text-neutral-300">
                        <input
                          type="checkbox"
                          checked={keys.has(k.key)}
                          onChange={() => setKeys((s) => toggle(s, k.key))}
                          className="accent-indigo-500"
                        />
                        <span className="truncate">{k.key}</span>
                        {k.dbRole && (
                          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
                            db:{k.dbRole}
                          </span>
                        )}
                        {existing.has(k.key) && (
                          <span className="text-[10px] text-amber-400">
                            {t('setup.exists')}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button onClick={onClose} className="btn-ghost">
                {t('common.cancel')}
              </button>
              <button
                onClick={apply}
                disabled={applying}
                className="btn-primary"
              >
                {applying ? t('setup.applying') : t('setup.apply')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TerminalModal({
  serviceId,
  onClose,
}: {
  serviceId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>(
    'connecting',
  );

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fit: any;
    let onWinResize: (() => void) | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      if (disposed || !ref.current) return;

      term = new Terminal({
        cursorBlink: true,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        theme: { background: '#0a0a0a', foreground: '#e5e5e5' },
      });
      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(ref.current);
      try {
        fit.fit();
      } catch {
        /* ignore */
      }

      const enc = new TextEncoder();
      ws = new WebSocket(execSocketUrl(serviceId));
      ws.binaryType = 'arraybuffer';

      const sendResize = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ resize: { cols: term.cols, rows: term.rows } }),
          );
        }
      };

      ws.onopen = () => {
        setStatus('open');
        sendResize();
        term.focus();
      };
      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === 'string') term.write(ev.data);
        else term.write(new Uint8Array(ev.data as ArrayBuffer));
      };
      ws.onclose = () => {
        setStatus('closed');
        term.write('\r\n\x1b[33m— ' + t('service.terminalClosed') + ' —\x1b[0m\r\n');
      };
      ws.onerror = () => setStatus('closed');

      term.onData((d: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(enc.encode(d));
      });
      term.onResize(() => sendResize());

      onWinResize = () => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      };
      window.addEventListener('resize', onWinResize);
    })();

    return () => {
      disposed = true;
      if (onWinResize) window.removeEventListener('resize', onWinResize);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      try {
        term?.dispose();
      } catch {
        /* ignore */
      }
    };
  }, [serviceId, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[72vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-neutral-200">
              &gt;_ {t('service.terminalTitle')}
            </span>
            <span
              className={`text-xs ${
                status === 'open'
                  ? 'text-emerald-400'
                  : status === 'closed'
                    ? 'text-red-400'
                    : 'text-neutral-500'
              }`}
            >
              {status === 'open'
                ? '●'
                : status === 'closed'
                  ? t('service.terminalClosed')
                  : t('service.terminalConnecting')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {t('service.close')} ✕
          </button>
        </div>
        <p className="border-b border-white/5 px-4 py-1.5 text-xs text-neutral-500">
          {t('service.terminalHint')}
        </p>
        <div ref={ref} className="min-h-0 flex-1 bg-[#0a0a0a] p-2" />
      </div>
    </div>
  );
}

function DeploymentCard({
  d,
  openLog,
  setOpenLog,
  busy,
  onRollback,
}: {
  d: Deployment;
  openLog: string | null;
  setOpenLog: (id: string | null) => void;
  busy: boolean;
  onRollback: (id: string) => void;
}) {
  const { t } = useI18n();
  const active =
    d.status === 'QUEUED' || d.status === 'BUILDING' || d.status === 'DEPLOYING';
  return (
    <Card className="p-4">
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
                if (confirm(t('service.rollbackConfirm'))) onRollback(d.id);
              }}
              disabled={busy}
              className="text-xs text-neutral-400 transition-colors hover:text-indigo-300"
            >
              {t('service.rollback')}
            </button>
          )}
          {!active && (d.buildLog || d.errorMsg) && (
            <button
              onClick={() => setOpenLog(openLog === d.id ? null : d.id)}
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {openLog === d.id ? t('service.hideLog') : t('service.showLog')}
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
}

function OverviewPanel({ service }: { service: Service }) {
  const { t } = useI18n();
  const port = service.port ?? service.template?.defaultPort ?? null;
  const appUrl = service.domain?.host
    ? `${service.domain.https ? 'https' : 'http'}://${service.domain.host}`
    : port
      ? `http://localhost:${port}`
      : null;

  return (
    <Card className="mb-8 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('service.info')}
        </h2>
        {appUrl && service.status === 'RUNNING' && (
          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost py-1.5 text-xs"
          >
            {t('service.open')} ↗
          </a>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <Fact label={t('service.node')}>
          {service.node ? (
            <>
              {service.node.name}
              <span className="block font-mono text-xs text-neutral-500">
                {service.node.fqdn}:{service.node.agentPort}
              </span>
            </>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label={t('service.template')}>
          {service.template?.name ?? '—'}
        </Fact>
        <Fact label={t('service.port')}>{port ?? '—'}</Fact>
        <Fact label={t('service.repo')}>
          <span className="break-all font-mono text-xs text-neutral-300">
            {service.repoUrl}
          </span>
          <span className="block font-mono text-xs text-neutral-500">
            {service.branch}
          </span>
        </Fact>
        <Fact label={t('service.domain')}>
          {service.domain?.host ? (
            <span className="font-mono text-xs">
              {service.domain.host}
              {service.domain.https ? ' · HTTPS' : ''}
            </span>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label={t('service.image')}>
          <span className="break-all font-mono text-xs text-neutral-300">
            {service.currentImage ?? '—'}
          </span>
        </Fact>
      </dl>
    </Card>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-200">{children}</dd>
    </div>
  );
}

function SettingsBox({
  service,
  onSaved,
}: {
  service: Service;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [creds, setCreds] = useState<GitCredential[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initialForm = useCallback(
    () => ({
      name: service.name,
      repoUrl: service.repoUrl,
      branch: service.branch,
      port: service.port ?? undefined,
      gitCredId: service.gitCredId ?? '',
      useRepoDockerfile: service.useRepoDockerfile,
      cpuLimit: service.cpuLimit,
      memLimit: service.memLimit,
    }),
    [service],
  );

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    listGitCredentials().then(setCreds).catch(() => {});
  }, []);

  function cancel() {
    setForm(initialForm());
    setErr(null);
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await updateService(service.id, {
        name: form.name.trim(),
        repoUrl: form.repoUrl.trim(),
        branch: form.branch.trim(),
        port: form.port ? Number(form.port) : undefined,
        gitCredId: form.gitCredId,
        useRepoDockerfile: form.useRepoDockerfile,
        cpuLimit: Number(form.cpuLimit),
        memLimit: Number(form.memLimit),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      setEditing(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  const ro = !editing;
  const field = `field w-full disabled:cursor-not-allowed disabled:opacity-60`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('service.settings')}
        </h2>
        {editing ? (
          <button
            onClick={cancel}
            className="text-xs text-neutral-400 transition-colors hover:text-white"
          >
            {t('common.cancel')}
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-400 transition-colors hover:text-white"
          >
            {t('common.edit')}
          </button>
        )}
      </div>
      <Card>
        {err && <ErrorBox message={err} />}
        <form onSubmit={save} className="space-y-3">
          <Labeled label={t('service.name')}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={ro}
              className={field}
            />
          </Labeled>
          <Labeled label={t('service.repo')}>
            <input
              value={form.repoUrl}
              onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
              disabled={ro}
              className={field}
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label={t('project.branch')}>
              <input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                disabled={ro}
                className={field}
              />
            </Labeled>
            <Labeled label={t('service.port')}>
              <input
                type="number"
                value={form.port ?? ''}
                onChange={(e) =>
                  setForm({ ...form, port: Number(e.target.value) })
                }
                disabled={ro}
                className={field}
              />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label={t('service.cpu')}>
              <input
                type="number"
                value={form.cpuLimit}
                onChange={(e) =>
                  setForm({ ...form, cpuLimit: Number(e.target.value) })
                }
                disabled={ro}
                className={field}
              />
            </Labeled>
            <Labeled label={t('service.mem')}>
              <input
                type="number"
                value={form.memLimit}
                onChange={(e) =>
                  setForm({ ...form, memLimit: Number(e.target.value) })
                }
                disabled={ro}
                className={field}
              />
            </Labeled>
          </div>
          <Labeled label={t('project.gitCred')}>
            <select
              value={form.gitCredId}
              onChange={(e) => setForm({ ...form, gitCredId: e.target.value })}
              disabled={ro}
              className={field}
            >
              <option value="" className="bg-ink-850">
                {t('project.gitCredNone')}
              </option>
              {creds.map((c) => (
                <option key={c.id} value={c.id} className="bg-ink-850">
                  {c.name} ({c.provider})
                </option>
              ))}
            </select>
          </Labeled>
          <label className="flex items-start gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={form.useRepoDockerfile}
              onChange={(e) =>
                setForm({ ...form, useRepoDockerfile: e.target.checked })
              }
              disabled={ro}
              className="mt-0.5 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span>{t('project.useRepoDockerfile')}</span>
          </label>
          {editing && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {t('service.settingsHint')}
              </span>
              <button type="submit" disabled={busy} className="btn-primary py-1.5">
                {saved ? t('common.saved') : t('common.save')}
              </button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function VolumesBox({ id }: { id: string }) {
  const { t } = useI18n();
  const [vols, setVols] = useState<Volume[]>([]);
  const [mountPath, setMountPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openVol, setOpenVol] = useState<string | null>(null);

  const refresh = () =>
    listVolumes(id)
      .then(setVols)
      .catch(() => {});

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await addVolume(id, mountPath.trim());
      setMountPath('');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(volumeId: string) {
    if (!confirm(t('volume.removeConfirm'))) return;
    setBusy(true);
    try {
      await removeVolume(id, volumeId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('volume.title')}
      </h2>
      <Card>
        {err && <ErrorBox message={err} />}
        {vols.length === 0 ? (
          <p className="mb-3 text-sm text-neutral-500">{t('volume.none')}</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {vols.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="min-w-0 truncate font-mono text-xs text-neutral-300">
                    {v.mountPath}
                    <span className="ml-2 text-neutral-600">{v.name}</span>
                  </code>
                  <span className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() =>
                        setOpenVol((cur) => (cur === v.id ? null : v.id))
                      }
                      className="text-xs text-neutral-400 transition-colors hover:text-white"
                    >
                      {t('backup.title')}
                    </button>
                    <button
                      onClick={() => remove(v.id)}
                      disabled={busy}
                      className="text-xs text-red-400 transition-colors hover:text-red-300"
                    >
                      ✕
                    </button>
                  </span>
                </div>
                {openVol === v.id && (
                  <BackupsPanel kind="VOLUME" refId={v.id} />
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex gap-2">
          <input
            value={mountPath}
            onChange={(e) => setMountPath(e.target.value)}
            placeholder={t('volume.mountPath')}
            className="field flex-1"
          />
          <button type="submit" disabled={busy || !mountPath.trim()} className="btn-ghost">
            {t('volume.add')}
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">{t('volume.hint')}</p>
      </Card>
    </div>
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

const SECRET_KEY_RE =
  /(PASS|PWD|SECRET|TOKEN|PRIVATE|CREDENTIAL|API_?KEY|_KEY$|DATABASE_URL|DSN)/i;

/** Parses .env text into env vars. Handles comments, `export`, and quotes. */
function parseDotenv(text: string): { key: string; value: string; isSecret: boolean }[] {
  const out: { key: string; value: string; isSecret: boolean }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = body.indexOf('=');
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = body.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out.push({ key, value, isSecret: SECRET_KEY_RE.test(key) });
  }
  return out;
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
  const [showImport, setShowImport] = useState(false);
  const [bulk, setBulk] = useState('');

  async function importEnv() {
    const parsed = parseDotenv(bulk);
    if (parsed.length === 0) {
      setErr(t('service.envImportEmpty'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await setEnv(id, parsed);
      setBulk('');
      setShowImport(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

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

  async function remove(k: string) {
    if (!confirm(t('service.envDeleteConfirm'))) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteEnv(id, k);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('service.environment')}
        </h2>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
        >
          {t('service.envImport')}
        </button>
      </div>
      <Card>
        {err && <ErrorBox message={err} />}
        {showImport && (
          <div className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs text-neutral-500">
              {t('service.envImportHint')}
            </p>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder={'DATABASE_URL=...\nAPI_KEY=...\nPORT=8080'}
              className="field-mono mb-2 w-full text-xs"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {t('service.envImportCount', { n: parseDotenv(bulk).length })}
              </span>
              <button
                type="button"
                onClick={importEnv}
                disabled={busy || !bulk.trim()}
                className="btn-ghost py-1.5"
              >
                {t('service.envImportBtn')}
              </button>
            </div>
          </div>
        )}
        {env.length === 0 ? (
          <p className="mb-3 text-sm text-neutral-500">{t('service.noVariables')}</p>
        ) : (
          <ul className="mb-4 space-y-1.5 text-sm">
            {env.map((v) => (
              <li
                key={v.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono"
              >
                <span className="min-w-0 truncate text-neutral-300">{v.key}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-neutral-500">
                    {v.isSecret ? '••••••' : v.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(v.key)}
                    disabled={busy}
                    title={t('service.envDelete')}
                    className="shrink-0 text-xs text-red-400 transition-colors hover:text-red-300"
                  >
                    ✕
                  </button>
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
