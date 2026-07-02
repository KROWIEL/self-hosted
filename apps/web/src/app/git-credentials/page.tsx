'use client';

import { useEffect, useState } from 'react';
import {
  GitCredential,
  GitProvider,
  createGitCredential,
  deleteGitCredential,
  listGitCredentials,
  verifyGitCredential,
} from '@/lib/api';
import { AppShell } from '@/components/shell';
import {
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { useI18n } from '@/i18n';

export default function GitCredentialsPage() {
  const { t } = useI18n();
  const [creds, setCreds] = useState<GitCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    provider: GitProvider;
    username: string;
    pat: string;
  }>({ name: '', provider: 'GITHUB', username: '', pat: '' });

  function load() {
    setLoading(true);
    listGitCredentials()
      .then(setCreds)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createGitCredential({
        name: form.name.trim(),
        provider: form.provider,
        username: form.username.trim() || undefined,
        pat: form.pat.trim(),
      });
      setForm({ name: '', provider: 'GITHUB', username: '', pat: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t('git.confirmDelete'))) return;
    try {
      await deleteGitCredential(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('git.title')} subtitle={t('git.subtitle')} />

      {error && <ErrorBox message={error} />}

      <Card className="mb-8">
        <form onSubmit={onCreate} className="grid items-end gap-3 sm:grid-cols-2">
          <Field label={t('git.name')}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('git.namePlaceholder')}
              required
              className="field w-full"
            />
          </Field>
          <Field label={t('git.provider')}>
            <select
              value={form.provider}
              onChange={(e) =>
                setForm({ ...form, provider: e.target.value as GitProvider })
              }
              className="field w-full"
            >
              <option value="GITHUB">GitHub</option>
              <option value="GITLAB">GitLab</option>
            </select>
          </Field>
          <Field label={t('git.username')}>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={t('git.usernamePlaceholder')}
              className="field w-full"
            />
          </Field>
          <Field label={t('git.pat')}>
            <input
              type="password"
              value={form.pat}
              onChange={(e) => setForm({ ...form, pat: e.target.value })}
              placeholder={t('git.patPlaceholder')}
              required
              autoComplete="off"
              className="field w-full"
            />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? t('git.adding') : t('git.add')}
            </button>
          </div>
        </form>
      </Card>

      {loading && <Spinner />}
      {!loading && creds.length === 0 && <EmptyState>{t('git.empty')}</EmptyState>}

      <ul className="space-y-3">
        {creds.map((c) => (
          <CredItem key={c.id} cred={c} onDelete={() => onDelete(c.id)} />
        ))}
      </ul>
    </AppShell>
  );
}

function CredItem({
  cred,
  onDelete,
}: {
  cred: GitCredential;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [repoUrl, setRepoUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setResult(null);
    try {
      setResult(await verifyGitCredential(cred.id, repoUrl.trim()));
    } catch (e) {
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : t('common.failed'),
      });
    } finally {
      setVerifying(false);
    }
  }

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
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.5 1.3a12 12 0 0 0-6.3 0C6.5 2 5.5 2.3 5.5 2.3a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 8.7c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V20" />
            </svg>
          </span>
          <div>
            <p className="font-medium text-white">{cred.name}</p>
            <p className="font-mono text-xs text-neutral-500">
              {cred.provider}
              {cred.username ? ` · ${cred.username}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-neutral-500 transition-colors hover:text-red-400"
        >
          {t('common.delete')}
        </button>
      </div>

      <form onSubmit={onVerify} className="mt-4 flex flex-wrap items-end gap-2">
        <Field label={t('git.repoLabel')} className="flex-1 min-w-[16rem]">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder={t('git.verifyRepoPlaceholder')}
            className="field w-full"
          />
        </Field>
        <button
          type="submit"
          disabled={verifying || repoUrl.trim().length === 0}
          className="btn-ghost"
        >
          {verifying ? t('git.verifying') : t('git.verify')}
        </button>
      </form>
      {result ? (
        <p
          className={`mt-2 text-xs ${
            result.ok ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {result.message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">{t('git.verifyHint')}</p>
      )}
    </Card>
  );
}
