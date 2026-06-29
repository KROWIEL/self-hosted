'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Project,
  createProject,
  deleteProject,
  listProjects,
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
import { useI18n, useTypeLabel } from '@/i18n';

export default function DashboardPage() {
  const { t } = useI18n();
  const typeLabel = useTypeLabel();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createProject(name.trim());
      setName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t('projects.confirmDelete'))) return;
    try {
      await deleteProject(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
      />

      <form onSubmit={onCreate} className="mb-8 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.newPlaceholder')}
          className="field flex-1"
        />
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? t('common.creating') : t('common.create')}
        </button>
      </form>

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && projects.length === 0 && (
        <EmptyState>{t('projects.empty')}</EmptyState>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id} hover>
            <div className="mb-4 flex items-start justify-between">
              <Link
                href={`/projects/${p.id}`}
                className="text-lg font-semibold text-white transition-colors hover:text-indigo-300"
              >
                {p.name}
              </Link>
              <button
                onClick={() => onDelete(p.id)}
                className="text-xs text-neutral-500 transition-colors hover:text-red-400"
              >
                {t('common.delete')}
              </button>
            </div>
            {p.services.length === 0 ? (
              <p className="text-sm text-neutral-500">{t('projects.noServices')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {p.services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <Link
                      href={`/services/${s.id}`}
                      className="text-neutral-300 transition-colors hover:text-indigo-300"
                    >
                      {s.name}{' '}
                      <span className="text-neutral-600">({typeLabel(s.type)})</span>
                    </Link>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </ul>
    </AppShell>
  );
}
