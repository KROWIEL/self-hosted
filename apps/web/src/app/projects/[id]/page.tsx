'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CreateServiceBody,
  GitCredential,
  Node,
  Project,
  Template,
  createService,
  getProject,
  listGitCredentials,
  listNodes,
  listTemplates,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import {
  Card,
  EmptyState,
  ErrorBox,
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

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t('project.newService')}
          </h2>
          <Card>
            {nodes.length === 0 && (
              <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-300">
                {t('project.registerNodeFirst')}
              </p>
            )}
            <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('project.serviceName')}
                required
                className="field"
              />
              <input
                value={form.repoUrl}
                onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                placeholder={t('project.repoPlaceholder')}
                required
                className="field"
              />
              <select
                value={form.templateId}
                onChange={(e) => onTemplate(e.target.value)}
                className="field"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id} className="bg-ink-850">
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
              <select
                value={form.nodeId}
                onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
                className="field"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id} className="bg-ink-850">
                    {n.name} ({n.fqdn})
                  </option>
                ))}
              </select>
              <input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder={t('project.branch')}
                className="field"
              />
              <input
                type="number"
                value={form.port ?? ''}
                onChange={(e) =>
                  setForm({ ...form, port: Number(e.target.value) })
                }
                placeholder={t('project.port')}
                className="field"
              />
              <label className="sm:col-span-2">
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
                <span className="mt-1 block text-xs text-neutral-500">
                  {t('project.gitCredHint')}
                </span>
              </label>
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
