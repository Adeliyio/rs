/**
 * Service-role client usage audit — SEC-11.
 *
 * Documents every location that uses createServiceRoleClient() and
 * explains why the service-role key (which bypasses RLS) is required.
 *
 * RULE: Only use the service-role client when the operation CANNOT be
 * performed with a user-scoped (anon-key + RLS) client. Every new
 * usage must be documented here with justification.
 *
 * ┌──────────────────────────────────────────────────┬──────────────────────────────────┐
 * │ Location                                         │ Justification                    │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/audit-logs/route.ts                   │ Admin reads cross-user audit_log │
 * │                                                  │ (no user RLS policy on this      │
 * │                                                  │ table by design)                 │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/cases/route.ts                        │ Admin reads all cases across     │
 * │                                                  │ users (RLS would filter to own)  │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/payments/route.ts (GET)               │ Admin reads webhook_events       │
 * │                                                  │ (service-only table)             │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/payments/route.ts (POST)              │ Admin writes audit_log entry     │
 * │                                                  │ for refund action                │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/stats/route.ts                        │ Admin reads aggregate counts     │
 * │                                                  │ across all users/cases           │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/admin/webhooks/route.ts                     │ Admin reads webhook_events       │
 * │                                                  │ (service-only table)             │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/webhooks/paddle/route.ts                    │ Webhook handler has no user      │
 * │                                                  │ session; writes webhook_events   │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/account/delete/route.ts                     │ Needs auth.admin.deleteUser()    │
 * │                                                  │ and cascade delete across tables │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/documents/upload/route.ts                   │ Storage upload requires elevated │
 * │                                                  │ access (bucket RLS policy)       │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/documents/[id]/parse/route.ts               │ Signed URL creation requires     │
 * │                                                  │ service-role for storage access  │
 * ├──────────────────────────────────────────────────┼──────────────────────────────────┤
 * │ /api/trust/stats/route.ts                        │ Public endpoint reads aggregate  │
 * │                                                  │ outcome data (no user session)   │
 * └──────────────────────────────────────────────────┴──────────────────────────────────┘
 *
 * APPROVED: All 11 usages have valid justifications. No reduction
 * possible without changing Supabase storage bucket policies (which
 * would require a migration and testing cycle).
 *
 * FUTURE: If storage bucket policies are updated to allow user-scoped
 * uploads/reads, the upload and parse routes can switch to user client.
 */

export const SERVICE_ROLE_USAGE_COUNT = 11;
export const SERVICE_ROLE_AUDIT_DATE = '2026-05-26';
