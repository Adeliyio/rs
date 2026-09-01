'use client';

/**
 * Polar redirect checkout component (replaces the Paddle.js overlay).
 *
 * Polar has no Paddle-style in-page overlay — checkout is a full redirect to
 * Polar's hosted page. This component renders a button that navigates to the
 * server `/api/checkout` route, which creates the Polar session and 302s to
 * Polar. Fulfillment is webhook-driven (order.paid → case marked paid); the user
 * returns to POLAR_SUCCESS_URL afterwards, so there is no client-side success
 * callback to link a transaction (that role moved to the webhook + metadata).
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PolarCheckoutProps {
  /** Polar product id to purchase (from NEXT_PUBLIC_POLAR_PRODUCT_*). */
  productId: string;
  /** Product/plan name shown above the button. */
  productName: string;
  /** Optional case id — echoed to the webhook via checkout metadata as {caseId}. */
  caseId?: string;
  /**
   * Optional user id — echoed via checkout metadata as {userId}. REQUIRED for
   * subscription checkouts so subscription.active can link the subscription to
   * its owner (without it, the Unlimited tier grants no entitlement).
   */
  userId?: string;
  /** Optional email prefill for the Polar checkout. */
  userEmail?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Builds the `/api/checkout` URL with products + metadata + optional email. */
export function buildCheckoutUrl({
  productId,
  caseId,
  userId,
  userEmail,
}: {
  productId: string;
  caseId?: string;
  userId?: string;
  userEmail?: string;
}): string {
  const params = new URLSearchParams();
  params.set('products', productId);
  // Polar echoes this metadata back on the webhook (order.metadata /
  // subscription.metadata). userId is what links a subscription to its owner.
  const metadata: Record<string, string> = {};
  if (caseId) metadata.caseId = caseId;
  if (userId) metadata.userId = userId;
  if (Object.keys(metadata).length > 0) {
    params.set('metadata', JSON.stringify(metadata));
  }
  if (userEmail) {
    params.set('customerEmail', userEmail);
  }
  return `/api/checkout?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PolarCheckout({
  productId,
  productName,
  caseId,
  userId,
  userEmail,
}: PolarCheckoutProps): React.JSX.Element {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = useCallback(() => {
    if (!productId) {
      setError('Payment system not configured.');
      return;
    }
    setIsRedirecting(true);
    setError(null);
    window.location.href = buildCheckoutUrl({ productId, caseId, userId, userEmail });
  }, [productId, caseId, userId, userEmail]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold text-neutral-900">
          {productName}
        </h3>

        <div className="mb-4 text-sm text-neutral-600">
          <p>
            This tool generates writing assistance and general information, not
            legal advice. Review all content carefully before sending.
            Individual results vary.{' '}
            <a href="/legal/terms#refund" className="underline underline-offset-2">See our refund policy</a>.
          </p>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={isRedirecting || !productId}
          className="w-full"
        >
          {isRedirecting ? 'Redirecting to checkout…' : 'Proceed to Payment'}
        </Button>
      </div>
    </div>
  );
}
