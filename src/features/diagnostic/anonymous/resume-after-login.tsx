'use client';

/**
 * Resumes an anonymous deposit diagnostic after the visitor signed in.
 *
 * Runs the SAME two steps the email-capture step runs after OTP verification —
 * create the case, hydrate the collected answers — so a returning user reaches
 * /case/[id] positioned at the boundary node with their answers intact, instead
 * of being dropped into a fresh funnel to re-answer the whole form.
 *
 * If there is no stash (direct navigation, expired, storage blocked, already
 * consumed) this is not an error state: it just sends the visitor onward to
 * /new rather than showing a failure for something they did not do wrong.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DiagnosticState } from '@/types/diagnostic.types';

import { buildHydratedState } from './anonymous-answers';
import {
  consumePendingDiagnostic,
  savePendingDiagnostic,
  type PendingDiagnostic,
} from './pending-answers';

export function ResumeAfterLogin(): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in dev; the stash is consumed
  // (read + cleared) on the first run, so guard against a second pass turning
  // into a spurious "nothing to resume" redirect.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const pending: PendingDiagnostic | null = consumePendingDiagnostic();
    if (!pending) {
      router.replace('/new?wedge=deposit');
      return;
    }

    void (async (): Promise<void> => {
      // 1. Create the real case.
      const caseRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wedge: pending.wedge,
          jurisdiction: pending.jurisdiction,
        }),
      });

      // Not signed in (the session cookie never arrived, or expired between the
      // login POST and this page). Send them back to sign in WITHOUT consuming
      // their answers — re-stash so a second attempt can still resume.
      if (caseRes.status === 401 || caseRes.status === 403) {
        savePendingDiagnostic({
          wedge: pending.wedge,
          jurisdiction: pending.jurisdiction,
          graphVersion: pending.graphVersion,
          boundaryNodeId: pending.boundaryNodeId,
          answers: pending.answers,
          completedNodes: pending.completedNodes,
        });
        router.replace('/login?next=/start/resume');
        return;
      }

      let caseId: string | null = null;
      if (caseRes.ok) {
        const data = (await caseRes.json()) as { id: string };
        caseId = data.id;
      } else {
        const data = (await caseRes.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          existing_case_id?: string;
        };
        // A duplicate active case is fine — resume it.
        if (data.code === 'DUPLICATE_ACTIVE_CASE' && data.existing_case_id) {
          caseId = data.existing_case_id;
        } else {
          setError(data.error ?? 'We could not open your case. Please try again.');
          return;
        }
      }

      // 2. Hydrate the answers collected before sign-in.
      const state: DiagnosticState = buildHydratedState({
        caseId,
        graphVersion: pending.graphVersion,
        boundaryNodeId: pending.boundaryNodeId,
        answers: pending.answers,
        completedNodes: pending.completedNodes,
      });

      let hydrated = false;
      for (let attempt = 0; attempt < 2 && !hydrated; attempt++) {
        try {
          const res = await fetch('/api/diagnostic/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caseId, state }),
          });
          hydrated = res.ok;
        } catch {
          hydrated = false;
        }
      }
      if (!hydrated) {
        // eslint-disable-next-line no-console
        console.error(
          `[start/resume] hydrate failed for case ${caseId} — the visitor may ` +
            `need to re-confirm answers on resume.`,
        );
      }

      router.replace(`/case/${caseId}`);
    })();
  }, [router]);

  if (error) {
    return (
      <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push('/new?wedge=deposit')}>
          Go to my cases
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Setting up your case and carrying over your answers…
      </p>
    </div>
  );
}
