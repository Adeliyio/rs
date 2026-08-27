/**
 * GET /api/checkout
 *
 * Polar redirect checkout (replaces the Paddle.js overlay). The `@polar-sh/nextjs`
 * `Checkout()` adapter creates a Polar checkout session from the query params and
 * 302-redirects the browser to Polar's hosted checkout.
 *
 * Caller passes:
 *   ?products=<polar_product_id>         (required — the product to buy)
 *   &customerEmail=<email>               (optional — prefill)
 *   &metadata=<url-encoded JSON {caseId}> (optional — echoed back on the webhook)
 *
 * Fulfillment happens webhook-driven (order.paid → case marked paid); this route
 * only starts the session. successUrl / sandbox-vs-production come from env.
 */

import { Checkout } from '@polar-sh/nextjs';

export const dynamic = 'force-dynamic';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? '',
  successUrl: process.env.POLAR_SUCCESS_URL || undefined,
  server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
});
