'use client';

/**
 * Payment node — renders DisclaimerAcknowledgment then PaddleCheckout.
 *
 * Two-step flow:
 * 1. User acknowledges the disclaimer (checkbox + "Generate" button)
 * 2. Paddle overlay checkout opens
 * 3. On success: advances the diagnostic to the next node
 *
 * The checkout route links the Paddle transaction to the case.
 * payment_status transitions to 'paid' asynchronously via webhook.
 */

import { useState, useCallback } from 'react';

import { DisclaimerAcknowledgment } from '@/components/disclaimer-acknowledgment';
import { PaddleCheckout } from '@/features/checkout/components/paddle-checkout';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import type { DiagnosticNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PaymentNodeProps {
  node: DiagnosticNode;
  onAnswer: (value: unknown) => void;
  caseId: string;
}

type Step = 'disclaimer' | 'checkout' | 'processing';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function PaymentNodeComponent({
  node: _node,
  onAnswer,
  caseId,
}: PaymentNodeProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('disclaimer');

  const handleDisclaimerAcknowledge = useCallback(() => {
    setStep('checkout');
  }, []);

  const handlePaymentSuccess = useCallback(
    (transactionId: string) => {
      setStep('processing');
      // Advance the diagnostic — the intake-client will handle
      // waiting for payment_status=paid before triggering generation
      onAnswer({ payment_complete: true, transaction_id: transactionId });
    },
    [onAnswer],
  );

  const handlePaymentCancel = useCallback(() => {
    // Stay on checkout step — user can retry
  }, []);

  if (step === 'disclaimer') {
    return (
      <DisclaimerAcknowledgment
        wedge="deposit"
        onAcknowledge={handleDisclaimerAcknowledge}
      />
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-foreground">
          Payment received — preparing your letter...
        </p>
        <p className="text-sm text-muted-foreground">
          This may take a moment.
        </p>
      </div>
    );
  }

  // step === 'checkout'
  const priceVariant = assignPriceVariant(caseId);

  return (
    <PaddleCheckout
      caseId={caseId}
      priceId={priceVariant.priceId}
      userEmail="" // Paddle will use the authenticated user's email
      productName={`Security Deposit Demand Letter (${priceVariant.label})`}
      onSuccess={handlePaymentSuccess}
      onCancel={handlePaymentCancel}
    />
  );
}
