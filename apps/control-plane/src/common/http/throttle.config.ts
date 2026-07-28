import '../config/load-env';

/**
 * Rate-limit budgets, read once at import time.
 *
 * Defaults are the production-safe values; `NODE_ENV=development` relaxes them
 * so hot-reloads, repeated logins and several open tabs don't trip the limiter
 * locally. An unset `NODE_ENV` keeps the strict defaults on purpose — a missing
 * variable must never silently widen the limits in production. Every value can
 * be overridden explicitly via env.
 */
const isDev = process.env.NODE_ENV === 'development';

function envInt(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

/** Window every limit below is measured over. */
export const THROTTLE_TTL_MS = envInt('THROTTLE_TTL_MS', 60_000);

/** Global cap per client IP, across every route. */
export const THROTTLE_LIMIT = envInt('THROTTLE_LIMIT', isDev ? 2000 : 120);

/** Brute-force sensitive routes: login, 2FA, password changes. */
export const THROTTLE_AUTH_LIMIT = envInt('THROTTLE_AUTH_LIMIT', isDev ? 100 : 5);

/** Token refresh — several tabs can legitimately burst these at once. */
export const THROTTLE_REFRESH_LIMIT = envInt(
  'THROTTLE_REFRESH_LIMIT',
  isDev ? 200 : 10,
);
