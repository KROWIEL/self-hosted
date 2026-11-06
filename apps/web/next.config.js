/**
 * Next.js configuration.
 *
 * Adds baseline security headers to every route. The Content-Security-Policy is
 * NOT set here: the app-router serves inline bootstrap/flight scripts that need
 * a per-request nonce, which a static headers() policy cannot emit. CSP is owned
 * by src/middleware.ts instead (see that file). Keeping a CSP here too would
 * produce a conflicting second policy header.
 */

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image. The tracing root is the
  // monorepo root so workspace packages are included.
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
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
