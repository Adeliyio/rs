/**
 * Disclaimer injector — server-only.
 *
 * Appends the appropriate disclaimer to generated email bodies
 * and letter bodies. Disclaimer text is loaded from the KB
 * compliance/disclaimers.json file.
 */

import { loadDisclaimers } from '@/lib/kb/loader';

/* ------------------------------------------------------------------ */
/*  Separator                                                         */
/* ------------------------------------------------------------------ */

const EMAIL_DISCLAIMER_SEPARATOR =
  '\n\n---\n\n';

const LETTER_DISCLAIMER_SEPARATOR =
  '\n\n________________________________________\n\n';

/* ------------------------------------------------------------------ */
/*  Public functions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Appends the subscription/delivery disclaimer as a footer to an
 * email body. Uses the "on_letter" disclaimer variant from
 * disclaimers.json (it covers both letters and email sequences
 * for the sender's copy).
 *
 * @param emailBody  The generated email body text.
 * @returns  The email body with disclaimer appended.
 */
export function injectEmailDisclaimer(emailBody: string): string {
  const disclaimers = loadDisclaimers();
  const onLetter = disclaimers.disclaimers['on_letter'];

  if (!onLetter?.text) {
    // Fallback disclaimer if KB file is malformed
    return (
      emailBody +
      EMAIL_DISCLAIMER_SEPARATOR +
      'Note: This email was drafted with writing assistance. It is not legal advice. Review all content before sending.'
    );
  }

  return emailBody + EMAIL_DISCLAIMER_SEPARATOR + onLetter.text;
}

/**
 * Appends the on-letter disclaimer as a footer to a generated
 * demand letter body (for the deposit wedge, Phase 3).
 *
 * @param letterBody  The generated letter body text.
 * @returns  The letter body with disclaimer appended.
 */
export function injectLetterDisclaimer(letterBody: string): string {
  const disclaimers = loadDisclaimers();
  const onLetter = disclaimers.disclaimers['on_letter'];

  if (!onLetter?.text) {
    return (
      letterBody +
      LETTER_DISCLAIMER_SEPARATOR +
      'Note: This letter was drafted with writing assistance. It is not legal advice. Review all content before sending.'
    );
  }

  return letterBody + LETTER_DISCLAIMER_SEPARATOR + onLetter.text;
}
