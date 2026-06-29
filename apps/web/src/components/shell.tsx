'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthed, logout } from '@/lib/api';
import { TKey, useI18n } from '@/i18n';
import { LangSwitcher } from '@/components/lang-switcher';

const NAV: { href: string; label: TKey }[] = [
  { href: '/dashboard', label: 'nav.projects' },
  { href: '/nodes', label: 'nav.nodes' },
  { href: '/templates', label: 'nav.templates' },
  { href: '/git-credentials', label: 'nav.git' },
];

/**
 * Client-side auth guard + app chrome. Redirects to /login when no token.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-7">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-glow">
                <span className="h-3 w-3 rounded-[5px] bg-white/90" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                Self-Hosted
              </span>
            </Link>
            <div className="flex gap-1 text-sm">
              {NAV.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {t(item.label)}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:text-white"
            >
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl animate-fade-up p-6 py-8">
        {children}
      </main>
    </div>
  );
}
