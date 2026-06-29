'use client';

import { useEffect, useState } from 'react';
import { Template, listTemplates } from '@/lib/api';
import { AppShell } from '@/components/shell';
import { Card, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { TKey, useI18n, useTypeLabel } from '@/i18n';

// Maps a built-in template name to a localized description key.
const DESC_KEYS: Record<string, TKey> = {
  'Java 21 (Maven)': 'templates.desc.javaMaven',
  'Java 25 (Gradle)': 'templates.desc.javaGradle',
  'Next.js 20': 'templates.desc.nextjs',
  'React (Vite)': 'templates.desc.reactVite',
};

export default function TemplatesPage() {
  const { t } = useI18n();
  const typeLabel = useTypeLabel();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <PageHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
      />

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      <ul className="grid gap-4 md:grid-cols-2">
        {templates.map((tpl) => {
          const descKey = DESC_KEYS[tpl.name];
          const description = descKey ? t(descKey) : tpl.description;
          return (
            <Card key={tpl.id} hover>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-white">{tpl.name}</h2>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
                  {typeLabel(tpl.type)} · :{tpl.defaultPort}
                </span>
              </div>
              <p className="text-sm text-neutral-400">{description}</p>
              {tpl.isBuiltIn && (
                <span className="mt-3 inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-neutral-500">
                  {t('templates.builtIn')}
                </span>
              )}
            </Card>
          );
        })}
      </ul>
    </AppShell>
  );
}
