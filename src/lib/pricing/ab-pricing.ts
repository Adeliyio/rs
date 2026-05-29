/**
 * A/B price testing — server + client.
 *
 * Reads price variants from environment variables:
 *   NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS = "49:pri_abc123,59:pri_def456"
 *
 * Format: comma-separated pairs of "amount_in_dollars:paddle_price_id".
 * If only one variant is configured (or the env var is empty), falls
 * back to the default price.
 *
 * Assignment: deterministic hash of caseId so the same case always
 * sees the same price. Logged in audit_log for analysis.
 *
 * PRD §9.5: price A/B testing.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PriceVariant {
  amount: number; // dollars (e.g. 49)
  priceId: string; // Paddle price ID
  label: string; // display label (e.g. "$49")
}

/* ------------------------------------------------------------------ */
/*  Variant parsing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parses price variants from the environment variable.
 * Returns an array of PriceVariant objects.
 */
export function parsePriceVariants(): PriceVariant[] {
  const raw = process.env.NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS ?? '';
  if (!raw.trim()) {
    // Fall back to single default price
    const defaultPriceId =
      process.env.NEXT_PUBLIC_PADDLE_DEPOSIT_PRICE_ID ?? '';
    return [
      {
        amount: 49,
        priceId: defaultPriceId,
        label: '$49',
      },
    ];
  }

  const variants: PriceVariant[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const [amountStr, priceId] = trimmed.split(':');
    if (!amountStr || !priceId) continue;

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) continue;

    variants.push({
      amount,
      priceId: priceId.trim(),
      label: `$${amount}`,
    });
  }

  if (variants.length === 0) {
    const defaultPriceId =
      process.env.NEXT_PUBLIC_PADDLE_DEPOSIT_PRICE_ID ?? '';
    return [{ amount: 49, priceId: defaultPriceId, label: '$49' }];
  }

  return variants;
}

/* ------------------------------------------------------------------ */
/*  Variant assignment                                                */
/* ------------------------------------------------------------------ */

/**
 * Simple deterministic hash: assigns a variant index based on the case ID.
 * Uses character codes for a lightweight, predictable distribution.
 */
function hashCaseId(caseId: string): number {
  let hash = 0;
  for (let i = 0; i < caseId.length; i++) {
    hash = (hash * 31 + caseId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Assigns a price variant for a given case ID.
 * Deterministic: same caseId always gets the same variant.
 */
export function assignPriceVariant(caseId: string): PriceVariant {
  const variants = parsePriceVariants();
  if (variants.length <= 1) return variants[0]!;

  const index = hashCaseId(caseId) % variants.length;
  return variants[index]!;
}

/**
 * Returns all configured price variants.
 * Used by the preview API to include pricing info in the response.
 */
export function getPriceVariants(): PriceVariant[] {
  return parsePriceVariants();
}
