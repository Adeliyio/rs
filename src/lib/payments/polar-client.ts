import { Polar } from '@polar-sh/sdk';

/**
 * Single Polar client module (replaces the hand-rolled Paddle client).
 *
 * Polar is the payment processor after Paddle rejected Resolvaio. All server-side
 * Polar API calls (refunds, subscription reads) go through this one client. The
 * checkout-session creation and webhook signature verification are handled by the
 * `@polar-sh/nextjs` adapter in the respective route handlers, not here.
 *
 * `server` selects the fully-isolated sandbox vs production environment purely
 * from POLAR_SERVER — sandbox has its own account, org, products, and token, so
 * there is no `test_`/`live_` key prefix to branch on.
 */

let _polar: Polar | null = null;

/** Whether Polar is configured (an access token is present). */
export function isPolarConfigured(): boolean {
  return Boolean(process.env.POLAR_ACCESS_TOKEN);
}

/** Lazily-initialized Polar SDK client. Throws if the access token is missing. */
export function getPolar(): Polar {
  if (_polar) return _polar;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'POLAR_ACCESS_TOKEN is not set — Polar payment operations are disabled.',
    );
  }

  _polar = new Polar({
    accessToken,
    server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
  });
  return _polar;
}

/**
 * Product IDs for the three Polar products (one product per billing interval —
 * Polar locks the billing model at product creation, so monthly and yearly are
 * separate products). Read from env; the checkout route references these by id.
 */
export const POLAR_PRODUCTS = {
  /** One-time $49 security-deposit demand letter. */
  depositLetter: (): string => requireProduct('POLAR_PRODUCT_LETTER'),
  /** Recurring monthly Unlimited plan. */
  monthlyUnlimited: (): string => requireProduct('POLAR_PRODUCT_MONTHLY'),
  /** Recurring yearly Unlimited plan. */
  yearlyUnlimited: (): string => requireProduct('POLAR_PRODUCT_YEARLY'),
} as const;

function requireProduct(envVar: string): string {
  const id = process.env[envVar];
  if (!id) {
    throw new Error(`${envVar} is not set — cannot start a Polar checkout.`);
  }
  return id;
}
