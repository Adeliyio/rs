'use client';

/**
 * Client wrapper for the intake status.
 *
 * Renders DiagnosticShell and handles the onComplete callback:
 * - For subscription: calls generate directly (free wedge) → reload
 * - For deposit: payment already happened in the diagnostic flow
 *   (preview → payment nodes). Here we poll for payment_status=paid
 *   (webhook may take a moment), then call generate → reload.
 */

import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

import DiagnosticShell from '@/features/diagnostic/components/diagnostic-shell';
import type { Wedge } from '@/types/enums';

interface IntakeClientProps {
  caseId: string;
  wedge: Wedge;
}

const PAYMENT_POLL_INTERVAL = 2000; // 2 seconds
const PAYMENT_POLL_MAX_ATTEMPTS = 30; // 60 seconds max

export default function IntakeClient({
  caseId,
  wedge,
}: IntakeClientProps): React.JSX.Element {
  const router = useRouter();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [advanceMessage, setAdvanceMessage] = useState<string>('');
  const pollingRef = useRef(false);

  const pollForPayment = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < PAYMENT_POLL_MAX_ATTEMPTS; i++) {
      const res = await fetch(`/api/cases/${caseId}/payment-status`);
      if (res.ok) {
        const data = (await res.json()) as { payment_status?: string };
        if (data.payment_status === 'paid') return true;
      }
      await new Promise((r) => setTimeout(r, PAYMENT_POLL_INTERVAL));
    }
    return false;
  }, [caseId]);

  const handleComplete = useCallback(async () => {
    if (isAdvancing || pollingRef.current) return;
    setIsAdvancing(true);
    pollingRef.current = true;
    setAdvanceError(null);

    try {
      if (wedge === 'subscription') {
        // Subscription is free — trigger generation directly
        setAdvanceMessage('Generating your cancellation emails...');
        const genResponse = await fetch(`/api/cases/${caseId}/generate`, {
          method: 'POST',
        });

        if (!genResponse.ok) {
          const data = (await genResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? 'Generation failed');
        }
      } else {
        // Deposit — payment happened in the diagnostic flow.
        // Poll for the Paddle webhook to confirm payment_status=paid,
        // then trigger generation.
        setAdvanceMessage('Confirming payment...');
        const paid = await pollForPayment();

        if (!paid) {
          throw new Error(
            'Payment confirmation is taking longer than expected. ' +
            'Please refresh the page — if your payment completed, your letter will be generated automatically.',
          );
        }

        setAdvanceMessage('Generating your demand letter...');
        const genResponse = await fetch(`/api/cases/${caseId}/generate`, {
          method: 'POST',
        });

        if (!genResponse.ok) {
          const data = (await genResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? 'Generation failed');
        }
      }

      // Reload so the server component picks up the new status
      router.refresh();
    } catch (err) {
      setAdvanceError(
        err instanceof Error ? err.message : 'Something went wrong',
      );
      setIsAdvancing(false);
      pollingRef.current = false;
    }
  }, [caseId, wedge, router, isAdvancing, pollForPayment]);

  return (
    <>
      <DiagnosticShell
        caseId={caseId}
        wedge={wedge}
        onComplete={handleComplete}
      />
      {isAdvancing && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {advanceMessage}
        </div>
      )}
      {advanceError && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{advanceError}</p>
        </div>
      )}
    </>
  );
}
