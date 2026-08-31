/**
 * Phase 5 — Compliance, Privacy & Admin Tooling — Tests
 *
 * Validates:
 * - Cookie consent is rendered in root layout
 * - Account data export covers all user tables
 * - Account deletion cascades through all tables in FK order
 * - Admin payments API + dashboard wiring
 * - Compliance scanner and approved claims library
 * - Plausible analytics with custom events
 *
 * Risk mitigations:
 * - R1: Data deletion misses a table → verify all tables in deletion order
 * - R2: Cookie consent blocks Sentry → verify Sentry operates independently
 * - R3: Admin refund accidental trigger → verify confirmation flow + audit logging
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  1. Cookie consent — rendered in root layout                       */
/* ================================================================== */

describe('5a: Cookie consent in root layout', () => {
  const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
  const layoutSource = fs.readFileSync(layoutPath, 'utf-8');

  it('imports CookieConsent component', () => {
    expect(layoutSource).toContain(
      "import { CookieConsent } from '@/components/cookie-consent'",
    );
  });

  it('renders <CookieConsent />', () => {
    expect(layoutSource).toContain('<CookieConsent />');
  });

  it('imports PlausibleAnalytics component', () => {
    expect(layoutSource).toContain(
      "import { PlausibleAnalytics } from '@/components/analytics'",
    );
  });

  it('renders <PlausibleAnalytics />', () => {
    expect(layoutSource).toContain('<PlausibleAnalytics />');
  });
});

describe('5a (cont): Cookie consent component', () => {
  const consentPath = path.resolve(
    __dirname,
    '../components/cookie-consent.tsx',
  );
  const consentSource = fs.readFileSync(consentPath, 'utf-8');

  it('is a client component', () => {
    expect(consentSource).toContain("'use client'");
  });

  it('uses localStorage to store consent', () => {
    expect(consentSource).toContain('localStorage.getItem');
    expect(consentSource).toContain('localStorage.setItem');
  });

  it('stores consent with a named key', () => {
    expect(consentSource).toContain('resolvaio_cookie_consent');
  });

  it('notes that Plausible is cookie-free', () => {
    expect(consentSource).toContain('cookie-free');
  });

  it('has an accept button', () => {
    expect(consentSource).toContain('handleAccept');
    expect(consentSource).toContain('Got it');
  });
});

/* ================================================================== */
/*  2. Account data export                                            */
/* ================================================================== */

describe('5b: Account data export API', () => {
  const exportPath = path.resolve(
    __dirname,
    '../app/api/account/export/route.ts',
  );
  const exportSource = fs.readFileSync(exportPath, 'utf-8');

  it('exports a GET handler', () => {
    expect(exportSource).toContain('export async function GET()');
  });

  it('requires authentication', () => {
    // Convex migration: supabase.auth.getUser() -> currentUser()
    expect(exportSource).toContain('currentUser()');
    expect(exportSource).toContain('Unauthorized');
  });

  const requiredTables = [
    'cases',
    'documents',
    'letters',
    'sequences',
    'packets',
    'deadline_events',
    'outcomes',
    'subscriptions',
  ];

  for (const table of requiredTables) {
    it(`exports ${table} data`, () => {
      // Convex migration: per-table Supabase queries replaced by the single
      // account.exportMine query; each dataset is pulled off `data.<table>`
      // and emitted as a `<table>:` key on the export payload.
      expect(exportSource).toContain(`data.${table}`);
      expect(exportSource).toContain(`${table}:`);
    });
  }

  it('returns JSON with Content-Disposition header (file download)', () => {
    expect(exportSource).toContain('Content-Disposition');
    expect(exportSource).toContain('attachment; filename=');
  });

  it('includes user metadata in export', () => {
    expect(exportSource).toContain('user.id');
    expect(exportSource).toContain('user.email');
  });
});

/* ================================================================== */
/*  3. Account data deletion                                          */
/* ================================================================== */

describe('5b (cont): Account data deletion API', () => {
  const deletePath = path.resolve(
    __dirname,
    '../app/api/account/delete/route.ts',
  );
  const deleteSource = fs.readFileSync(deletePath, 'utf-8');

  it('exports a DELETE handler that reads the request (not a 405 stub)', () => {
    // Must take the request (to read the confirmation body) — the old
    // `DELETE()` no-arg stub just returned 405 while the real cascade sat in a
    // POST the client never called, so deletion always failed.
    expect(deleteSource).toContain('export async function DELETE(request: Request)');
    // And it must actually run the cascade, not reject the method.
    expect(deleteSource).toContain('deleteMyAccountCascade');
    expect(deleteSource).not.toContain("status: 405");
  });

  it('the settings client sends a DELETE with the confirmation phrase', () => {
    // Client + server must agree on one contract: method DELETE, body carrying
    // the confirmation phrase the schema requires.
    const settingsSrc = fs.readFileSync(
      path.resolve(__dirname, '../app/(app)/settings/page.tsx'),
      'utf-8',
    );
    expect(settingsSrc).toContain("method: 'DELETE'");
    expect(settingsSrc).toContain('DELETE MY ACCOUNT');
  });

  // Convex migration: the per-table Supabase cascade moved into an atomic Convex
  // mutation (account.deleteMyAccountCascade). The route now just calls it, then
  // cleans up R2 objects and deletes the auth user. Table-level coverage and
  // FK-safe ordering are therefore asserted against the cascade implementation.
  const cascadeSource = fs.readFileSync(
    path.resolve(__dirname, '../../convex/account.ts'),
    'utf-8',
  );

  it('requires authentication', () => {
    // Convex migration: supabase.auth.getUser() -> currentUser()
    expect(deleteSource).toContain('currentUser()');
    expect(deleteSource).toContain('Unauthorized');
  });

  it('uses service-role client for admin operations', () => {
    // Convex migration: createServiceRoleClient() -> createServiceConvexClient()
    // (trusted, service-secret-gated Convex client) for the R2 + auth-user deletes.
    expect(deleteSource).toContain('createServiceConvexClient');
  });

  // R1 risk mitigation: verify ALL child tables are deleted by the cascade
  // mutation. Convex table names are camelCase (deadlineEvents, caseStatusHistory).
  const deletionOrder = [
    'deadlineEvents',
    'outcomes',
    'packets',
    'letters',
    'sequences',
    'documents',
    'caseStatusHistory',
  ];

  for (const table of deletionOrder) {
    it(`deletes ${table} (child table)`, () => {
      expect(cascadeSource).toContain(`.query('${table}')`);
    });
  }

  it('deletes cases after child tables', () => {
    // FK-safe order: every child table delete precedes `ctx.db.delete(caseId)`.
    const childDeletion = cascadeSource.indexOf("query('caseStatusHistory')");
    const casesDeletion = cascadeSource.indexOf('ctx.db.delete(caseId)');
    expect(childDeletion).toBeGreaterThan(-1);
    expect(casesDeletion).toBeGreaterThan(childDeletion);
  });

  it('deletes subscriptions', () => {
    // Convex migration: subscriptions removed in the cascade via the by_user index.
    expect(cascadeSource).toContain("query('subscriptions')");
  });

  it('deletes waitlist entries by email', () => {
    // Waitlist rows are keyed by email, not userId, so they fall outside the
    // per-user cascade (account.deleteMyAccountCascade). The route restores the
    // old Supabase behavior by calling api.service.deleteWaitlistByEmail with the
    // user's email after the cascade — closing the GDPR right-to-erasure gap the
    // Convex migration had introduced.
    expect(deleteSource).toContain('api.service.deleteWaitlistByEmail');
    expect(deleteSource).toContain('user.email');
  });

  it('deletes storage files (best-effort)', () => {
    // Convex migration: Supabase storage.remove(paths) -> R2 object deletion via
    // api.service.deleteObjects, keyed by the R2 keys the cascade returns.
    expect(deleteSource).toContain('api.service.deleteObjects');
    expect(deleteSource).toContain('r2Keys');
  });

  it('deletes the auth user', () => {
    // Convex migration: supabase.auth.admin.deleteUser(userId) -> api.service.deleteUser
    expect(deleteSource).toContain('api.service.deleteUser');
  });

  it('returns deletion counts', () => {
    expect(deleteSource).toContain('ok: true');
    expect(deleteSource).toContain('deleted:');
  });
});

/* ================================================================== */
/*  4. Account settings page                                          */
/* ================================================================== */

describe('5b (cont): Account settings page', () => {
  const settingsPath = path.resolve(
    __dirname,
    '../app/(app)/settings/page.tsx',
  );
  const settingsSource = fs.readFileSync(settingsPath, 'utf-8');

  it('exists and is a client component', () => {
    expect(settingsSource).toContain("'use client'");
  });

  it('has data export button calling /api/account/export', () => {
    expect(settingsSource).toContain('/api/account/export');
    expect(settingsSource).toContain('Download My Data');
  });

  it('has account deletion button calling /api/account/delete', () => {
    expect(settingsSource).toContain('/api/account/delete');
    expect(settingsSource).toContain("method: 'DELETE'");
  });

  it('has confirmation step before deletion', () => {
    expect(settingsSource).toContain('deleteConfirm');
    expect(settingsSource).toContain('Are you sure');
    expect(settingsSource).toContain('cannot be undone');
  });

  it('mentions GDPR/CCPA rights', () => {
    expect(settingsSource).toContain('GDPR');
    expect(settingsSource).toContain('CCPA');
  });
});

/* ================================================================== */
/*  5. Admin payments API                                             */
/* ================================================================== */

describe('5c: Admin payments API', () => {
  const paymentsPath = path.resolve(
    __dirname,
    '../app/api/admin/payments/route.ts',
  );
  const paymentsSource = fs.readFileSync(paymentsPath, 'utf-8');

  it('exports GET handler (list payments)', () => {
    expect(paymentsSource).toContain('export async function GET()');
  });

  it('exports POST handler (issue refund)', () => {
    expect(paymentsSource).toContain('export async function POST(request');
  });

  it('requires admin auth for GET', () => {
    expect(paymentsSource).toContain('requireAdmin()');
  });

  it('queries webhook_events for transaction data', () => {
    // Convex migration: supabase.from('webhook_events') -> api.service.listRecentWebhooks
    expect(paymentsSource).toContain('api.service.listRecentWebhooks');
  });

  it('filters for order events', () => {
    expect(paymentsSource).toContain("order.");
  });

  it('extracts amount and status from the stored payload', () => {
    // The webhook row's `payload` holds the Polar event; amount/status are read
    // from payload.data (totalAmount is integer cents).
    expect(paymentsSource).toContain('payload');
    expect(paymentsSource).toContain('totalAmount');
    expect(paymentsSource).toContain('status');
  });

  it('POST validates order_id', () => {
    expect(paymentsSource).toContain('Missing order_id');
  });

  it('POST checks for the Polar access token', () => {
    expect(paymentsSource).toContain('POLAR_ACCESS_TOKEN');
    expect(paymentsSource).toContain('Polar access token not configured');
  });

  it('POST calls the Polar refund API by order id', () => {
    expect(paymentsSource).toContain('polar.refunds.create');
    expect(paymentsSource).toContain('orderId');
  });

  it('POST logs admin action to audit_log (R3 mitigation)', () => {
    // Convex migration: supabase.from('audit_log').insert(...) -> api.service.insertAudit
    expect(paymentsSource).toContain('api.service.insertAudit');
    expect(paymentsSource).toContain('admin-refund-');
    expect(paymentsSource).toContain('admin_email');
  });
});

/* ================================================================== */
/*  6. Admin dashboard payments tab                                   */
/* ================================================================== */

describe('5c (cont): Admin dashboard payments tab', () => {
  const dashboardPath = path.resolve(
    __dirname,
    '../features/admin/components/admin-dashboard.tsx',
  );
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf-8');

  it('has payments tab', () => {
    expect(dashboardSource).toContain("id: 'payments'");
  });

  it('fetches from /api/admin/payments', () => {
    expect(dashboardSource).toContain('/api/admin/payments');
  });

  it('renders payment transaction table', () => {
    expect(dashboardSource).toContain('Payment Transactions');
    expect(dashboardSource).toContain('order_id');
  });

  it('has refund button for completed transactions', () => {
    expect(dashboardSource).toContain('handleRefund');
    expect(dashboardSource).toContain('Refund');
  });

  it('uses confirm dialog before refund (R3 mitigation)', () => {
    expect(dashboardSource).toContain('confirm(');
    expect(dashboardSource).toContain('Are you sure you want to refund');
  });

  it('shows refunding state', () => {
    expect(dashboardSource).toContain('refundingTxn');
    expect(dashboardSource).toContain('Refunding...');
  });
});

/* ================================================================== */
/*  7. Compliance scanner                                             */
/* ================================================================== */

describe('5d: Compliance scanner — prohibited phrases', () => {
  const scannerPath = path.resolve(
    __dirname,
    '../../scripts/scan-prohibited-phrases.ts',
  );
  const scannerSource = fs.readFileSync(scannerPath, 'utf-8');

  it('reads from rules/prohibited-phrases.md', () => {
    expect(scannerSource).toContain('prohibited-phrases.md');
  });

  it('scans src/ and kb/ directories', () => {
    // Scanner redesign (pre-commit style): instead of walking src/ and kb/
    // directory trees, it now scans staged git files (covering src/ and kb/
    // changes), filtered to scannable source extensions.
    expect(scannerSource).toContain('git diff --cached --name-only');
    expect(scannerSource).toContain('SCANNABLE_EXTENSIONS');
  });

  it('skips node_modules and .next', () => {
    // Scanner redesign: node_modules/.next are inherently excluded because only
    // staged, tracked, scannable-extension files are scanned. Rules dir and test
    // files are explicitly excluded.
    expect(scannerSource).toContain("relPath.startsWith('rules')");
    // --diff-filter=d excludes deleted files (only real, tracked source is scanned)
    expect(scannerSource).toContain('--diff-filter=d');
  });

  it('skips test files', () => {
    expect(scannerSource).toContain('.test.');
    expect(scannerSource).toContain('.spec.');
    expect(scannerSource).toContain('__tests__');
  });

  it('exits with code 1 on violations', () => {
    expect(scannerSource).toContain('process.exit(1)');
  });

  it('exits with code 0 when clean', () => {
    expect(scannerSource).toContain('process.exit(0)');
  });
});

/* ================================================================== */
/*  8. Approved claims library                                        */
/* ================================================================== */

describe('5d (cont): Approved claims library', () => {
  const claimsPath = path.resolve(
    __dirname,
    '../../kb/compliance/approved-claims-library.json',
  );
  const claimsRaw = JSON.parse(
    fs.readFileSync(claimsPath, 'utf-8'),
  ) as Record<string, unknown>;

  it('has a version number', () => {
    expect(claimsRaw['version']).toBeTruthy();
  });

  it('has reviewed_by field (may need legal sign-off)', () => {
    expect(claimsRaw['reviewed_by']).toBeTruthy();
  });

  it('has at least 5 approved claims', () => {
    const claims = claimsRaw['approved_claims'] as Record<string, unknown>[];
    expect(claims.length).toBeGreaterThanOrEqual(5);
  });

  it('most claims have prohibited_variations', () => {
    const claims = claimsRaw['approved_claims'] as { claim_id: string; prohibited_variations?: string[] }[];
    const withVariations = claims.filter((c) => c.prohibited_variations && c.prohibited_variations.length > 0);
    // At least 80% of claims should have prohibited variations
    expect(withVariations.length).toBeGreaterThanOrEqual(Math.floor(claims.length * 0.8));
  });

  it('has absolute_prohibitions list', () => {
    const prohibitions = claimsRaw['absolute_prohibitions'] as string[];
    expect(prohibitions.length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/*  9. Claims validation script                                       */
/* ================================================================== */

describe('5d (cont): Claims validation script', () => {
  const validatePath = path.resolve(
    __dirname,
    '../../scripts/validate-claims.ts',
  );
  const validateSource = fs.readFileSync(validatePath, 'utf-8');

  it('reads approved-claims-library.json', () => {
    expect(validateSource).toContain('approved-claims-library.json');
  });

  it('checks prohibited_variations from each claim', () => {
    expect(validateSource).toContain('prohibited_variations');
  });

  it('checks absolute_prohibitions', () => {
    expect(validateSource).toContain('absolute_prohibitions');
  });

  it('scans marketing-facing files', () => {
    expect(validateSource).toContain('about/page.tsx');
    expect(validateSource).toContain('empty-state.tsx');
    expect(validateSource).toContain('templates.ts');
  });

  it('exits with code 1 on violations', () => {
    expect(validateSource).toContain('process.exit(1)');
  });

  it('exits with code 0 when clean', () => {
    expect(validateSource).toContain('process.exit(0)');
  });
});

/* ================================================================== */
/*  10. npm scripts for compliance                                    */
/* ================================================================== */

describe('5d (cont): npm compliance scripts', () => {
  const packagePath = path.resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packagePath, 'utf-8'),
  ) as { scripts: Record<string, string> };

  it('has scan-phrases script', () => {
    expect(packageJson.scripts['scan-phrases']).toContain(
      'scan-prohibited-phrases',
    );
  });

  it('has validate-claims script', () => {
    expect(packageJson.scripts['validate-claims']).toContain(
      'validate-claims',
    );
  });

  it('has compliance-check script combining both', () => {
    expect(packageJson.scripts['compliance-check']).toContain('scan-phrases');
    expect(packageJson.scripts['compliance-check']).toContain(
      'validate-claims',
    );
  });
});

/* ================================================================== */
/*  11. Plausible analytics — custom events                           */
/* ================================================================== */

describe('5e: Plausible analytics custom events', () => {
  const analyticsPath = path.resolve(
    __dirname,
    '../components/analytics.tsx',
  );
  const analyticsSource = fs.readFileSync(analyticsPath, 'utf-8');

  it('is a client component', () => {
    expect(analyticsSource).toContain("'use client'");
  });

  it('exports PlausibleAnalytics component', () => {
    expect(analyticsSource).toContain(
      'export function PlausibleAnalytics()',
    );
  });

  it('uses NEXT_PUBLIC_PLAUSIBLE_DOMAIN env var', () => {
    expect(analyticsSource).toContain('NEXT_PUBLIC_PLAUSIBLE_DOMAIN');
  });

  it('loads Plausible script from plausible.io', () => {
    expect(analyticsSource).toContain('plausible.io/js/script.js');
  });

  it('returns null when domain not configured', () => {
    expect(analyticsSource).toContain('if (!domain) return null');
  });

  const customEvents = [
    { fn: 'trackCaseCreated', event: 'case_created' },
    { fn: 'trackDiagnosticCompleted', event: 'diagnostic_completed' },
    { fn: 'trackLetterGenerated', event: 'letter_generated' },
    { fn: 'trackLetterSent', event: 'letter_sent' },
    { fn: 'trackOutcomeReported', event: 'outcome_reported' },
  ];

  for (const { fn, event } of customEvents) {
    it(`exports ${fn}() for '${event}' event`, () => {
      expect(analyticsSource).toContain(`export function ${fn}`);
      expect(analyticsSource).toContain(`'${event}'`);
    });
  }

  it('has a generic trackEvent helper', () => {
    expect(analyticsSource).toContain('function trackEvent');
    expect(analyticsSource).toContain('window.plausible');
  });

  it('is a no-op when Plausible is not loaded', () => {
    expect(analyticsSource).toContain('typeof window');
    expect(analyticsSource).toContain('window.plausible');
  });
});

/* ================================================================== */
/*  12. Sentry — operates independently of cookie consent             */
/* ================================================================== */

describe('5a (risk R2): Sentry operates independently', () => {
  const sentryPath = path.resolve(__dirname, '../lib/sentry.ts');
  const sentrySource = fs.readFileSync(sentryPath, 'utf-8');

  it('initializes from env var (not cookie consent)', () => {
    expect(sentrySource).toContain('SENTRY_DSN');
    // Should NOT reference cookie consent or localStorage
    expect(sentrySource).not.toContain('cookie_consent');
    expect(sentrySource).not.toContain('localStorage');
  });

  it('scrubs PII from events', () => {
    expect(sentrySource).toContain('beforeSend');
  });
});

/* ================================================================== */
/*  13. Admin auth — protects all admin endpoints                     */
/* ================================================================== */

describe('5c (cont): Admin auth', () => {
  const authPath = path.resolve(__dirname, '../lib/admin/auth.ts');
  const authSource = fs.readFileSync(authPath, 'utf-8');

  it('checks ADMIN_EMAILS environment variable', () => {
    expect(authSource).toContain('ADMIN_EMAILS');
  });

  it('compares email case-insensitively', () => {
    expect(authSource).toContain('.toLowerCase()');
  });

  it('returns authorized: true for admin users', () => {
    expect(authSource).toContain('authorized: true');
  });

  it('returns authorized: false for non-admin users', () => {
    expect(authSource).toContain('authorized: false');
  });

  // Verify all admin routes use requireAdmin
  const adminRoutes = [
    '../app/api/admin/payments/route.ts',
    '../app/api/admin/stats/route.ts',
    '../app/api/admin/cases/route.ts',
    '../app/api/admin/audit-logs/route.ts',
    '../app/api/admin/webhooks/route.ts',
  ];

  for (const route of adminRoutes) {
    const routeName = route.split('/').slice(-2).join('/');
    it(`${routeName} uses requireAdmin()`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, route),
        'utf-8',
      );
      expect(source).toContain('requireAdmin()');
    });
  }
});

/* ================================================================== */
/*  14. Risk mitigations                                              */
/* ================================================================== */

describe('5 (risk mitigation): Safety checks', () => {
  it('R1: Account deletion covers ALL user-data tables', () => {
    // Convex migration: cascade coverage now lives in the atomic
    // account.deleteMyAccountCascade mutation (Convex camelCase table names).
    // NOTE: waitlist is not in this list because it is keyed by email, not
    // userId — it is erased in the delete route via deleteWaitlistByEmail, and
    // asserted by the "deletes waitlist entries by email" test above.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../convex/account.ts'),
      'utf-8',
    );
    const tables = [
      'deadlineEvents',
      'outcomes',
      'packets',
      'letters',
      'sequences',
      'documents',
      'caseStatusHistory',
      'subscriptions',
    ];
    for (const table of tables) {
      expect(source).toContain(`query('${table}')`);
    }
    // The parent `cases` row is deleted too.
    expect(source).toContain('ctx.db.delete(caseId)');
  });

  it('R1: Deletion respects FK order (children before parents)', () => {
    // Convex migration: FK-safe ordering is enforced inside the cascade mutation.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../convex/account.ts'),
      'utf-8',
    );
    const childFirst = source.indexOf("query('deadlineEvents')");
    const parentLast = source.indexOf('ctx.db.delete(caseId)');
    expect(childFirst).toBeGreaterThan(-1);
    expect(parentLast).toBeGreaterThan(childFirst);
  });

  it('R2: Sentry does not depend on cookie consent', () => {
    const sentrySource = fs.readFileSync(
      path.resolve(__dirname, '../lib/sentry.ts'),
      'utf-8',
    );
    const consentSource = fs.readFileSync(
      path.resolve(__dirname, '../components/cookie-consent.tsx'),
      'utf-8',
    );
    // Sentry doesn't reference consent
    expect(sentrySource).not.toContain('consent');
    // Consent doesn't reference Sentry
    expect(consentSource).not.toContain('sentry');
    expect(consentSource).not.toContain('Sentry');
  });

  it('R3: Admin refund requires confirmation and logs to audit_log', () => {
    const dashboardSource = fs.readFileSync(
      path.resolve(
        __dirname,
        '../features/admin/components/admin-dashboard.tsx',
      ),
      'utf-8',
    );
    const paymentsSource = fs.readFileSync(
      path.resolve(__dirname, '../app/api/admin/payments/route.ts'),
      'utf-8',
    );
    // Frontend confirmation
    expect(dashboardSource).toContain('confirm(');
    // Backend audit log (Convex migration: from('audit_log') -> api.service.insertAudit)
    expect(paymentsSource).toContain('api.service.insertAudit');
    expect(paymentsSource).toContain('admin_email');
  });
});

/* ================================================================== */
/*  15. Integration — full compliance pipeline                        */
/* ================================================================== */

describe('5 (integration): Full compliance pipeline', () => {
  it('root layout renders both CookieConsent and PlausibleAnalytics', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/layout.tsx'),
      'utf-8',
    );
    expect(source).toContain('<CookieConsent />');
    expect(source).toContain('<PlausibleAnalytics />');
  });

  it('settings page surfaces both export and delete', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/(app)/settings/page.tsx'),
      'utf-8',
    );
    expect(source).toContain('/api/account/export');
    expect(source).toContain('/api/account/delete');
  });

  it('admin dashboard has all 5 tabs', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../features/admin/components/admin-dashboard.tsx',
      ),
      'utf-8',
    );
    expect(source).toContain("'overview'");
    expect(source).toContain("'cases'");
    expect(source).toContain("'audit'");
    expect(source).toContain("'webhooks'");
    expect(source).toContain("'payments'");
  });

  it('compliance-check npm script runs both scanners', () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../package.json'),
        'utf-8',
      ),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['compliance-check']).toContain('scan-phrases');
    expect(pkg.scripts['compliance-check']).toContain('validate-claims');
  });
});
