'use client';

/**
 * Persistent legal-safety disclaimer for the anonymous diagnostic surface
 * (SPEC.md §4). Plain-language, non-dismissible: Resolvaio sells legal
 * INFORMATION grounded in verified statutes — never advice, never "a lawyer".
 *
 * The exact copy is mandated by the spec and is shown on every anonymous result
 * screen (deposit value reveal and cancellation sequence).
 */

import { Scale } from 'lucide-react';

/** The spec-mandated persistent disclaimer sentence (SPEC.md §4). */
export const ANONYMOUS_DISCLAIMER_TEXT =
  'Resolvaio provides legal information grounded in verified statutes — not legal advice. We are not a law firm and not your attorney.';

export function AnonymousDisclaimer(): React.JSX.Element {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/60 px-4 py-3"
    >
      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="text-[13px] leading-relaxed text-amber-900">
        {ANONYMOUS_DISCLAIMER_TEXT}
      </p>
    </div>
  );
}
