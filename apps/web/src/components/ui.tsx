'use client';

import { ReactNode } from 'react';
import { useI18n, useStatusLabel } from '@/i18n';

type Tone = 'green' | 'amber' | 'sky' | 'neutral' | 'red';

const STATUS_TONE: Record<string, Tone> = {
  RUNNING: 'green',
  SUCCESS: 'green',
  ONLINE: 'green',
  BUILDING: 'amber',
  DEPLOYING: 'amber',
  QUEUED: 'sky',
  CREATED: 'neutral',
  STOPPED: 'neutral',
  OFFLINE: 'neutral',
  ERROR: 'red',
  FAILED: 'red',
};

const TONE_CLASSES: Record<Tone, string> = {
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  sky: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  neutral: 'border-white/15 bg-white/5 text-neutral-300',
  red: 'border-red-400/30 bg-red-400/10 text-red-300',
};

const DOT_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  amber: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
  sky: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]',
  neutral: 'bg-neutral-500',
  red: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]',
};

export function StatusBadge({ status }: { status: string }) {
  const statusLabel = useStatusLabel();
  const tone = STATUS_TONE[status] ?? 'neutral';
  const pulse = tone === 'amber' || tone === 'sky';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]} ${
          pulse ? 'animate-pulse' : ''
        }`}
      />
      {statusLabel(status)}
    </span>
  );
}

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`glass ${hover ? 'glass-hover' : ''} rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 text-sm text-neutral-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      {label ?? t('common.loading')}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}
