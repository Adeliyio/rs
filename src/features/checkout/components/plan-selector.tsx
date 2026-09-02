'use client';

/**
 * Plan selector — the single "how would you like to proceed?" decision on the
 * deposit paywall. Presents THREE peer options side by side so the user compares
 * and picks, instead of a one-time $49 box with the subscription bolted on below:
 *
 *   • Single letter — one-time (this case only)      → one-time Polar checkout
 *   • Monthly Unlimited — $15/mo (all cases)          → subscription checkout
 *   • Annual Unlimited — $129/yr (all cases, Save 28%) → subscription checkout
 *
 * All three redirect to Polar via the shared buildCheckoutUrl. Subscriptions
 * carry userId in metadata so subscription.active links to the owner; once
 * active, the deposit generate route waives the per-case fee (M1). The one-time
 * option carries caseId so order.paid marks that case paid.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { Check, Loader2 } from 'lucide-react';

import { api } from '@convex/api';
import { cn } from '@/lib/utils';
import { buildCheckoutUrl } from './polar-checkout';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PlanSelectorProps {
  /** Case being paid for — echoed to the one-time order webhook as {caseId}. */
  caseId: string;
  /** One-time product id + label (from the A/B price variant). */
  oneTimeProductId: string;
  oneTimeLabel: string;
  /** Optional email prefill; falls back to the signed-in user's email. */
  userEmail?: string;
}

type PlanKey = 'single' | 'monthly' | 'annual';

interface PlanCard {
  key: PlanKey;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  badge?: string;
  featured?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PlanSelector({
  caseId,
  oneTimeProductId,
  oneTimeLabel,
  userEmail,
}: PlanSelectorProps): React.JSX.Element {
  const [redirecting, setRedirecting] = useState<PlanKey | null>(null);

  // Resolve the signed-in user so subscription checkouts carry userId in
  // metadata — without it subscription.active can't link the plan to its owner
  // and the Unlimited entitlement grants nothing.
  const me = useQuery(api.users.me, {});
  const resolvedUserId = me?.id ?? undefined;
  const resolvedEmail = userEmail || me?.email || undefined;

  // Reactively track entitlement so we NEVER show buy cards to someone who is
  // already covered — this closes the double-charge race: a subscriber returning
  // from checkout before the webhook lands used to see the cards again and could
  // buy twice. currentMine is a reactive query, so it flips to covered the moment
  // subscription.active writes the row. We also poll the case's payment status
  // for the one-time path (order.paid webhook).
  const activeSub = useQuery(api.subscriptions.currentMine, {});
  const [casePaid, setCasePaid] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/payment-status`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { payment_status?: string };
          if (data.payment_status === 'paid') { setCasePaid(true); return; }
        }
      } catch { /* non-fatal */ }
      // Short-poll for a window (covers return-from-checkout before the webhook).
      if (!cancelled && tries++ < 15) setTimeout(() => void check(), 2000);
    };
    void check();
    return () => { cancelled = true; };
  }, [caseId]);

  const alreadyCovered = casePaid || Boolean(activeSub);

  const monthlyProductId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY ?? '';
  const annualProductId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_YEARLY ?? '';

  const choose = useCallback(
    (plan: PlanKey) => {
      setRedirecting(plan);
      let url: string;
      if (plan === 'single') {
        // One-time: tie to THIS case so order.paid marks it paid.
        url = buildCheckoutUrl({
          productId: oneTimeProductId,
          caseId,
          userId: resolvedUserId,
          userEmail: resolvedEmail,
        });
      } else {
        // Subscription: not case-specific; userId links the entitlement.
        url = buildCheckoutUrl({
          productId: plan === 'monthly' ? monthlyProductId : annualProductId,
          userId: resolvedUserId,
          userEmail: resolvedEmail,
        });
      }
      window.location.href = url;
    },
    [caseId, oneTimeProductId, monthlyProductId, annualProductId, resolvedUserId, resolvedEmail],
  );

  const cards: PlanCard[] = [
    {
      key: 'single',
      name: 'Single Letter',
      price: oneTimeLabel,
      cadence: 'one-time',
      blurb: 'Just this case.',
      features: ['This demand letter', 'All statutes + escalation steps', 'PDF ready to send'],
      cta: 'Get this letter',
    },
    {
      key: 'monthly',
      name: 'Monthly Unlimited',
      price: '$15',
      cadence: 'per month',
      blurb: 'Every case, any state.',
      features: ['Unlimited deposit letters', 'All supported states', 'Cancel anytime'],
      cta: 'Go Monthly',
    },
    {
      key: 'annual',
      name: 'Annual Unlimited',
      price: '$129',
      cadence: 'per year',
      blurb: 'Best value — $10.75/mo.',
      features: ['Unlimited deposit letters', 'All supported states', 'Two months free'],
      cta: 'Go Annual',
      badge: 'Save 28%',
      featured: true,
    },
  ];

  // Already paid / entitled → never show buy cards again (prevents double-charge
  // on return-from-checkout and during the subscription.active webhook race). The
  // IntakeClient mount effect kicks off generation; this just reassures the user.
  if (alreadyCovered) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">
          Payment confirmed — preparing your letter…
        </p>
        <p className="text-xs text-muted-foreground">
          This page will update automatically. No need to pay again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="font-display text-[22px] font-semibold text-foreground">
          Choose how you&apos;d like to proceed
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay once for this letter, or get unlimited access for every case.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-card p-5 shadow-premium',
              card.featured ? 'border-primary ring-1 ring-primary/20' : 'border-border',
            )}
          >
            {card.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {card.badge}
              </span>
            )}

            <div className="text-[13px] font-medium text-muted-foreground">{card.name}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-[28px] font-semibold text-foreground">
                {card.price}
              </span>
              <span className="text-[12px] text-muted-foreground">/ {card.cadence}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{card.blurb}</p>

            <ul className="mt-4 flex-1 space-y-1.5">
              {card.features.map((feat) => (
                <li key={feat} className="flex items-start gap-1.5 text-[12px] text-foreground/80">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  {feat}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => choose(card.key)}
              disabled={redirecting !== null}
              className={cn(
                'mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-colors',
                card.featured
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-input bg-background text-foreground hover:bg-accent',
                redirecting !== null && 'pointer-events-none opacity-60',
              )}
            >
              {redirecting === card.key ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                card.cta
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        This tool provides writing assistance and general information, not legal
        advice. Individual results vary.{' '}
        <a href="/legal/terms#refund" className="underline underline-offset-2">
          See our refund policy
        </a>
        .
      </p>
    </div>
  );
}
