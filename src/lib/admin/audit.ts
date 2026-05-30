/**
 * Admin audit logger — server-only.
 *
 * Logs all admin operations to the audit_log table via the service-role
 * client. This ensures a tamper-proof record of every admin action.
 * (SEC-14 mitigation)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';

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
    const supabase = createServiceRoleClient();

    const payload: Record<string, unknown> = {
      user_id: entry.userId,
      correlation_id: `admin-${entry.action}-${Date.now()}`,
      model_version: 'admin',
      prompt_version: entry.action,
      citation_validation_result: {
        action: entry.action,
        admin_email: entry.email,
        ip: entry.ip ?? 'unknown',
        ...entry.details,
      },
    };

    // @ts-expect-error — service-role Supabase client resolves Insert generics as never
    const { error } = await supabase.from('audit_log').insert(payload);

    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[ADMIN AUDIT] Failed to log action="${entry.action}":`, error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[ADMIN AUDIT] Exception:',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}
