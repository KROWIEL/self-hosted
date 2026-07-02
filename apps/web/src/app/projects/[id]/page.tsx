'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CreateDatabaseBody,
  CreateServiceBody,
  DbCredentials,
  GitCredential,
  ManagedDatabase,
  Node,
  Project,
  Service,
  Template,
  attachDatabase,
  createDatabase,
  createService,
  databaseCredentials,
  deleteDatabase,
  getProject,
  listDatabases,
  listGitCredentials,
  listNodes,
  listTemplates,
  powerDatabase,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import { BackupsPanel } from '@/components/backups-panel';
import {
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { useI18n, useTypeLabel } from '@/i18n';

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useI18n();
  const typeLabel = useTypeLabel();

  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creds, setCreds] = useState<GitCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<CreateServiceBody>({
    name: '',
    type: 'BACKEND',
    nodeId: '',
    templateId: '',
    repoUrl: '',
    branch: 'main',
    useRepoDockerfile: false,
  });

  function load() {
    setLoading(true);
    Promise.all([getProject(id), listNodes(), listTemplates(), listGitCredentials()])
      .then(([p, n, t, c]) => {
        setProject(p);
        setNodes(n);
        setTemplates(t);
        setCreds(c);
        setForm((f) => {
          const tpl = t.find((x) => x.id === f.templateId) ?? t[0];
          return {
            ...f,
            nodeId: f.nodeId || n[0]?.id || '',
            templateId: f.templateId || tpl?.id || '',
            type: tpl?.type ?? f.type,
            port: f.port ?? tpl?.defaultPort,
          };
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  function onTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    setForm((f) => ({
      ...f,
      templateId,
      type: tpl?.type ?? f.type,
      port: tpl?.defaultPort,
    }));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createService(id, {
        ...form,
        name: form.name.trim(),
        repoUrl: form.repoUrl.trim(),
      });
      setForm((f) => ({ ...f, name: '', repoUrl: '' }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <Link
        href="/dashboard"
        className="text-sm text-neutral-400 transition-colors hover:text-white"
      >
        {t('project.back')}
      </Link>

      {loading && <div className="mt-4"><Spinner /></div>}
      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {project && (
        <>
          <h1 className="mb-8 mt-3 text-2xl font-bold tracking-tight text-white">
            {project.name}
          </h1>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t('project.services')}
          </h2>
          {project.services.length === 0 ? (
            <div className="mb-8">
              <EmptyState>{t('project.noServices')}</EmptyState>
            </div>
          ) : (
            <ul className="mb-10 space-y-2">
              {project.services.map((s) => (
                <Card key={s.id} hover className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/services/${s.id}`}
                      className="min-w-0 transition-colors hover:text-indigo-300"
                    >
                      <span className="font-medium text-white">{s.name}</span>{' '}
                      <span className="text-sm text-neutral-500">
                        {typeLabel(s.type)} · {s.repoUrl}
                      </span>
                    </Link>
                    <StatusBadge status={s.status} />
                  </div>
                </Card>
              ))}
            </ul>
          )}

          <DatabasesSection
            projectId={id}
            nodes={nodes}
            services={project.services}
          />

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t('project.newService')}
          </h2>
          <Card>
            {nodes.length === 0 && (
              <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-300">
                {t('project.registerNodeFirst')}
              </p>
            )}
            <form onSubmit={onCreate} className="grid items-end gap-3 sm:grid-cols-2">
              <Field label={t('project.serviceName')}>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('project.serviceName')}
                  required
                  className="field w-full"
                />
              </Field>
              <Field label={t('service.repo')}>
                <input
                  value={form.repoUrl}
                  onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                  placeholder={t('project.repoPlaceholder')}
                  required
                  className="field w-full"
                />
              </Field>
              <Field label={t('field.template')}>
                <select
                  value={form.templateId}
                  onChange={(e) => onTemplate(e.target.value)}
                  className="field w-full"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id} className="bg-ink-850">
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('field.node')}>
                <select
                  value={form.nodeId}
                  onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
                  className="field w-full"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id} className="bg-ink-850">
                      {n.name} ({n.fqdn})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('project.branch')}>
                <input
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder={t('project.branch')}
                  className="field w-full"
                />
              </Field>
              <Field label={t('project.port')}>
                <input
                  type="number"
                  value={form.port ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, port: Number(e.target.value) })
                  }
                  placeholder={t('project.port')}
                  className="field w-full"
                />
              </Field>
              <Field
                label={t('project.gitCred')}
                hint={t('project.gitCredHint')}
                className="sm:col-span-2"
              >
                <select
                  value={form.gitCredId ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, gitCredId: e.target.value || undefined })
                  }
                  className="field w-full"
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
              </Field>
              <label className="flex items-start gap-2 text-sm text-neutral-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.useRepoDockerfile ?? false}
                  onChange={(e) =>
                    setForm({ ...form, useRepoDockerfile: e.target.checked })
                  }
                  className="mt-0.5 accent-indigo-500"
                />
                <span>
                  {t('project.useRepoDockerfile')}
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {t('project.useRepoDockerfileHint')}
                  </span>
                </span>
              </label>
              <button
                type="submit"
                disabled={creating || nodes.length === 0}
                className="btn-primary sm:col-span-2"
              >
                {creating ? t('common.creating') : t('project.createService')}
              </button>
            </form>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function DatabasesSection({
  projectId,
  nodes,
  services,
}: {
  projectId: string;
  nodes: Node[];
  services: Service[];
}) {
  const { t } = useI18n();
  const [dbs, setDbs] = useState<ManagedDatabase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateDatabaseBody>({
    name: '',
    engine: 'POSTGRES',
    nodeId: '',
    dbName: 'app',
    username: 'app',
  });

  const refresh = () =>
    listDatabases(projectId)
      .then(setDbs)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setForm((f) => ({ ...f, nodeId: f.nodeId || nodes[0]?.id || '' }));
  }, [nodes]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createDatabase(projectId, { ...form, name: form.name.trim() });
      setForm((f) => ({ ...f, name: '' }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('db.title')}
      </h2>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {dbs.length === 0 ? (
        <div className="mb-4"><EmptyState>{t('db.none')}</EmptyState></div>
      ) : (
        <ul className="mb-4 space-y-2">
          {dbs.map((db) => (
            <DatabaseCard
              key={db.id}
              db={db}
              services={services}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <Card>
        <form onSubmit={onCreate} className="grid items-end gap-3 sm:grid-cols-2">
          <Field label={t('db.name')}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('db.name')}
              required
              className="field w-full"
            />
          </Field>
          <Field label={t('db.engine')}>
            <select
              value={form.engine}
              onChange={(e) =>
                setForm({
                  ...form,
                  engine: e.target.value as CreateDatabaseBody['engine'],
                })
              }
              className="field w-full"
            >
              <option value="POSTGRES" className="bg-ink-850">PostgreSQL</option>
              <option value="MYSQL" className="bg-ink-850">MySQL</option>
            </select>
          </Field>
          <Field label={t('db.dbName')}>
            <input
              value={form.dbName ?? ''}
              onChange={(e) => setForm({ ...form, dbName: e.target.value })}
              placeholder={t('db.dbName')}
              className="field w-full"
            />
          </Field>
          <Field label={t('db.username')}>
            <input
              value={form.username ?? ''}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={t('db.username')}
              className="field w-full"
            />
          </Field>
          <Field label={t('db.version')}>
            <input
              value={form.version ?? ''}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder={t('db.version')}
              className="field w-full"
            />
          </Field>
          <Field label={t('field.node')}>
            <select
              value={form.nodeId}
              onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
              className="field w-full"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id} className="bg-ink-850">
                  {n.name} ({n.fqdn})
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            disabled={creating || nodes.length === 0}
            className="btn-primary sm:col-span-2"
          >
            {creating ? t('db.creating') : t('db.create')}
          </button>
        </form>
      </Card>
    </section>
  );
}

function DatabaseCard({
  db,
  services,
  onChanged,
}: {
  db: ManagedDatabase;
  services: Service[];
  onChanged: () => Promise<unknown> | void;
}) {
  const { t } = useI18n();
  const [creds, setCreds] = useState<DbCredentials | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attachTo, setAttachTo] = useState('');
  const [attached, setAttached] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (!creds) {
      try {
        setCreds(await databaseCredentials(db.id));
      } catch {
        return;
      }
    }
    setRevealed(true);
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function onAttach() {
    if (!attachTo) return;
    setBusy(true);
    try {
      await attachDatabase(db.id, attachTo);
      setAttached(true);
      setTimeout(() => setAttached(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-medium text-white">{db.name}</span>{' '}
          <span className="text-sm text-neutral-500">
            {db.engine === 'POSTGRES' ? 'PostgreSQL' : 'MySQL'} {db.version}
          </span>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            {db.host}:{db.port} · {db.dbName} · {db.username}
          </p>
        </div>
        <StatusBadge status={db.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={toggleReveal} disabled={busy} className="btn-ghost text-xs">
          {revealed ? t('db.hide') : t('db.reveal')}
        </button>
        <button
          onClick={() => act(() => powerDatabase(db.id, 'start'))}
          disabled={busy}
          className="btn-ghost text-xs"
        >
          {t('service.start')}
        </button>
        <button
          onClick={() => act(() => powerDatabase(db.id, 'stop'))}
          disabled={busy}
          className="btn-ghost text-xs"
        >
          {t('service.stop')}
        </button>
        <button
          onClick={() => setShowBackups((v) => !v)}
          className="btn-ghost text-xs"
        >
          {t('backup.title')}
        </button>
        <button
          onClick={() => {
            if (confirm(t('db.deleteConfirm'))) {
              const keep = confirm(t('db.keepVolume'));
              act(() => deleteDatabase(db.id, keep));
            }
          }}
          disabled={busy}
          className="btn-danger ml-auto text-xs"
        >
          {t('service.delete')}
        </button>
      </div>

      {showBackups && <BackupsPanel kind="DATABASE" refId={db.id} />}

      {revealed && creds && (
        <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
          <CredRow label={t('db.password')} value={creds.password} onCopy={copy} copied={copied} />
          <CredRow label={t('db.url')} value={creds.url} onCopy={copy} copied={copied} />
          <p className="text-neutral-500">{t('db.internalNote')}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={attachTo}
          onChange={(e) => setAttachTo(e.target.value)}
          className="field text-xs"
        >
          <option value="" className="bg-ink-850">{t('db.selectService')}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id} className="bg-ink-850">
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={onAttach}
          disabled={busy || !attachTo}
          className="btn-ghost text-xs"
        >
          {attached ? t('db.attached') : t('db.attach')}
        </button>
        <span className="text-xs text-neutral-500">{t('db.attachHint')}</span>
      </div>
    </Card>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-neutral-300">
        {value}
      </code>
      <button
        onClick={() => onCopy(value)}
        className="shrink-0 text-neutral-400 transition-colors hover:text-white"
      >
        {copied ? t('db.copied') : t('db.copy')}
      </button>
    </div>
  );
}
