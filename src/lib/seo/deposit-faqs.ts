/**
 * Per-state security-deposit FAQ content for the /deposit/{state} pages.
 *
 * These answer the highest-volume "People Also Ask" queries from keyword
 * research (deadline, cleaning/deductions, deposit cap, "what if they missed
 * it", how much I can sue for). The copy is visible on-page — the format Google
 * AI Overviews and PAA extract — and every fact is drawn from the same verified
 * statute research that feeds the KB and the demand-letter generator, so the
 * marketing page can't drift from the letter.
 *
 * Kept in the config layer (not hardcoded in the component) per the
 * configuration-over-code rule, but separate from the Zod-validated
 * JURISDICTIONS schema so per-state prose doesn't bloat that boundary.
 *
 * NOTE: general statutory information only — Resolvaio is a writing and
 * research assistance tool, not a law firm. Statute-cited and conservative;
 * no outcome claims.
 */

export interface DepositFaq {
  question: string;
  answer: string;
}

/** Keyed by two-letter state code. */
export const DEPOSIT_FAQS: Record<string, DepositFaq[]> = {
  CA: [
    {
      question: 'How long does my California landlord have to return my deposit?',
      answer:
        'California landlords have 21 calendar days after you move out to either return your full deposit or mail an itemized statement of deductions with any remaining balance. The 21 days count weekends and holidays (Cal. Civ. Code § 1950.5).',
    },
    {
      question: 'Can my California landlord charge me for cleaning?',
      answer:
        'Only for cleaning needed to return the unit to the condition it was in at move-in — not for ordinary wear and tear. If more than $125 is deducted, the landlord must provide receipts for the labor and materials. Since April 2025 (SB 712), landlords must also document the unit with before-and-after photos.',
    },
    {
      question: 'What can a California landlord legally deduct?',
      answer:
        'Deductions are limited to four statutory categories: unpaid rent, cleaning to move-in condition, repair of damage beyond normal wear and tear, and restoring or replacing items where the lease allows it. Anything outside those categories — or normal wear — is not a valid deduction.',
    },
    {
      question: 'How much can my California landlord charge as a deposit?',
      answer:
        'As of AB 12 (2024), most California landlords may charge no more than one month’s rent as a security deposit, regardless of whether the unit is furnished. A narrow small-landlord exception exists.',
    },
    {
      question: 'What if my landlord missed the 21-day deadline?',
      answer:
        'Missing the deadline or failing to itemize weakens the landlord’s position. If a court finds the deposit was retained in bad faith, you may recover the deposit plus up to twice its amount in statutory damages (Cal. Civ. Code § 1950.5(l)).',
    },
    {
      question: 'How much can I sue for in California small claims?',
      answer:
        'California small claims court handles deposit disputes up to $12,500 for individuals. You can file without a lawyer, and a free Small Claims Advisor is available in most counties.',
    },
  ],
  TX: [
    {
      question: 'How long does my Texas landlord have to return my deposit?',
      answer:
        'Texas landlords have 30 days after you surrender the property to refund the deposit or provide an itemized list of deductions — but the clock only starts once you give the landlord a written forwarding address (Tex. Prop. Code §§ 92.103, 92.107).',
    },
    {
      question: 'Do I have to give my Texas landlord a forwarding address?',
      answer:
        'Yes — this is the single most important step in Texas. The landlord has no duty to return the deposit until you provide a written forwarding address. Always send it in writing and keep proof.',
    },
    {
      question: 'What can a Texas landlord deduct from my deposit?',
      answer:
        'A Texas landlord may deduct for damage beyond normal wear and tear and for charges the lease specifies, and must give an itemized list of deductions. They may not deduct for normal wear and tear (Tex. Prop. Code § 92.104).',
    },
    {
      question: 'What if my Texas landlord keeps my deposit in bad faith?',
      answer:
        'A landlord who retains a deposit in bad faith is liable for $100, plus three times the portion of the deposit wrongfully withheld, plus reasonable attorney’s fees (Tex. Prop. Code § 92.109).',
    },
    {
      question: 'How much can I sue for in Texas?',
      answer:
        'Texas Justice of the Peace (small claims) courts handle deposit disputes up to $20,000. You can file without a lawyer.',
    },
  ],
  NY: [
    {
      question: 'How long does my New York landlord have to return my deposit?',
      answer:
        'New York landlords have 14 days after you move out to return the deposit along with an itemized statement of any deductions (N.Y. Gen. Oblig. Law § 7-108).',
    },
    {
      question: 'What happens if my New York landlord misses the 14-day deadline?',
      answer:
        'If the landlord fails to provide the itemized statement and return the deposit within 14 days, they forfeit the right to keep any portion of it — the full deposit must be returned.',
    },
    {
      question: 'How much can my New York landlord charge as a deposit?',
      answer:
        'Since the 2019 HSTPA reforms, a New York landlord may not require a security deposit greater than one month’s rent, regardless of the length of the tenancy. Move-in fees dressed up as deposits are not allowed.',
    },
    {
      question: 'Can my New York landlord charge me for cleaning?',
      answer:
        'Deductions are limited to unpaid rent and damage beyond ordinary wear and tear. Routine cleaning and normal wear are not deductible.',
    },
    {
      question: 'Can I recover more than my deposit in New York?',
      answer:
        'Beyond the forfeiture rule, courts may award punitive damages and reasonable attorney’s fees where a landlord willfully violates § 7-108.',
    },
    {
      question: 'How much can I sue for in New York small claims?',
      answer:
        'New York City small claims courts handle disputes up to $10,000; most courts outside the city handle up to $5,000. You can file without a lawyer.',
    },
  ],
  FL: [
    {
      question: 'How long does my Florida landlord have to return my deposit?',
      answer:
        'If the landlord makes no claim on the deposit, they have 15 days to return it. If they intend to keep part of it, they must send you written notice by certified mail within 30 days of your move-out (Fla. Stat. § 83.49).',
    },
    {
      question: 'What happens if my Florida landlord misses the certified-mail deadline?',
      answer:
        'If the landlord fails to send the required written notice by certified mail within 30 days, they forfeit the right to make any claim against the deposit — the full amount must be returned (Fla. Stat. § 83.49(3)(c)).',
    },
    {
      question: 'What can a Florida landlord deduct from my deposit?',
      answer:
        'A Florida landlord may deduct for unpaid rent and damage beyond ordinary wear and tear, and must state the specific reasons in the certified-mail notice. You then have 15 days to object in writing.',
    },
    {
      question: 'Can my Florida landlord charge me for cleaning?',
      answer:
        'Only for cleaning beyond ordinary wear and tear. Routine wear from normal living is not a valid deduction, and any deduction must be itemized in the 30-day notice.',
    },
    {
      question: 'How much can I sue for in Florida?',
      answer:
        'Florida county courts handle small claims deposit disputes up to $8,000, and you may also recover attorney’s fees and court costs if you prevail. Filing does not require a lawyer.',
    },
  ],
};
