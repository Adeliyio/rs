'use client';

/**
 * Paddle inline checkout component.
 *
 * Loads Paddle.js, initializes with the client token, and opens
 * an inline checkout for the selected price. On success, links
 * the transaction to the case via the API.
 *
 * Uses Paddle's overlay checkout (not inline embed) for simplicity.
 */

import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PaddleCheckoutProps {
  caseId: string;
  priceId: string;
  userEmail: string;
  productName: string;
  onSuccess: (transactionId: string) => void;
  onCancel?: () => void;
}

interface PaddleEvent {
  name: string;
  data?: {
    transaction_id?: string;
    id?: string;
    status?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Paddle.js loader                                                  */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: {
        token: string;
        environment?: string;
      }) => void;
      Checkout: {
        open: (opts: {
          items: { priceId: string; quantity: number }[];
          customer?: { email: string };
          customData?: Record<string, string>;
          settings?: {
            displayMode?: string;
            theme?: string;
            successUrl?: string;
          };
        }) => void;
      };
      Environment: {
        set: (env: string) => void;
      };
    };
  }
}

let paddleLoaded = false;

function loadPaddleScript(): Promise<void> {
  if (paddleLoaded && window.Paddle) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="paddle.js"]')) {
      paddleLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      paddleLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Paddle.js'));
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PaddleCheckout({
  caseId,
  priceId,
  userEmail,
  productName,
  onSuccess,
  onCancel,
}: PaddleCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize Paddle on mount
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const env = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? 'sandbox';

    if (!token) {
      setError('Payment system not configured.');
      return;
    }

    loadPaddleScript()
      .then(() => {
        if (window.Paddle) {
          window.Paddle.Initialize({
            token,
            environment: env,
          });
          setInitialized(true);
        }
      })
      .catch(() => {
        setError('Unable to load payment system. Please try again.');
      });
  }, []);

  // Listen for Paddle events
  useEffect(() => {
    if (!initialized) return;

    function handlePaddleEvent(event: PaddleEvent) {
      if (event.name === 'checkout.completed') {
        const transactionId =
          event.data?.transaction_id ?? event.data?.id ?? '';
        if (transactionId) {
          void linkTransaction(transactionId);
        }
      }
      if (event.name === 'checkout.closed') {
        onCancel?.();
      }
    }

    // Paddle.js fires events on the window via eventCallback
    // We capture them during checkout.open
    (window as unknown as Record<string, unknown>)['_paddleEventHandler'] =
      handlePaddleEvent;

    return () => {
      delete (window as unknown as Record<string, unknown>)['_paddleEventHandler'];
    };
  }, [initialized, onCancel, onSuccess, caseId]);

  const linkTransaction = useCallback(
    async (transactionId: string) => {
      try {
        const response = await fetch(`/api/cases/${caseId}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction_id: transactionId }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? 'Failed to confirm payment.');
          return;
        }

        onSuccess(transactionId);
      } catch {
        setError('Failed to confirm payment. Please contact support.');
      }
    },
    [caseId, onSuccess],
  );

  const handleCheckout = useCallback(() => {
    if (!window.Paddle || !initialized) {
      setError('Payment system not ready. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: userEmail },
        customData: { case_id: caseId },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          successUrl: `${window.location.origin}/case/${caseId}?payment=success`,
        },
      });
    } catch {
      setError('Unable to open checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [priceId, userEmail, caseId, initialized]);

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
          disabled={isLoading || !initialized}
          className="w-full"
        >
          {isLoading ? 'Opening checkout...' : 'Proceed to Payment'}
        </Button>
      </div>
    </div>
  );
}
