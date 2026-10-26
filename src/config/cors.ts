export type AllowedOrigin = string | RegExp;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parses FRONTEND_URL: a comma-separated list of origins.
 * An entry may contain `*` as a wildcard for one hostname segment, e.g.
 * https://erp-billing-web-*.vercel.app  (matches Vercel preview deployments).
 * Trailing slashes are ignored.
 */
export function parseAllowedOrigins(value: string | undefined): AllowedOrigin[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((o) =>
      o.includes('*')
        ? new RegExp(`^${o.split('*').map(escapeRegex).join('[a-z0-9-]+')}$`, 'i')
        : o.toLowerCase(),
    );
}

/** Requests without an Origin header (curl, server-to-server, health checks) are allowed. */
export function isOriginAllowed(origin: string | undefined, allowed: AllowedOrigin[]): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, '').toLowerCase();
  return allowed.some((a) => (typeof a === 'string' ? a === normalized : a.test(normalized)));
}