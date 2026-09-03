/**
 * GET /api/checkout
 *
 * Polar redirect checkout (replaces the Paddle.js overlay). The `@polar-sh/nextjs`
 * `Checkout()` adapter creates a Polar checkout session from the query params and
 * 302-redirects the browser to Polar's hosted checkout.
 *
 * SECURITY: this route is now AUTHENTICATED and the requested product is checked
 * against a server-side allowlist. Previously it was unauthenticated and trusted
 * whatever `products` / `metadata` the query string supplied — a user could pay
 * toward an arbitrary caseId or craft product ids. We require a signed-in user
 * and only allow the known Polar product ids.
 *
 * Caller passes:
 *   ?products=<polar_product_id>          (must be one of the allowlisted ids)
 *   &customerEmail=<email>                (optional — prefill)
 *   &metadata=<url-encoded JSON {caseId,userId}> (echoed back on the webhook)
 *
 * Fulfillment is webhook-driven (order.paid / subscription.active). The webhook
 * additionally verifies the amount and the payer↔case owner before granting.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Checkout } from '@polar-sh/nextjs';

import { q, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';

export const dynamic = 'force-dynamic';

const polarCheckout = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? '',
  successUrl: process.env.POLAR_SUCCESS_URL || undefined,
  server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
});

/** The only Polar product ids a checkout may target. */
function allowedProductIds(): Set<string> {
  return new Set(
    [
      process.env.POLAR_PRODUCT_LETTER,
      process.env.POLAR_PRODUCT_MONTHLY,
      process.env.POLAR_PRODUCT_YEARLY,
      process.env.NEXT_PUBLIC_POLAR_PRODUCT_LETTER,
      process.env.NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY,
      process.env.NEXT_PUBLIC_POLAR_PRODUCT_YEARLY,
    ].filter((v): v is string => typeof v === 'string' && v.length > 0),
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  // 1. Require an authenticated user.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // 2. Validate the requested product against the allowlist.
  const url = new URL(request.url);
  const products = url.searchParams.getAll('products');
  const allowed = allowedProductIds();
  if (products.length === 0 || !products.every((p) => allowed.has(p))) {
    return NextResponse.json({ error: 'Invalid product.' }, { status: 400 });
  }

  // 2.5 Server-side double-charge guard for the ONE-TIME deposit path. The client
  //     poll can always time out, so the buy button can re-appear for a case
  //     whose order.paid webhook is merely slow — a second click would charge
  //     again. If this checkout targets a caseId that is already paid, refuse.
  const rawMeta = url.searchParams.get('metadata');
  if (rawMeta) {
    try {
      const meta = JSON.parse(rawMeta) as { caseId?: string };
      if (meta.caseId) {
        const caseRow = await q(api.cases.getMine, { caseId: meta.caseId as Id<'cases'> });
        if (caseRow && caseRow.payment_status === 'paid') {
          return NextResponse.json(
            { error: 'This case is already paid. No further payment is needed.' },
            { status: 409 },
          );
        }
      }
    } catch {
      // Malformed metadata — let the Polar adapter reject it downstream.
    }
  }

  // 3. Delegate to the Polar adapter (it reads the same query params).
  return polarCheckout(request);
}
