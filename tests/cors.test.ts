import { isOriginAllowed, parseAllowedOrigins } from '../src/config/cors';

describe('CORS origin matching (FRONTEND_URL)', () => {
  const allowed = parseAllowedOrigins(
    'http://localhost:5173, https://erp-billing-web.vercel.app/, https://erp-billing-web-*.vercel.app',
  );

  it('allows exact origins, ignoring trailing slashes and case', () => {
    expect(isOriginAllowed('http://localhost:5173', allowed)).toBe(true);
    expect(isOriginAllowed('https://erp-billing-web.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://ERP-Billing-Web.vercel.app/', allowed)).toBe(true);
  });

  it('allows Vercel preview URLs via the wildcard', () => {
    expect(isOriginAllowed('https://erp-billing-web-git-main-arjun.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://erp-billing-web-a1b2c3d4e-arjun.vercel.app', allowed)).toBe(true);
  });

  it('rejects other origins, including look-alikes', () => {
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(false);
    expect(isOriginAllowed('https://erp-billing-web-x.vercel.app.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('https://erp-billing-web-a.b.vercel.app', allowed)).toBe(false);
  });

  it('allows requests without an Origin header (curl, health checks)', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('allows nothing cross-origin when FRONTEND_URL is empty', () => {
    expect(isOriginAllowed('http://localhost:5173', parseAllowedOrigins(''))).toBe(false);
  });
});