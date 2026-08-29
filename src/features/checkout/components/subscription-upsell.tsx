'use client';

/**
 * Subscription upsell — shown after a single-case deposit purchase.
 *
 * Offers monthly ($15/mo) and annual ($129/yr) plans for unlimited cases.
 * Uses Polar redirect checkout for payment processing.
 *
 * PRD §10: subscription SKUs.
 */

import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { Check, Zap } from 'lucide-react';

import { api } from '@convex/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PolarCheckout } from './polar-checkout';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SubscriptionUpsellProps {
  /** Optional email prefill; falls back to the signed-in user's email. */
  userEmail?: string;
  onDismiss: () => void;
}

type SelectedPlan = 'monthly' | 'annual' | null;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function SubscriptionUpsell({
  userEmail,
  onDismiss,
}: SubscriptionUpsellProps) {
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Resolve the signed-in user so the subscription checkout can carry userId in
  // metadata — without it, subscription.active can't link the subscription to
  // its owner and the Unlimited tier grants no entitlement.
  const me = useQuery(api.users.me, {});
  const resolvedUserId = me?.id ?? undefined;
  const resolvedEmail = userEmail || me?.email || undefined;

  const monthlyProductId =
    process.env.NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY ?? '';
  const annualProductId =
    process.env.NEXT_PUBLIC_POLAR_PRODUCT_YEARLY ?? '';

  const handleSelectPlan = useCallback((plan: 'monthly' | 'annual') => {
    setSelectedPlan(plan);
    setShowCheckout(true);
  }, []);

  if (showCheckout && selectedPlan) {
    const productId =
      selectedPlan === 'monthly' ? monthlyProductId : annualProductId;
    const planName =
      selectedPlan === 'monthly'
        ? 'Unlimited Monthly Plan ($15/mo)'
        : 'Unlimited Annual Plan ($129/yr)';

    // Redirect checkout — subscription is created via the subscription.active
    // webhook; the user returns to POLAR_SUCCESS_URL. Not case-specific, so no
    // metadata.caseId.
    return (
      <PolarCheckout
        productId={productId}
        userId={resolvedUserId}
        userEmail={resolvedEmail}
        productName={planName}
      />
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-accent to-white">
      <CardContent className="px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Save on Future Cases
          </h3>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Unlock unlimited deposit demand letters with a subscription plan.
          Use it for any property, in any supported state, as many times as
          you need.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Monthly plan */}
          <button
            type="button"
            onClick={() => handleSelectPlan('monthly')}
            className="rounded-lg border border-primary/20 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
          >
            <div className="text-lg font-bold text-neutral-900">$15/mo</div>
            <div className="mt-0.5 text-sm text-neutral-600">
              Monthly Unlimited
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-neutral-600">
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                Unlimited deposit letters
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                All supported states
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                Cancel anytime
              </li>
            </ul>
          </button>

          {/* Annual plan */}
          <button
            type="button"
            onClick={() => handleSelectPlan('annual')}
            className="relative rounded-lg border-2 border-primary bg-white p-4 text-left transition-colors hover:bg-accent/50"
          >
            <div className="absolute -top-2.5 right-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              Save 28%
            </div>
            <div className="text-lg font-bold text-neutral-900">
              $129/yr
            </div>
            <div className="mt-0.5 text-sm text-neutral-600">
              Annual Unlimited
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-neutral-600">
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                Unlimited deposit letters
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                All supported states
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                Best value — $10.75/mo
              </li>
            </ul>
          </button>
        </div>

        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={onDismiss}
          >
            No thanks, maybe later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
