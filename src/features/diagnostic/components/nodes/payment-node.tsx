'use client';

/**
 * Payment node — renders DisclaimerAcknowledgment then PolarCheckout.
 *
 * Flow:
 * 1. User acknowledges the disclaimer (checkbox + "Generate" button)
 * 2. PolarCheckout redirects the browser to Polar's hosted checkout
 * 3. Polar redirects back to POLAR_SUCCESS_URL after payment; payment_status
 *    transitions to 'paid' asynchronously via the order.paid webhook, which the
 *    intake-client polls for before generating.
 *
 * There is no in-page success callback under the redirect flow — the case is
 * linked to the order via checkout metadata ({caseId}) on the webhook.
 */

import { useState, useCallback, useEffect } from 'react';

import { DisclaimerAcknowledgment } from '@/components/disclaimer-acknowledgment';
import { PolarCheckout } from '@/features/checkout/components/polar-checkout';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import type { DiagnosticNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PaymentNodeProps {
  node: DiagnosticNode;
  onAnswer: (value: unknown) => void;
  caseId: string;
  /**
   * Active "Unlimited" subscriber — the per-case payment is waived, so this node
   * auto-advances without showing the disclaimer/checkout.
   */
  hasActiveSubscription?: boolean;
}

type Step = 'disclaimer' | 'checkout' | 'processing';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function PaymentNodeComponent({
  node: _node,
  onAnswer,
  caseId,
  hasActiveSubscription = false,
}: PaymentNodeProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('disclaimer');

  // Active subscribers owe nothing per case — advance straight past payment.
  // The generate route independently verifies the active subscription, so no
  // transaction id is needed (and none should be fabricated).
  useEffect(() => {
    if (hasActiveSubscription) {
      onAnswer({ payment_complete: true, subscription_covered: true });
    }
  }, [hasActiveSubscription, onAnswer]);

  const handleDisclaimerAcknowledge = useCallback(() => {
    setStep('checkout');
  }, []);

  // Active subscriber: render a brief covered-by-plan state while the effect
  // above advances the diagnostic. Never show the checkout to them.
  if (hasActiveSubscription) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-foreground">
          Covered by your Unlimited plan — preparing your letter...
        </p>
      </div>
    );
  }

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
    <PolarCheckout
      productId={priceVariant.productId}
      caseId={caseId}
      productName={`Security Deposit Demand Letter (${priceVariant.label})`}
    />
  );
}
