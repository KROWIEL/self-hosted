'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { ErrorBox } from '@/components/ui';
import { useI18n } from '@/i18n';
import { LangSwitcher } from '@/components/lang-switcher';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <LangSwitcher />
      </div>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-glow">
            <span className="h-4 w-4 rounded-md bg-white/90" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t('login.welcome')}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-7">
          {error && <ErrorBox message={error} />}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
