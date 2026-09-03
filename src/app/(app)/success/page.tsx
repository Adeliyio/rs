'use client';

/**
 * /success — post-checkout landing (Polar redirect target, POLAR_SUCCESS_URL).
 *
 * IDEMPOTENT and read-only: this page NEVER grants entitlement or marks anything
 * paid. Fulfillment is webhook-driven (order.paid → case paid; subscription.active
 * → Unlimited). This page only thanks the user and points them back to their
 * case / dashboard, where the intake-client polls payment_status until the
 * webhook lands. Refreshing it or hitting it twice does nothing.
 *
 * Polar appends ?checkout_id=... to the success URL; we read it only for display
 * and never trust it as proof of payment.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

import { api } from '@convex/api';
import { Button } from '@/components/ui/button';

function SuccessInner(): React.JSX.Element {
  const params = useSearchParams();
  const checkoutId = params.get('checkout_id') ?? params.get('checkoutId');
  // If the success URL carried the case id, deep-link straight to that case.
  const paramCaseId = params.get('caseId') ?? params.get('case_id');

  // Polar's success URL does NOT reliably carry the caseId (it lives in checkout
  // metadata, not the redirect query), so a param-only link would dump the buyer
  // on /new to hunt for their case. Reactively resolve their most recent case as
  // a fallback so the CTA always deep-links to the right place. (Fulfillment is
  // server-driven off the order.paid webhook regardless — this is just routing.)
  const cases = useQuery(api.cases.listMine, paramCaseId ? 'skip' : {});
  const resolvedCaseId =
    paramCaseId ?? (Array.isArray(cases) && cases.length > 0 ? cases[0]!.id : null);
  const continueHref = resolvedCaseId ? `/case/${resolvedCaseId}` : '/new';
  const caseId = resolvedCaseId;

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>

      <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-foreground">
        Payment received — thank you
      </h1>

      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        We&apos;re confirming your payment now. This can take a few moments. Once
        it clears, your document is prepared automatically — you don&apos;t need
        to do anything on this page.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild className="gap-2">
          <Link href={continueHref}>
            {caseId ? 'Continue to my case' : 'Go to my cases'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {checkoutId && (
        <p className="mt-8 text-[12px] text-muted-foreground/60">
          Reference: {checkoutId}
        </p>
      )}
    </div>
  );
}

export default function SuccessPage(): React.JSX.Element {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
