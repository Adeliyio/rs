/**
 * POST /api/account/subscription/portal
 *
 * Creates a short-lived, AUTHENTICATED Polar customer-portal session for the
 * signed-in user and returns its URL, so a subscriber can manage or cancel
 * their plan in one click.
 *
 * Why this exists: the settings page used to link to Polar's GENERIC portal
 * entry (https://polar.sh/purchases/subscriptions). That page authenticates
 * against Polar's own session, so a customer who checked out without knowingly
 * creating a Polar login — or who used a different email — lands somewhere that
 * shows them nothing, with no route back. Meanwhile the site promises
 * "Subscriptions can be cancelled anytime" in four places. For a product whose
 * entire premise is helping people escape cancellation friction, shipping our
 * own was not defensible.
 *
 * POST, not GET: this creates a session on Polar's side, so it must not be
 * triggered by prefetch, a crawler, or a cached GET.
 *
 * Scoping: the Polar customer id comes from the caller's OWN subscription row
 * (subscriptions.currentMine is already caller-scoped). Nothing from the request
 * body is used to choose a customer, so one user can never mint a portal
 * session for another.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { getPolar, isPolarConfigured } from '@/lib/payments/polar-client';

// Calls Convex + Polar — never cache.
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPolarConfigured()) {
      // eslint-disable-next-line no-console
      console.error('[api] portal requested but POLAR_ACCESS_TOKEN is unset');
      return NextResponse.json(
        {
          error:
            'Subscription management is temporarily unavailable. Please contact support@resolvaio.com and we will cancel it for you.',
        },
        { status: 503 },
      );
    }

    const sub = await q(api.subscriptions.currentMine, {});
    if (!sub) {
      return NextResponse.json(
        { error: 'No subscription found for this account.' },
        { status: 404 },
      );
    }

    const customerId = sub.polar_customer_id;
    if (!customerId) {
      // A subscription row written before we captured the customer id, or one
      // created by a replayed webhook that dropped it. The user must still be
      // able to cancel, so tell them exactly how rather than dead-ending.
      // eslint-disable-next-line no-console
      console.error(
        `[api] subscription ${sub.id} has no polar_customer_id — cannot open portal`,
      );
      return NextResponse.json(
        {
          error:
            'We could not open your billing portal automatically. Email support@resolvaio.com and we will cancel your subscription for you.',
        },
        { status: 409 },
      );
    }

    const session = await getPolar().customerSessions.create({ customerId });

    return NextResponse.json({
      portal_url: session.customerPortalUrl,
      expires_at: session.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api] portal session failed:', message);
    // Never leave a cancelling customer without a route out.
    return NextResponse.json(
      {
        error:
          'We could not open your billing portal. Email support@resolvaio.com and we will cancel your subscription for you.',
      },
      { status: 500 },
    );
  }
}
