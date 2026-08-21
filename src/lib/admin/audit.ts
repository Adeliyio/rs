/**
 * Admin audit logger — server-only.
 *
 * Logs all admin operations to the audit_log table via the service-role
 * client. This ensures a tamper-proof record of every admin action.
 * (SEC-14 mitigation)
 */

import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AdminAuditEntry {
  /** The admin user ID (from Supabase auth). */
  userId: string;
  /** Admin email address. */
  email: string;
  /** What the admin did. */
  action: string;
  /** Additional context (e.g. target case ID, transaction ID). */
  details?: Record<string, unknown>;
  /** IP address of the admin. */
  ip?: string;
}

/* ------------------------------------------------------------------ */
/*  Core logging function                                             */
/* ------------------------------------------------------------------ */

/**
 * Writes an admin action to the audit_log table.
 *
 * Best-effort: errors are logged to console but never propagated
 * (an audit failure should not block the admin operation).
 */
export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    const convex = createServiceConvexClient();

    await convex.mutation(api.service.insertAudit, {
      secret: serviceSecret(),
      // entry.userId is the Convex users id in string form.
      userId: entry.userId as Id<'users'>,
      correlationId: `admin-${entry.action}-${Date.now()}`,
      modelVersion: 'admin',
      promptVersion: entry.action,
      citationValidationResult: {
        action: entry.action,
        admin_email: entry.email,
        ip: entry.ip ?? 'unknown',
        ...entry.details,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[ADMIN AUDIT] Exception:',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}
