/**
 * Next.js configuration.
 *
 * Adds baseline security headers (incl. a Content-Security-Policy) to every
 * route. The CSP is deliberately permissive enough not to break the app:
 * inline styles (Tailwind / xterm), data:/https: images (branding logos) and
 * connections to the API + exec WebSocket are all allowed.
 */

/**
 * Derive the API origins (http(s) + matching ws(s)) from NEXT_PUBLIC_API_URL so
 * both fetch() calls and the interactive-exec WebSocket are allowed by
 * connect-src. Returns [] when the URL is unset/invalid.
 * @returns {string[]}
 */
function apiConnectSrc() {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return [u.origin, `${wsScheme}//${u.host}`];
  } catch {
    return [];
  }
}

function contentSecurityPolicy() {
  const isProd = process.env.NODE_ENV === 'production';
  const connectSrc = ["'self'", ...apiConnectSrc()].join(' ');

  // Next.js dev (HMR / React Refresh) requires 'unsafe-eval' and inline
  // scripts. Production keeps a tight script-src. NOTE: if a production build
  // fails to hydrate under 'self', add 'unsafe-inline' (and, if truly needed,
  // 'unsafe-eval') here — see the commit message for this file.
  const scriptSrc = isProd
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
