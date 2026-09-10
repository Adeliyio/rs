/**
 * Short-lived stash for anonymously-collected diagnostic answers that must
 * survive a FULL PAGE NAVIGATION to /login and back.
 *
 * Why this exists: the anonymous funnel holds answers in React memory only
 * (anonymous-flow.tsx), which is correct while the visitor stays on /start. But
 * a visitor who already has an account is sent to /login, and that navigation
 * destroys the component tree — every answer with it. They then return to a
 * fresh funnel and are asked to fill the entire form a second time, despite the
 * capture step promising their answers were saved.
 *
 * sessionStorage (not localStorage) is deliberate: this is per-tab and dies with
 * the tab, so an abandoned funnel cannot leak a stranger's tenancy details into
 * a later session on a shared machine. The stash is also TTL-bounded and is
 * cleared the moment it is consumed.
 *
 * CLAUDE.md §2.5 note: the rule is that anonymous answers are not PERSISTED to
 * the backend before an account exists. This keeps that property — nothing
 * leaves the browser here; it is a hand-off buffer across one navigation.
 */

import type { Wedge } from '@/types/enums';

const STORAGE_KEY = 'resolvaio:pending-diagnostic';

/** Answers older than this are discarded rather than resumed. */
const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PendingDiagnostic {
  wedge: Wedge;
  jurisdiction: string;
  graphVersion: string;
  boundaryNodeId: string;
  answers: Record<string, unknown>;
  completedNodes: string[];
  /** Epoch ms when the stash was written. */
  savedAt: number;
}

/** Shape guard — a stash written by an older build must not crash the resume. */
function isPending(value: unknown): value is PendingDiagnostic {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.wedge === 'string' &&
    typeof v.jurisdiction === 'string' &&
    typeof v.graphVersion === 'string' &&
    typeof v.boundaryNodeId === 'string' &&
    typeof v.savedAt === 'number' &&
    typeof v.answers === 'object' &&
    v.answers !== null &&
    Array.isArray(v.completedNodes)
  );
}

/**
 * Stash the collected answers before navigating away. Returns false if storage
 * is unavailable (private mode, quota, disabled) so the caller can decide not to
 * promise a resume it cannot deliver.
 */
export function savePendingDiagnostic(
  input: Omit<PendingDiagnostic, 'savedAt'>,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload: PendingDiagnostic = { ...input, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the stash without consuming it. Returns null when absent, malformed, or
 * expired (an expired stash is cleared as a side effect).
 */
export function readPendingDiagnostic(): PendingDiagnostic | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingDiagnostic();
    return null;
  }

  if (!isPending(parsed)) {
    clearPendingDiagnostic();
    return null;
  }
  if (Date.now() - parsed.savedAt > TTL_MS) {
    clearPendingDiagnostic();
    return null;
  }
  return parsed;
}

/** Drop the stash. Safe to call when nothing is stored. */
export function clearPendingDiagnostic(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Read and remove in one step, so a resume can never be replayed twice. */
export function consumePendingDiagnostic(): PendingDiagnostic | null {
  const pending = readPendingDiagnostic();
  if (pending) clearPendingDiagnostic();
  return pending;
}
