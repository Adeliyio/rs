/* ------------------------------------------------------------------ */
/*  Polar external API types — Zod at the boundary (CLAUDE.md §2.1)    */
/* ------------------------------------------------------------------ */

/**
 * The `@polar-sh/nextjs` `Webhooks()` adapter verifies the Standard Webhooks
 * HMAC signature and hands each handler a typed, camelCase SDK object. We do NOT
 * trust those objects blind — we Zod-parse the exact fields we read out of each
 * payload's `data` (the Polar `Order` / `Subscription`) before acting on them.
 *
 * These schemas are intentionally partial: they validate only the fields the
 * webhook processor consumes, and are permissive about everything else the SDK
 * carries. `.passthrough()` keeps unknown keys without failing the parse.
 */

import { z } from 'zod';

/* ---------- snake_case tolerance ---------- */

/**
 * Polar's WIRE format is snake_case (`total_amount`, `current_period_end`);
 * the SDK's `validateEvent` remaps it to camelCase before handing it to a
 * handler. Both shapes reach these schemas:
 *
 *  - live dispatch  -> camelCase (SDK-parsed)
 *  - replayed event -> whatever was stored. Events stored before the route was
 *    fixed hold the RAW snake_case body.
 *
 * That mismatch silently broke the entire payment-recovery path: `order.paid`
 * threw on `totalAmount` every replay (so a stranded payer was never rescued),
 * and `subscription.*` parsed "successfully" while dropping the period dates,
 * later stripping entitlement from a paid-through subscriber.
 *
 * Accepting BOTH spellings makes replay correct for events already sitting in
 * the table, not just for ones stored from now on. Belt and braces: the route
 * now stores the parsed shape, and these schemas no longer care either way.
 */
function camelOrSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const [key, value] of Object.entries(obj)) {
    if (!key.includes('_')) continue;
    const camel = key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
    // Never clobber a camelCase value that is already present.
    if (out[camel] === undefined) out[camel] = value;
  }
  return out;
}

/** Pre-processes a payload so snake_case wire keys satisfy camelCase fields. */
const withSnakeCaseFallback = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? camelOrSnake(value as Record<string, unknown>)
        : value,
    schema,
  );

/* ---------- Order (order.paid / order.refunded data) ---------- */

/**
 * The subset of a Polar `Order` the processor reads.
 * Amounts are integer cents. `subscriptionId` present ⇒ this order is a
 * subscription cycle (renewal), not a one-time letter purchase.
 */
export const polarOrderSchema = withSnakeCaseFallback(
  z
  .object({
    id: z.string().min(1),
    // Integer cents, after discounts and taxes.
    totalAmount: z.number(),
    // Present on subscription-cycle orders; null/absent on one-time orders.
    subscriptionId: z.string().nullable().optional(),
    customerId: z.string().nullable().optional(),
    productId: z.string().nullable().optional(),
    // Echoed from the checkout metadata — carries { caseId } for deposits.
    metadata: z.record(z.unknown()).optional().default({}),
    // Customer email — set by Polar from the actual paying customer's record, NOT
    // from the client-supplied checkout metadata. This is the trustworthy signal
    // for binding a one-time order to its payer (the metadata caseId/userId are
    // attacker-controllable). Polar nests it under `customer`, same as the
    // subscription payload.
    customer: z
      .object({ email: z.string().nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    product: z
      .object({ name: z.string().optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough(),
);

export type PolarOrder = z.infer<typeof polarOrderSchema>;

/* ---------- Subscription (subscription.* data) ---------- */

/**
 * The subset of a Polar `Subscription` the processor reads. `currentPeriodStart`
 * / `currentPeriodEnd` are Dates on the SDK object; we coerce to Date then store
 * epoch ms in Convex.
 */
export const polarSubscriptionSchema = withSnakeCaseFallback(
  z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    customerId: z.string().nullable().optional(),
    currentPeriodStart: z.coerce.date().nullable().optional(),
    currentPeriodEnd: z.coerce.date().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional().default(false),
    recurringInterval: z.string().nullable().optional(),
    metadata: z.record(z.unknown()).optional().default({}),
    // Customer email — the fallback for linking a subscription to its owner when
    // metadata.userId isn't present. Polar nests it under `customer`.
    customer: z
      .object({ email: z.string().nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    product: z
      .object({ name: z.string().optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough(),
);

export type PolarSubscription = z.infer<typeof polarSubscriptionSchema>;

/* ---------- Helpers ---------- */

/** Reads `metadata.caseId` (echoed from checkout) as a string, if present. */
export function readCaseIdFromMetadata(
  metadata: Record<string, unknown>,
): string | undefined {
  const raw = metadata['caseId'];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * Derives our internal plan id from the Polar product name / recurring interval.
 * A product whose name mentions "annual"/"year", or a yearly recurring interval,
 * maps to `annual_unlimited`; otherwise `monthly_unlimited`.
 */
export function derivePlan(
  productName: string | undefined,
  recurringInterval: string | null | undefined,
): 'annual_unlimited' | 'monthly_unlimited' {
  const name = (productName ?? '').toLowerCase();
  const isAnnual =
    name.includes('annual') ||
    name.includes('year') ||
    recurringInterval === 'year';
  return isAnnual ? 'annual_unlimited' : 'monthly_unlimited';
}
