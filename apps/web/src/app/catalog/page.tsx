'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CatalogApp,
  Node,
  Project,
  installCatalogApp,
  listCatalog,
  listNodes,
  listProjects,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { CatalogIcon } from '@/components/catalog-icons';
import { Lang, TKey, useCategoryLabel, useErrorText, useI18n } from '@/i18n';

/** Sentinel for the "no category filter" chip. */
const ALL = '*';

/** Manifests carry English text plus optional per-locale overrides. */
function localized(app: CatalogApp, lang: Lang) {
  const tr = app.translations?.[lang];
  return {
    name: tr?.name || app.name,
    description: tr?.description || app.description,
  };
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? 'border-violet-400/40 bg-violet-500/20 text-violet-100'
          : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-neutral-200'
      }`}
    >
      {label}
      <span className="ml-1.5 text-neutral-500">{count}</span>
    </button>
  );
}

export default function CatalogPage() {
  const { t, lang } = useI18n();
  const categoryLabel = useCategoryLabel();
  const errText = useErrorText();
  const toast = useToast();
  const router = useRouter();

  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<CatalogApp | null>(null);
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  useEffect(() => {
    listCatalog()
      .then(setApps)
      .catch((e) => toast.error(errText(e)))
      .finally(() => setLoading(false));
  }, [errText, toast]);

  /** Categories present in the catalog, with counts, sorted by localized name. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of apps) {
      const cat = app.category || 'Apps';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) =>
      categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), lang),
    );
  }, [apps, categoryLabel, lang]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (category !== ALL && (app.category || 'Apps') !== category) return false;
      if (!q) return true;
      const { name, description } = localized(app, lang);
      return (
        name.toLowerCase().includes(q) ||
        app.slug.includes(q) ||
        (description ?? '').toLowerCase().includes(q)
      );
    });
  }, [apps, category, lang, query]);

  return (
    <AppShell>
      <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle')} />
      {loading ? (
        <Spinner />
      ) : apps.length === 0 ? (
        <EmptyState>{t('catalog.empty')}</EmptyState>
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <input
              className="field w-full sm:max-w-xs"
              type="search"
              value={query}
              placeholder={t('catalog.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('catalog.searchPlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label={t('catalog.filter.all')}
                count={apps.length}
                active={category === ALL}
                onClick={() => setCategory(ALL)}
              />
              {categories.map(([cat, count]) => (
                <FilterChip
                  key={cat}
                  label={categoryLabel(cat)}
                  count={count}
                  active={category === cat}
                  onClick={() => setCategory(cat)}
                />
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState>{t('catalog.noMatches')}</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((app) => (
                <article
                  key={app.slug}
                  className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-300">
                      <CatalogIcon icon={app.icon} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-white">
                        {localized(app, lang).name}
                      </h3>
                      <p className="truncate text-xs text-neutral-500">
                        {categoryLabel(app.category || 'Apps')}
                      </p>
                    </div>
                  </div>
                  <p className="mb-3 flex-1 text-sm text-neutral-400">
                    {localized(app, lang).description}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span>{t(`catalog.kind.${app.deployKind}` as TKey)}</span>
                    {app.defaultPort != null && <span>:{app.defaultPort}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-sm self-start"
                    onClick={() => setInstalling(app)}
                  >
                    {t('catalog.install')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {installing && (
        <InstallModal
          app={installing}
          onClose={() => setInstalling(null)}
          onInstalled={(serviceId) => {
            setInstalling(null);
            toast.success(t('catalog.installed'));
            router.push(`/services/${serviceId}`);
          }}
        />
      )}
    </AppShell>
  );
}

function InstallModal({
  app,
  onClose,
  onInstalled,
}: {
  app: CatalogApp;
  onClose: () => void;
  onInstalled: (serviceId: string) => void;
}) {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [projectId, setProjectId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [name, setName] = useState(app.name);
  const [env, setEnv] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (app.envDefaults ?? [])
        .filter((e) => e.value !== undefined)
        .map((e) => [e.key, e.value!]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listProjects(), listNodes()])
      .then(([ps, ns]) => {
        setProjects(ps);
        setNodes(ns);
        setProjectId(ps[0]?.id ?? '');
        setNodeId(ns[0]?.id ?? '');
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await installCatalogApp(app.slug, {
        projectId,
        nodeId,
        name: name.trim() || app.name,
        env,
      });
      onInstalled(res.service.id);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${t('catalog.install')}: ${localized(app, lang).name}`}
      onClose={onClose}
    >
      {err && (
        <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {err}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label={t('catalog.serviceName')}>
          <input
            className="field w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label={t('catalog.pickProject')}>
          <select
            className="field w-full"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-ink-850">
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.pickNode')}>
          <select
            className="field w-full"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            required
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id} className="bg-ink-850">
                {n.name} ({n.fqdn})
              </option>
            ))}
          </select>
        </Field>
        {app.envDefaults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-300">
              {t('catalog.envTitle')}
            </p>
            {app.envDefaults.map((def) => (
              <Field
                key={def.key}
                label={
                  def.required
                    ? `${def.key} (${t('catalog.envRequired')})`
                    : def.key
                }
              >
                <input
                  className="field w-full"
                  type={def.secret ? 'password' : 'text'}
                  value={env[def.key] ?? ''}
                  onChange={(e) =>
                    setEnv({ ...env, [def.key]: e.target.value })
                  }
                  required={!!def.required}
                />
              </Field>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !projectId || !nodeId}
          >
            {busy ? t('catalog.installing') : t('catalog.install')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
