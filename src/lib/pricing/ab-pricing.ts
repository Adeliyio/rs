/**
 * A/B price testing — server + client.
 *
 * Reads price variants from environment variables:
 *   NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS = "49:<polar_product_id>,59:<polar_product_id>"
 *
 * Format: comma-separated pairs of "amount_in_dollars:polar_product_id".
 * If only one variant is configured (or the env var is empty), falls back to the
 * default Polar deposit-letter product (NEXT_PUBLIC_POLAR_PRODUCT_LETTER).
 *
 * Assignment: deterministic hash of caseId so the same case always sees the same
 * price. Logged in audit_log for analysis.
 *
 * PRD §9.5: price A/B testing.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PriceVariant {
  amount: number; // dollars (e.g. 49)
  productId: string; // Polar product ID
  label: string; // display label (e.g. "$49")
}

/* ------------------------------------------------------------------ */
/*  Variant parsing                                                   */
/* ------------------------------------------------------------------ */

/** The default Polar deposit-letter product id (client env). */
function defaultLetterProductId(): string {
  return process.env.NEXT_PUBLIC_POLAR_PRODUCT_LETTER ?? '';
}

/**
 * Parses price variants from the environment variable.
 * Returns an array of PriceVariant objects.
 */
export function parsePriceVariants(): PriceVariant[] {
  const raw = process.env.NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS ?? '';
  if (!raw.trim()) {
    // Fall back to the single default Polar product.
    return [
      {
        amount: 49,
        productId: defaultLetterProductId(),
        label: '$49',
      },
    ];
  }

  const variants: PriceVariant[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const [amountStr, productId] = trimmed.split(':');
    if (!amountStr || !productId) continue;

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) continue;

    variants.push({
      amount,
      productId: productId.trim(),
      label: `$${amount}`,
    });
  }

  if (variants.length === 0) {
    return [{ amount: 49, productId: defaultLetterProductId(), label: '$49' }];
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
