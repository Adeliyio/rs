/**
 * Masking of USER-SUPPLIED free text before our own content checks run.
 *
 * Why this exists: the compliance scanner matches BARE WORDS from its
 * prohibited list, case-insensitively, on space boundaries. Several of those
 * words are ordinary business-name vocabulary. The letter generator is REQUIRED
 * by its own prompt to reproduce the landlord's name and the user's deduction
 * descriptions verbatim. So a tenant whose landlord or vendor happened to be
 * named using one of those words — real national brands exist — tripped the
 * scanner on their own data. The strict retry could not help: no prompt change
 * removes a name the prompt mandates. Generation hard-failed twice and the $49
 * customer was auto-refunded with no letter, through no fault of their own.
 * (See user-value-mask.test.ts for the concrete triggering names.)
 *
 * The same reasoning applies to the citation validator: a user's account id or
 * company name that happens to look like a statute ("FTC Act Gyms", an id
 * containing "§1950.5") must not be stripped as a fabricated citation.
 *
 * The rule is: SCAN ONLY WHAT WE AUTHORED. User text is data, not our content.
 *
 * This logic was originally written for the free subscription pipeline, where
 * the same class of bug had already "bricked real, innocent requests". It was
 * never applied to the paid deposit letter — so the fix was inert for the
 * product people actually pay for. It now lives here so both pipelines share it.
 */

/** Escapes a string for literal use inside a RegExp. */
function esc(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keeps only values substantial enough to mask. Very short strings (1-2 chars)
 * would match far too broadly and could blank out unrelated letter text.
 */
export function maskableValues(values: Array<string | undefined | null>): string[] {
  return values.filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 2,
  );
}

/**
 * Replaces user-supplied spans with a neutral token before COMPLIANCE scanning,
 * so a banned phrase inside the USER's own words cannot fail the deliverable.
 * Only our own scaffolding remains scanned.
 *
 * One-way: use this where the scanned text is discarded afterwards.
 */
export function maskUserValues(text: string, values: string[]): string {
  let masked = text;
  for (const v of maskableValues(values)) {
    masked = masked.replace(new RegExp(esc(v), 'g'), '[USER_VALUE]');
  }
  return masked;
}

/**
 * REVERSIBLE mask for the CITATION-validation path: swaps each user value for a
 * unique sentinel, validates on the masked text, then restores the exact user
 * values into the cleaned output.
 *
 * The sentinel is deliberately NOT citation-shaped, so the validator's
 * normalize and removal passes leave it alone.
 */
export function maskUserValuesReversible(
  text: string,
  values: string[],
): { masked: string; restore: (s: string) => string } {
  const tokens: { token: string; value: string }[] = [];
  let masked = text;

  maskableValues(values).forEach((v, i) => {
    const token = `XUSERVALUEX${i}X`;
    if (masked.includes(v)) {
      masked = masked.replace(new RegExp(esc(v), 'g'), token);
      tokens.push({ token, value: v });
    }
  });

  const restore = (s: string): string => {
    let out = s;
    for (const { token, value } of tokens) {
      out = out.split(token).join(value);
    }
    return out;
  };

  return { masked, restore };
}
