/**
 * Blog article data — static content for SEO pages.
 *
 * Each article targets a specific search intent and uses real
 * statute data from the KB. Articles are structured as data,
 * not MDX, to keep the build simple and avoid additional dependencies.
 */

export interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  category: 'deposit-state' | 'deposit-general' | 'subscription' | 'consumer-rights';
  publishedAt: string;
  /** CTA link — where the article should drive the reader */
  ctaHref: string;
  ctaText: string;
  sections: ArticleSection[];
}

export interface ArticleSection {
  heading?: string;
  body: string;
}

/* ------------------------------------------------------------------ */
/*  Articles                                                          */
/* ------------------------------------------------------------------ */

export const ARTICLES: BlogArticle[] = [
  /* ---- 1. California Security Deposit ---- */
  {
    slug: 'california-security-deposit-law',
    title: 'How to Get Your Security Deposit Back in California: Deadlines, Penalties, and Civil Code \u00A7 1950.5',
    description: 'California landlords have 21 days to return your deposit or provide an itemized statement. Here\u2019s what the law says, what penalties exist, and how to write a demand letter that cites the right statute.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your California demand letter',
    sections: [
      {
        body: 'If your California landlord hasn\u2019t returned your security deposit, the law is specific about what they owe you and when. Cal. Civ. Code \u00A7 1950.5 governs security deposits in California and it\u2019s one of the strongest tenant protection statutes in the country.',
      },
      {
        heading: 'The 21-Day Deadline',
        body: 'Under \u00A7 1950.5(e), your landlord has exactly 21 calendar days from the date you vacate the unit to either return your full deposit or provide a written, itemized statement of deductions along with the remaining balance. This is not a suggestion \u2014 it\u2019s a statutory requirement. If they provide a good-faith estimate for repairs within 21 days, they have an additional 14 days to provide the final accounting with receipts.',
      },
      {
        heading: 'What They Can and Cannot Deduct',
        body: 'Permissible deductions under California law include: unpaid rent, cleaning costs to restore the unit to its move-in condition (not better), repair of damage beyond normal wear and tear, and restoration of personal property if the lease permits.\n\nProhibited deductions include: repainting for normal wear, carpet replacement for normal wear, and any deduction that exceeds the actual cost of repair. Your landlord must provide copies of receipts or invoices for all deductions.',
      },
      {
        heading: 'The Penalty for Bad Faith Retention',
        body: 'This is where California law has real teeth. Under \u00A7 1950.5(l), if your landlord retains any portion of your deposit in bad faith, a court may award you up to twice the amount of the security deposit, in addition to actual damages. A landlord who misses the 21-day deadline or deducts for normal wear and tear is likely acting in bad faith.',
      },
      {
        heading: 'Deposit Cap',
        body: 'As of July 1, 2024 (AB 12), the maximum security deposit in California is one month\u2019s rent. A small landlord exception (2 or fewer properties, 4 or fewer total units) previously allowed two months\u2019 rent, but this exception expired July 1, 2025.',
      },
      {
        heading: 'How to Write a Demand Letter',
        body: 'An effective demand letter cites \u00A7 1950.5(e) (the 21-day deadline), \u00A7 1950.5(l) (the 2x penalty), and the specific facts: your move-out date, how many days have elapsed, and the amount withheld. Generic letters that say \u201cplease return my deposit\u201d get ignored. Letters that cite the specific statute and penalty provision get attention.\n\nResolvaio generates demand letters with the exact California citations, an itemized rebuttal of each deduction, and the penalty provision language \u2014 validated against our database of primary legal sources.',
      },
      {
        heading: 'Filing in Small Claims Court',
        body: 'If your landlord ignores the demand letter, California Small Claims Court handles cases up to $10,000 (or $5,000 for businesses). Filing fees range from $30 to $75 depending on the amount. You don\u2019t need a lawyer. The demand letter serves as evidence that you attempted to resolve the dispute before filing.\n\nNote: The specific court, forms, and filing procedures vary by county. Los Angeles, San Francisco, San Diego, and Sacramento each have their own small claims division.',
      },
      {
        heading: 'Key Dates and Provisions',
        body: '\u2022 Deposit return deadline: 21 calendar days from vacating\n\u2022 Maximum deposit: 1 month\u2019s rent (AB 12)\n\u2022 Bad faith penalty: Up to 2\u00D7 deposit amount (\u00A7 1950.5(l))\n\u2022 Statute: Cal. Civ. Code \u00A7 1950.5\n\u2022 Initial inspection: Landlord must offer (no earlier than 2 weeks before lease end)\n\u2022 Receipts required: Copies of invoices for all deductions\n\u2022 AB 414 (effective Jan 1, 2026): Adds photographic documentation requirements',
      },
    ],
  },

  /* ---- 2. Texas Security Deposit ---- */
  {
    slug: 'texas-security-deposit-law',
    title: 'Texas Security Deposit Law: What Property Code \u00A7 92.103 Requires Your Landlord to Do',
    description: 'Texas landlords have 30 days to return your deposit \u2014 but only after you provide a written forwarding address. The penalty for bad faith: $100 + 3\u00D7 the amount withheld + attorney\u2019s fees.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your Texas demand letter',
    sections: [
      {
        body: 'Texas security deposit law (Tex. Prop. Code \u00A7\u00A7 92.101\u201392.109) has a unique wrinkle that most tenants don\u2019t know about: the 30-day return clock doesn\u2019t start until you provide your landlord with a written forwarding address. Miss this step and your landlord technically hasn\u2019t violated the statute \u2014 even if months have passed.',
      },
      {
        heading: 'The 30-Day Deadline (and the Forwarding Address Trap)',
        body: 'Under \u00A7 92.103(a), the landlord must refund the deposit or provide a written itemized list of deductions within 30 days of the tenant\u2019s surrender of the premises. But \u00A7 92.107(a) adds a critical condition: this obligation does not arise until the tenant provides a written forwarding address.\n\nIf you moved out and never provided a forwarding address in writing, send one now. The 30-day clock starts when they receive it.',
      },
      {
        heading: 'What They Can Deduct',
        body: 'Under \u00A7 92.104, landlords may deduct for damages and charges beyond normal wear and tear, unpaid rent, and other breach-of-lease charges. They must provide a written description and itemized list of all deductions. Normal wear and tear is explicitly excluded from permissible deductions.',
      },
      {
        heading: 'The Penalty: $100 + 3\u00D7 + Attorney\u2019s Fees',
        body: 'Texas has one of the strongest penalty provisions in the country. Under \u00A7 92.109(a), a landlord who retains a deposit in bad faith is liable for:\n\n\u2022 $100 statutory penalty\n\u2022 Three times the portion of the deposit wrongfully withheld\n\u2022 Reasonable attorney\u2019s fees\n\nFor a $1,500 deposit wrongfully withheld, that\u2019s $100 + $4,500 + attorney\u2019s fees = potentially $5,000+ in liability. This penalty provision is the strongest leverage a demand letter can cite.',
      },
      {
        heading: 'No Deposit Cap',
        body: 'Unlike California (1 month) and New York (1 month), Texas has no statutory cap on the amount a landlord can charge for a security deposit. This means deposits in Texas can be unusually large, making the stakes of a deposit dispute higher.',
      },
      {
        heading: 'Small Claims in Texas',
        body: 'Texas Justice Courts handle small claims up to $20,000 \u2014 one of the highest limits in the country. Filing fees are typically $50\u2013$100. You don\u2019t need a lawyer, though the penalty provision includes attorney\u2019s fees if you choose to hire one.',
      },
      {
        heading: 'Key Dates and Provisions',
        body: '\u2022 Deposit return deadline: 30 days after written forwarding address received\n\u2022 Maximum deposit: No statutory cap\n\u2022 Bad faith penalty: $100 + 3\u00D7 wrongfully withheld + attorney\u2019s fees (\u00A7 92.109)\n\u2022 Statutes: Tex. Prop. Code \u00A7\u00A7 92.101\u201392.109\n\u2022 Forwarding address: Must be in writing (\u00A7 92.107)\n\u2022 Itemization required: Written description + itemized list (\u00A7 92.104)',
      },
    ],
  },

  /* ---- 3. New York Security Deposit ---- */
  {
    slug: 'new-york-security-deposit-law',
    title: 'New York Security Deposit Return Rules: The 14-Day Deadline Under General Obligations Law \u00A7 7-108',
    description: 'New York gives landlords just 14 days to return your deposit. The HSTPA caps deposits at one month\u2019s rent and bans pet deposits. Here\u2019s the full breakdown.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your New York demand letter',
    sections: [
      {
        body: 'New York has the shortest deposit return deadline of any of the four most populated states: 14 days. The Housing Stability and Tenant Protection Act (HSTPA) of 2019 dramatically strengthened tenant protections, and N.Y. Gen. Oblig. Law \u00A7 7-108 is the statute that governs how deposits are handled.',
      },
      {
        heading: 'The 14-Day Deadline',
        body: 'Under \u00A7 7-108(1-a)(e), the landlord must return the deposit or provide an itemized statement of deductions within 14 days of the tenant vacating the unit. This is the strictest timeline of any major US state. If your landlord misses this deadline, they have likely forfeited any right to retain the deposit.',
      },
      {
        heading: 'The One-Month Cap and HSTPA Reforms',
        body: 'Since the HSTPA took effect in June 2019:\n\n\u2022 Maximum deposit: 1 month\u2019s rent (\u00A7 7-108(1-a)(a))\n\u2022 Pet deposits and pet fees: Prohibited\n\u2022 \u201cLast month\u2019s rent\u201d as a condition of the lease: Prohibited\n\u2022 Additional deposits of any kind: Prohibited\n\nIf your landlord collected more than one month\u2019s rent, they already violated the statute.',
      },
      {
        heading: 'Itemization and Receipt Requirements',
        body: 'Under \u00A7 7-108(1-a)(c), any deduction from the deposit must be accompanied by an itemized statement and copies of receipts showing the actual costs incurred. General statements like \u201ccleaning fee\u201d or \u201cpaint\u201d without itemization and receipts are insufficient.',
      },
      {
        heading: 'Interest-Bearing Account Requirement',
        body: 'For buildings with 6 or more units, the landlord must place the deposit in an interest-bearing account in a New York bank and notify the tenant of the bank name and address. The tenant is entitled to the interest earned, minus a 1% annual administrative fee retained by the landlord (\u00A7 7-108(1-a)(d)).',
      },
      {
        heading: 'Penalties and Remedies',
        body: 'New York does not have an explicit statutory multiplier like California (2\u00D7) or Texas (3\u00D7 + $100). However, courts may award:\n\n\u2022 The full amount wrongfully withheld\n\u2022 Punitive damages for bad faith (at the court\u2019s discretion)\n\u2022 Attorney\u2019s fees\n\nThe 14-day deadline itself is strong leverage \u2014 a landlord who misses it has a difficult time justifying any deductions.',
      },
      {
        heading: 'Key Dates and Provisions',
        body: '\u2022 Deposit return deadline: 14 days from vacating\n\u2022 Maximum deposit: 1 month\u2019s rent (HSTPA 2019)\n\u2022 Pet deposits/fees: Prohibited\n\u2022 Penalty: Actual damages + potential punitive damages + attorney\u2019s fees\n\u2022 Statute: N.Y. Gen. Oblig. Law \u00A7 7-108\n\u2022 Interest required: Buildings with 6+ units\n\u2022 NYC enforcement: Department of Consumer and Worker Protection (DCWP)',
      },
    ],
  },

  /* ---- 4. Florida Security Deposit ---- */
  {
    slug: 'florida-security-deposit-law',
    title: 'Florida Security Deposit Law: What Statute \u00A7 83.49 Says About Deadlines, Certified Mail, and Forfeiture',
    description: 'Florida has a unique two-tier deposit return process. If your landlord doesn\u2019t send a certified mail notice within 30 days, they forfeit their right to keep any of your deposit.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your Florida demand letter',
    sections: [
      {
        body: 'Florida\u2019s security deposit law (Fla. Stat. \u00A7 83.49) has a two-tier timeline and a strict certified mail requirement that many landlords fail to follow. If they miss the procedural requirements, they forfeit their right to claim against the deposit entirely.',
      },
      {
        heading: 'The Two-Tier Timeline',
        body: 'Florida uses two different deadlines depending on whether the landlord intends to make deductions:\n\n\u2022 15 days: If the landlord has NO claim against the deposit, they must return it in full within 15 days (\u00A7 83.49(3)(a)).\n\u2022 30 days: If the landlord intends to claim against the deposit, they must send a notice by certified mail within 30 days stating the amount claimed and the specific reasons (\u00A7 83.49(3)(b)).\n\nThe tenant then has 15 days from receiving the claim notice to object in writing.',
      },
      {
        heading: 'The Certified Mail Requirement',
        body: 'This is where Florida law creates real leverage. The claim notice MUST be sent by certified mail (\u00A7 83.49(3)(b)). The notice must also include specific statutory language advising the tenant of the 15-day objection window. If the landlord sends the notice by regular mail, or doesn\u2019t include the required language, the notice may be defective.',
      },
      {
        heading: 'Forfeiture: The Strongest Provision',
        body: 'Under \u00A7 83.49(3)(c), if the landlord fails to send the certified mail claim notice within 30 days, the landlord forfeits the right to impose a claim against the deposit. This means: no matter what damage exists, no matter what the lease says, if they missed the 30-day certified mail deadline, the full deposit must be returned.\n\nThis is the most powerful leverage point in a Florida deposit dispute. A demand letter that cites this forfeiture provision puts significant pressure on the landlord to return the deposit.',
      },
      {
        heading: 'Deposit Holding Requirements',
        body: 'Florida landlords must hold the deposit in one of three ways:\n\n\u2022 A separate non-interest-bearing account in a Florida banking institution\n\u2022 A separate interest-bearing account (tenant receives 75% of interest or 5% simple interest annually)\n\u2022 A surety bond posted with the clerk of the circuit court\n\nThe landlord must notify the tenant within 30 days of receiving the deposit of the bank name, address, and whether the account is interest-bearing (\u00A7 83.49(2)).',
      },
      {
        heading: 'Small Claims in Florida',
        body: 'Florida\u2019s small claims limit was raised to $10,000 effective July 1, 2024 (CS/SB 1066). Filing fees vary by amount. Pre-trial mediation is typically required before a hearing (Fla. R. Civ. P. 1.750).',
      },
      {
        heading: 'Key Dates and Provisions',
        body: '\u2022 No-claim return: 15 days (\u00A7 83.49(3)(a))\n\u2022 Claim notice deadline: 30 days by certified mail (\u00A7 83.49(3)(b))\n\u2022 Tenant objection window: 15 days after receiving claim notice\n\u2022 Forfeiture: Landlord loses claim right if 30-day notice missed (\u00A7 83.49(3)(c))\n\u2022 Penalty: Actual damages + court costs + potential attorney\u2019s fees\n\u2022 Statute: Fla. Stat. \u00A7 83.49\n\u2022 Small claims limit: $10,000 (effective July 1, 2024)',
      },
    ],
  },

  /* ---- 5. California 21-Day Rule Deep Dive ---- */
  {
    slug: 'california-landlord-21-days-deposit',
    title: 'California Landlord Didn\u2019t Return Deposit in 21 Days \u2014 What Happens Next',
    description: 'Your California landlord missed the 21-day deadline. Here\u2019s what Cal. Civ. Code \u00A7 1950.5 says about bad faith penalties, how to write a demand letter, and when to file in small claims court.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter for free diagnostic',
    sections: [
      {
        body: 'If 21 days have passed since you moved out and your California landlord hasn\u2019t returned your security deposit or provided an itemized statement of deductions, they are in violation of Cal. Civ. Code \u00A7 1950.5(e). This article explains what the statute provides, what a demand letter accomplishes, and what small claims court looks like.',
      },
      {
        heading: 'The Statute Is Clear',
        body: 'Cal. Civ. Code \u00A7 1950.5(e) requires the landlord to return the deposit or provide an itemized statement within 21 calendar days of the tenant vacating the unit. There is no grace period, no exception for \u201cstill assessing damages,\u201d and no exception for \u201cwaiting on contractor quotes.\u201d The 21-day deadline is absolute.\n\nThe only exception: if the landlord provides a good-faith estimate within 21 days, they have an additional 14 days to provide the final accounting with actual receipts.',
      },
      {
        heading: 'Bad Faith and the 2\u00D7 Penalty',
        body: 'Under \u00A7 1950.5(l), a court may award up to twice the amount of the security deposit if the landlord retained it in bad faith. Missing the 21-day deadline is often considered evidence of bad faith. Deducting for normal wear and tear (painting, carpet replacement from normal use) is also commonly considered bad faith.\n\nFor a $2,000 deposit, the bad faith penalty can reach $4,000 \u2014 on top of the return of the actual deposit amount.',
      },
      {
        heading: 'Step 1: Send a Demand Letter',
        body: 'A demand letter is the standard first step. It puts the landlord on formal notice that they have violated the statute and states the specific remedy the law provides. An effective California demand letter cites:\n\n\u2022 \u00A7 1950.5(e) \u2014 the 21-day return deadline\n\u2022 The number of days that have actually elapsed\n\u2022 \u00A7 1950.5(l) \u2014 the 2\u00D7 penalty for bad faith retention\n\u2022 A deadline for response (typically 14\u201330 days)\n\nSend it via USPS Certified Mail with Return Receipt Requested. This creates a documented record of delivery.',
      },
      {
        heading: 'Step 2: File in Small Claims Court',
        body: 'If the landlord ignores the demand letter, California Small Claims Court handles cases up to $10,000 (individuals) or $5,000 (businesses). The process:\n\n\u2022 File a claim at your local courthouse (filing fee: $30\u2013$75)\n\u2022 Serve the landlord (typically by certified mail or process server)\n\u2022 Attend the hearing \u2014 bring your lease, move-out photos, the demand letter, and the certified mail receipt\n\u2022 The judge can award the deposit amount plus up to 2\u00D7 in bad faith damages\n\nYou do not need a lawyer for small claims court.',
      },
      {
        heading: 'What to Document Now',
        body: 'If you\u2019re past 21 days:\n\n\u2022 Calculate the exact number of days since move-out\n\u2022 Gather your lease agreement\n\u2022 Gather move-in and move-out photos (if you have them)\n\u2022 Save any communication with the landlord about the deposit\n\u2022 Keep records of any partial refund or itemization you received\n\nThis documentation strengthens both the demand letter and a potential small claims case.',
      },
    ],
  },

  /* ---- 6. Texas Normal Wear and Tear ---- */
  {
    slug: 'texas-landlord-normal-wear-and-tear',
    title: 'Can a Texas Landlord Keep Your Deposit for Normal Wear and Tear? What the Law Says',
    description: 'Texas Property Code \u00A7 92.104 prohibits deductions for normal wear and tear. Here\u2019s what counts, what doesn\u2019t, and what the 3\u00D7 penalty means for wrongful retention.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your Texas demand letter',
    sections: [
      {
        body: 'The short answer: no. Tex. Prop. Code \u00A7 92.104(a) explicitly states that a landlord may not retain any portion of the deposit for damages resulting from normal wear and tear. But the line between \u201cnormal wear\u201d and \u201cdamage\u201d is where most disputes happen.',
      },
      {
        heading: 'What Counts as Normal Wear and Tear',
        body: 'Texas courts have generally recognized these as normal wear:\n\n\u2022 Faded or slightly worn carpet from regular walking\n\u2022 Small nail holes from hanging pictures\n\u2022 Faded paint from sunlight exposure\n\u2022 Minor scuff marks on walls\n\u2022 Worn finishes on hardware (doorknobs, faucets)\n\u2022 Slightly worn kitchen countertops from regular use\n\nThese are expected consequences of living in a space for the lease term.',
      },
      {
        heading: 'What Counts as Damage',
        body: 'Deductions are permissible for damage beyond normal wear:\n\n\u2022 Large holes in walls\n\u2022 Stained or burned carpet from spills or cigarettes\n\u2022 Broken windows, doors, or fixtures\n\u2022 Pet damage (scratched floors, stained carpet, chewed trim)\n\u2022 Unauthorized alterations\n\nThe key distinction: normal wear comes from ordinary living; damage comes from negligence, misuse, or abuse.',
      },
      {
        heading: 'The Itemization Requirement',
        body: 'Under \u00A7 92.104(b), the landlord must provide a written description and itemized list of all deductions. A landlord who simply withholds the deposit without providing this itemization has violated the statute \u2014 regardless of whether the deductions were legitimate.',
      },
      {
        heading: 'The Penalty for Getting It Wrong',
        body: 'If a landlord deducts for normal wear and tear, \u00A7 92.109(a) provides that the landlord is liable for $100 plus three times the portion wrongfully withheld, plus reasonable attorney\u2019s fees. For a $500 carpet cleaning charge that was actually normal wear:\n\n\u2022 $100 statutory penalty\n\u2022 $1,500 (3\u00D7 the wrongfully withheld $500)\n\u2022 Attorney\u2019s fees if you hire a lawyer\n\nTotal potential liability: $1,600+ for a $500 wrongful deduction.',
      },
      {
        heading: 'What to Do',
        body: 'A demand letter that cites \u00A7 92.104 (prohibition on normal wear deductions) and \u00A7 92.109 (the 3\u00D7 penalty) is the standard first step. Send it by certified mail, give them 30 days to respond, and file in Justice Court if they don\u2019t.',
      },
    ],
  },

  /* ---- 7. How to Write a CA Demand Letter ---- */
  {
    slug: 'how-to-write-demand-letter-california',
    title: 'How to Write a Demand Letter to Your Landlord in California (With Statute Citations)',
    description: 'A step-by-step guide to writing an effective security deposit demand letter in California, including which sections of Civil Code \u00A7 1950.5 to cite and how to structure the letter.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your California demand letter',
    sections: [
      {
        body: 'A demand letter is the standard first step in recovering a security deposit in California. It puts the landlord on formal written notice that they have violated the statute. Most landlords respond to a well-cited demand letter \u2014 it\u2019s the ones without citations that get ignored.',
      },
      {
        heading: 'What to Include',
        body: 'An effective California security deposit demand letter should contain:\n\n1. Your name, former address, and current mailing address\n2. The landlord\u2019s name and address\n3. The date you vacated the unit\n4. The original deposit amount\n5. The number of days since you vacated (demonstrating the 21-day deadline has passed)\n6. A citation to Cal. Civ. Code \u00A7 1950.5(e) (the return deadline)\n7. A citation to \u00A7 1950.5(l) (the 2\u00D7 penalty for bad faith)\n8. A specific dollar amount demanded\n9. A response deadline (14\u201330 days is typical)\n10. A statement that you will pursue the matter in small claims court if not resolved',
      },
      {
        heading: 'The Citations That Matter',
        body: '\u2022 \u00A7 1950.5(e): Requires return within 21 days of vacating. This is the foundation of every California deposit demand.\n\u2022 \u00A7 1950.5(l): Provides up to 2\u00D7 the deposit for bad faith retention. This is the leverage \u2014 it converts a $2,000 dispute into a potential $6,000 liability.\n\u2022 \u00A7 1950.5(b)(2)-(4): Lists permissible deductions. Cite this to rebut specific deductions that fall outside the statutory list.\n\u2022 \u00A7 1950.5(f)(1): Requires initial inspection opportunity. If the landlord didn\u2019t offer one, mention it.',
      },
      {
        heading: 'How to Send It',
        body: 'Send the letter via USPS Certified Mail with Return Receipt Requested. This accomplishes two things:\n\n1. It creates proof that the landlord received the letter (the green return receipt card)\n2. It demonstrates that you are serious and have documentation\n\nKeep a copy of the letter, the certified mail receipt, and the return receipt card. These become evidence if you file in small claims court.',
      },
      {
        heading: 'What Not to Include',
        body: 'Do not include:\n\n\u2022 Threats of lawsuits beyond small claims (stay proportionate)\n\u2022 Emotional language or personal attacks\n\u2022 Demands for amounts you cannot substantiate\n\u2022 Citations to statutes you haven\u2019t verified\n\nThe letter should be factual, specific, and grounded in the statute. Professional tone, firm language, no bluster.',
      },
      {
        heading: 'What Happens After You Send It',
        body: 'Most landlords respond within 14\u201330 days. Common outcomes:\n\n\u2022 Full refund: The demand letter worked. Case closed.\n\u2022 Partial refund with explanation: Review the itemization against permitted deductions.\n\u2022 No response: Wait for your deadline to pass, then file in small claims court.\n\nThe demand letter itself is evidence in small claims \u2014 it shows you attempted resolution before filing. Judges view this favorably.',
      },
    ],
  },

  /* ---- 8. NY Deductions ---- */
  {
    slug: 'new-york-security-deposit-deductions',
    title: 'Security Deposit Deductions in New York: What Landlords Can and Cannot Charge For',
    description: 'New York\u2019s HSTPA limits deposits to one month\u2019s rent and bans pet fees. Here\u2019s what landlords can legally deduct under Gen. Oblig. Law \u00A7 7-108.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your New York demand letter',
    sections: [
      {
        body: 'Since the Housing Stability and Tenant Protection Act (HSTPA) took effect in 2019, New York has some of the strictest rules in the country about what a landlord can charge for \u2014 and what they can deduct from your security deposit.',
      },
      {
        heading: 'What They Can Deduct',
        body: 'Under \u00A7 7-108(1-a)(c), permissible deductions are limited to:\n\n\u2022 The actual and reasonable cost of repairing damage beyond normal wear and tear\n\u2022 Unpaid rent\n\nThat\u2019s it. The landlord must provide an itemized statement with copies of receipts showing actual costs. Estimates or flat-rate charges without documentation are insufficient.',
      },
      {
        heading: 'What They Cannot Deduct',
        body: '\u2022 Normal wear and tear (faded paint, minor scuffs, worn carpet from regular use)\n\u2022 Pet deposits or pet fees (banned entirely by HSTPA)\n\u2022 Any amount exceeding one month\u2019s rent (the maximum deposit allowed)\n\u2022 \u201cCleaning fees\u201d for normal cleaning between tenants\n\u2022 Repainting for normal fading or scuffing\n\nIf your landlord charged a pet deposit when you moved in, the HSTPA makes that illegal \u2014 you can demand it back.',
      },
      {
        heading: 'The 14-Day Deadline',
        body: 'The landlord has 14 days from the date you vacate to either return the full deposit or provide an itemized statement of deductions. Missing this deadline is often treated as forfeiture of the right to make any deductions.',
      },
      {
        heading: 'Interest on Your Deposit',
        body: 'For buildings with 6 or more units, the landlord is required to hold your deposit in an interest-bearing account at a New York bank. The statute provides that the tenant receives the interest earned, minus a 1% administrative fee. If the landlord failed to place the deposit in such an account, the tenant may demand that the deposit be applied to rent.',
      },
      {
        heading: 'What to Do If They Deducted Improperly',
        body: 'A demand letter citing \u00A7 7-108 and the HSTPA, with specific objections to each improper deduction, is the standard first step. In New York City, you can also file a complaint with the Department of Consumer and Worker Protection (DCWP). For amounts up to $10,000, Small Claims Court is available without a lawyer.',
      },
    ],
  },

  /* ---- 9. LA County Small Claims ---- */
  {
    slug: 'small-claims-security-deposit-los-angeles',
    title: 'How to File a Small Claims Case for Your Security Deposit in Los Angeles County',
    description: 'A practical guide to filing a security deposit case in LA County Small Claims Court: which courthouse, how to file, what to bring, and what to expect.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your California demand letter',
    sections: [
      {
        body: 'If your California landlord hasn\u2019t returned your security deposit after receiving a demand letter, Los Angeles County Small Claims Court is the next step. Here\u2019s the practical guide to filing, preparing, and appearing.',
      },
      {
        heading: 'Jurisdiction and Limits',
        body: 'LA County Small Claims Court handles cases up to $10,000 for individuals and $5,000 for businesses. Security deposit disputes are one of the most common case types. You do not need a lawyer \u2014 in fact, lawyers are generally not allowed to represent parties in California small claims court.',
      },
      {
        heading: 'Which Courthouse',
        body: 'You must file in the judicial district where the rental property is located OR where the landlord lives or does business. LA County has multiple courthouses. Check the LA Superior Court website for the correct location based on your rental property\u2019s zip code. Common courthouses include Stanley Mosk (downtown), Santa Monica, Van Nuys, and Torrance.',
      },
      {
        heading: 'How to File',
        body: '1. Fill out Form SC-100 (Plaintiff\u2019s Claim and ORDER to Go to Small Claims Court)\n2. File at the courthouse clerk\u2019s office or online via the LA Superior Court e-filing system\n3. Pay the filing fee ($30\u2013$75 depending on the amount claimed)\n4. Serve the landlord (the clerk provides instructions \u2014 typically certified mail or process server)\n5. Wait for your hearing date (usually 30\u201370 days after filing)',
      },
      {
        heading: 'What to Bring to the Hearing',
        body: '\u2022 Your lease agreement\n\u2022 Move-in and move-out photos (timestamped if possible)\n\u2022 A copy of your demand letter and the certified mail receipt\n\u2022 The return receipt card (proof the landlord received the demand)\n\u2022 Any itemized statement the landlord provided\n\u2022 Receipts or evidence that contradicts specific deductions\n\u2022 Your rent payment history\n\u2022 A simple timeline of events (move-out date, demand letter date, days elapsed)',
      },
      {
        heading: 'What to Expect',
        body: 'Small claims hearings are informal. You\u2019ll tell the judge your story, the landlord tells theirs, and the judge decides. Most hearings last 15\u201330 minutes. The judge will ask about:\n\n\u2022 When you moved out\n\u2022 Whether the landlord returned the deposit or provided an itemization within 21 days\n\u2022 Whether the deductions were for normal wear and tear\n\u2022 Whether you sent a demand letter before filing\n\nJudges commonly award the deposit amount plus bad faith damages (\u00A7 1950.5(l)) when the landlord missed the 21-day deadline without justification.',
      },
      {
        heading: 'Costs and Recovery',
        body: 'Filing fees ($30\u2013$75) can be added to your claim. If you win, the court issues a judgment. Most landlords pay the judgment \u2014 if they don\u2019t, you can pursue enforcement through wage garnishment or bank levy. The judgment also appears on their credit report.',
      },
    ],
  },

  /* ---- 10. State-by-State Comparison ---- */
  {
    slug: 'security-deposit-laws-by-state-comparison',
    title: 'Security Deposit Laws by State: A Side-by-Side Comparison of CA, TX, NY, and FL',
    description: 'Return deadlines, penalty provisions, deposit caps, and deduction rules compared across California, Texas, New York, and Florida.',
    category: 'deposit-state',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Start your deposit case',
    sections: [
      {
        body: 'Security deposit law varies dramatically by state. A 21-day deadline in California is not a 30-day deadline in Texas is not a 14-day deadline in New York. Here\u2019s a direct comparison of the four states where Resolvaio currently supports deposit recovery.',
      },
      {
        heading: 'Return Deadlines',
        body: '\u2022 New York: 14 days (strictest)\n\u2022 Florida: 15 days (no claim) / 30 days (with claim, by certified mail)\n\u2022 California: 21 days\n\u2022 Texas: 30 days (after written forwarding address received)\n\nTexas is the only state where the clock doesn\u2019t start until the tenant provides a written forwarding address. If you moved out of a Texas rental and haven\u2019t provided one, send it now.',
      },
      {
        heading: 'Penalty Provisions',
        body: '\u2022 California: Up to 2\u00D7 the deposit for bad faith (\u00A7 1950.5(l))\n\u2022 Texas: $100 + 3\u00D7 the wrongfully withheld amount + attorney\u2019s fees (\u00A7 92.109)\n\u2022 New York: Actual damages + punitive damages at court\u2019s discretion + attorney\u2019s fees\n\u2022 Florida: Forfeiture of claim right if 30-day certified mail notice missed; actual damages + court costs\n\nTexas has the strongest monetary penalty. Florida has the strongest procedural penalty (total forfeiture for missing the notice deadline).',
      },
      {
        heading: 'Deposit Caps',
        body: '\u2022 California: 1 month\u2019s rent (AB 12, effective July 2024)\n\u2022 New York: 1 month\u2019s rent (HSTPA 2019)\n\u2022 Texas: No cap\n\u2022 Florida: No specific cap (but reasonableness requirement)\n\nIf your Texas landlord charged 3 months\u2019 rent as a deposit, that\u2019s legal. The stakes in Texas deposit disputes are often higher because the deposit amounts can be larger.',
      },
      {
        heading: 'Itemization Requirements',
        body: 'All four states require an itemized statement of deductions:\n\n\u2022 California: Written itemization + copies of receipts/invoices\n\u2022 Texas: Written description + itemized list\n\u2022 New York: Itemized statement + copies of receipts showing actual costs\n\u2022 Florida: Written notice by certified mail with specific reasons and amounts\n\nA landlord who simply withholds the deposit without providing documentation has violated the statute in all four states.',
      },
      {
        heading: 'Small Claims Court Limits',
        body: '\u2022 Texas: $20,000 (Justice Court \u2014 highest of the four)\n\u2022 California: $12,500 (individuals) / $6,250 (businesses)\n\u2022 Florida: $10,000 (raised from $8,000 in 2024)\n\u2022 New York: $10,000 (NYC) / $5,000 (outside NYC)\n\nFiling fees range from $30\u2013$100 across all four states. None require a lawyer.',
      },
      {
        heading: 'Unique Features by State',
        body: '\u2022 California: Initial inspection requirement; AB 414 (2026) adds photo documentation\n\u2022 Texas: Forwarding address trigger; no deposit cap; $100 statutory penalty on top of 3\u00D7\n\u2022 New York: Shortest deadline (14 days); pet deposits banned; interest-bearing account required (6+ units)\n\u2022 Florida: Certified mail required for claim notice; total forfeiture if missed; two-tier timeline',
      },
    ],
  },

  /* ---- 11. Normal Wear and Tear Guide ---- */
  {
    slug: 'normal-wear-and-tear-rental',
    title: 'What Counts as "Normal Wear and Tear" in a Rental? A State-by-State Guide',
    description: 'Landlords deduct for painting, carpet, and cleaning \u2014 but the law distinguishes normal wear from actual damage. Here\u2019s where the line falls in CA, TX, NY, and FL.',
    category: 'deposit-general',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter',
    sections: [
      {
        body: 'The most common deposit dispute is a landlord charging for \u201cdamage\u201d that is actually normal wear and tear. Every state with a security deposit statute prohibits deductions for normal wear \u2014 but the definition varies and is often fought case by case.',
      },
      {
        heading: 'What Is Normal Wear and Tear',
        body: 'Normal wear and tear is the natural deterioration that occurs from ordinary, reasonable use of a rental unit over the tenancy. Courts generally recognize these as normal wear:\n\n\u2022 Faded or slightly scuffed paint from regular living\n\u2022 Minor nail holes from hanging pictures (small, typical number)\n\u2022 Carpet worn from regular foot traffic\n\u2022 Worn finishes on door handles and fixtures\n\u2022 Faded curtains or blinds from sunlight\n\u2022 Loose grouting around tiles\n\u2022 Dusty or slightly dirty blinds and windows',
      },
      {
        heading: 'What Is Damage Beyond Normal Wear',
        body: 'Damage results from negligence, misuse, or abuse:\n\n\u2022 Large holes in walls (beyond small nail holes)\n\u2022 Burns or stains on carpet from spills, cigarettes, or pets\n\u2022 Broken windows, doors, or fixtures\n\u2022 Pet scratches on hardwood, chewed trim\n\u2022 Mold from failure to ventilate\n\u2022 Unauthorized modifications (painting walls, removing fixtures)',
      },
      {
        heading: 'The Grey Areas',
        body: 'Most disputes happen in the middle:\n\n\u2022 Repainting: Normal if the tenant lived there 2+ years and paint faded. Damage if the tenant painted walls purple without permission.\n\u2022 Carpet replacement: Normal if worn from 3+ years of use. Damage if stained from pet urine or bleach.\n\u2022 Cleaning: Normal cleaning between tenants is the landlord\u2019s cost. Excessive filth (grease-covered kitchen, mold in bathroom) can be charged.\n\u2022 Appliance wear: A refrigerator seal that fails after 5 years is normal. A microwave door broken by slamming is damage.',
      },
      {
        heading: 'What the Statutes Say',
        body: '\u2022 California: Cal. Civ. Code \u00A7 1950.5(b)(2) explicitly lists permissible deductions. Normal wear is excluded. Landlords must provide receipts for all deductions.\n\u2022 Texas: Tex. Prop. Code \u00A7 92.104(a) states \u201cthe landlord may not retain any portion of a security deposit to cover normal wear and tear.\u201d\n\u2022 New York: N.Y. Gen. Oblig. Law \u00A7 7-108(1-a)(c) limits deductions to \u201cactual and reasonable cost\u201d beyond normal wear.\n\u2022 Florida: Fla. Stat. \u00A7 83.49 permits deductions for \u201cdamages to the premises\u201d \u2014 courts interpret this as excluding normal wear.',
      },
      {
        heading: 'How to Protect Yourself',
        body: 'Document the unit at move-in and move-out with timestamped photos and video. Photograph every room, appliance, floor, wall, and fixture. This evidence is the strongest tool in a dispute. A demand letter that cites the specific statute and references photo documentation is difficult for a landlord to dismiss.',
      },
    ],
  },

  /* ---- 12. Deposit Return Deadlines All States ---- */
  {
    slug: 'security-deposit-return-deadline-by-state',
    title: 'How Long Does a Landlord Have to Return Your Security Deposit? Every State\u2019s Deadline',
    description: 'Return deadlines range from 14 days (New York) to 60 days (some states). Here are the exact deadlines for CA, TX, NY, FL, and what happens when landlords miss them.',
    category: 'deposit-general',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Start your deposit case',
    sections: [
      {
        body: 'Every US state has a statute governing how long a landlord has to return a security deposit after the tenant moves out. The deadlines range from as short as 14 days (New York) to as long as 60 days in some states. Missing the deadline often triggers penalties, and in some states, forfeiture of the landlord\u2019s right to make any deductions.',
      },
      {
        heading: 'The Four Launch States',
        body: '\u2022 New York: 14 days \u2014 N.Y. Gen. Oblig. Law \u00A7 7-108(1-a)(e)\n\u2022 Florida: 15 days (no claim) or 30 days (with claim, by certified mail) \u2014 Fla. Stat. \u00A7 83.49(3)\n\u2022 California: 21 days \u2014 Cal. Civ. Code \u00A7 1950.5(e)\n\u2022 Texas: 30 days after written forwarding address is received \u2014 Tex. Prop. Code \u00A7 92.103(a)',
      },
      {
        heading: 'When the Clock Starts',
        body: 'This varies by state and catches many tenants off guard:\n\n\u2022 California, New York, Florida: The clock starts when the tenant vacates (moves out and returns keys).\n\u2022 Texas: The clock starts when the landlord receives the tenant\u2019s written forwarding address. If you haven\u2019t sent one, the landlord\u2019s deadline hasn\u2019t started yet.\n\nFor all states: \u201cvacating\u201d means the tenant has physically moved out AND surrendered the keys or other means of access.',
      },
      {
        heading: 'What Happens When They Miss It',
        body: '\u2022 California: Missing the 21-day deadline is commonly considered evidence of bad faith, potentially triggering the 2\u00D7 penalty under \u00A7 1950.5(l).\n\u2022 Texas: Missing the 30-day deadline exposes the landlord to the $100 + 3\u00D7 penalty under \u00A7 92.109(a).\n\u2022 New York: Missing the 14-day deadline may result in forfeiture of the right to claim any deductions.\n\u2022 Florida: Missing the 30-day certified mail deadline explicitly forfeits the landlord\u2019s right to impose any claim against the deposit under \u00A7 83.49(3)(c).',
      },
      {
        heading: 'What to Do Right Now',
        body: 'Calculate the number of days since you moved out. If the deadline has passed:\n\n1. Send a demand letter citing the specific statute and deadline.\n2. Send it by certified mail with return receipt requested.\n3. Give the landlord 14\u201330 days to respond.\n4. If no response, file in small claims court.\n\nThe demand letter itself is evidence in court that you attempted to resolve the dispute before filing.',
      },
    ],
  },

  /* ---- 13. What to Do If Landlord Ignores Demand Letter ---- */
  {
    slug: 'landlord-ignores-demand-letter',
    title: 'What to Do If Your Landlord Ignores Your Demand Letter',
    description: 'You sent the letter. They didn\u2019t respond. Here\u2019s the escalation path: small claims court, AG complaints, and what evidence to prepare.',
    category: 'deposit-general',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter and escalation packet',
    sections: [
      {
        body: 'A demand letter is the first step, not the last. If your landlord ignores it, you have clear escalation paths \u2014 and the ignored demand letter itself becomes evidence in your favor.',
      },
      {
        heading: 'Wait for Your Deadline to Pass',
        body: 'Most demand letters give the landlord 14\u201330 days to respond. Don\u2019t file in court before the deadline you set. Judges view premature filing unfavorably. Use the waiting period to organize your evidence.',
      },
      {
        heading: 'File in Small Claims Court',
        body: 'Small claims court is designed for exactly this situation. No lawyer needed. Filing fees are $30\u2013$100 depending on the state and amount. Limits:\n\n\u2022 California: $10,000\n\u2022 Texas: $20,000\n\u2022 New York: $10,000 (NYC) / $5,000 (outside NYC)\n\u2022 Florida: $10,000\n\nFile in the county where the rental property is located.',
      },
      {
        heading: 'What Evidence to Bring',
        body: '\u2022 Your lease agreement\n\u2022 Move-in and move-out photos (timestamped)\n\u2022 The demand letter you sent (copy)\n\u2022 Certified mail receipt and return receipt card\n\u2022 Any itemized statement the landlord provided\n\u2022 Proof of deposit payment (bank statement, cancelled check)\n\u2022 A timeline of events: move-out date, demand letter date, days elapsed, no response',
      },
      {
        heading: 'File an AG Complaint',
        body: 'Your state Attorney General\u2019s consumer protection division accepts complaints about landlords who violate deposit return statutes. This doesn\u2019t recover your money directly, but it creates a formal record and some AG offices contact the landlord. This is especially useful if the landlord has a pattern of withholding deposits.',
      },
      {
        heading: 'The Demand Letter Helps You in Court',
        body: 'Judges consistently view demand letters favorably. Sending a certified demand letter before filing shows:\n\n\u2022 You gave the landlord a chance to resolve the dispute\n\u2022 You know the specific statute that applies\n\u2022 You have documentation of your effort to resolve\n\u2022 The landlord chose to ignore a reasonable request\n\nThis pattern \u2014 statute-cited demand letter, ignored, then filed \u2014 is one of the strongest presentations a tenant can make in small claims court.',
      },
    ],
  },

  /* ---- 14. Deposit Itemization ---- */
  {
    slug: 'security-deposit-itemization-requirements',
    title: 'Security Deposit Itemization: What Your Landlord Is Required to Provide',
    description: 'When a landlord makes deductions, they must provide an itemized statement. Here\u2019s what each state requires, what counts as sufficient, and what to do when they don\u2019t provide one.',
    category: 'deposit-general',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter',
    sections: [
      {
        body: 'A landlord can\u2019t just keep your deposit and say \u201cdamages.\u201d Every state requires an itemized accounting of deductions. The specifics of what that itemization must include vary by state, but the core requirement is universal: the tenant has the right to know exactly what was deducted and why.',
      },
      {
        heading: 'California',
        body: 'Cal. Civ. Code \u00A7 1950.5(g) requires a written itemized statement that includes:\n\n\u2022 Each specific item deducted\n\u2022 The amount of each deduction\n\u2022 Copies of documents showing actual charges (receipts, invoices, or contractor estimates)\n\nIf repairs are not complete within the 21-day window, the landlord may provide a good-faith estimate and has 14 additional days to provide the final accounting with actual receipts. A vague statement like \u201ccleaning $500, repairs $300\u201d without receipts is insufficient.',
      },
      {
        heading: 'Texas',
        body: 'Tex. Prop. Code \u00A7 92.104(b) requires a \u201cwritten description and itemized list of all deductions.\u201d Texas does not explicitly require receipts (unlike California), but the description must be specific enough for the tenant to understand what was charged and why. \u201cGeneral repairs\u201d without detail would likely be considered insufficient.',
      },
      {
        heading: 'New York',
        body: 'N.Y. Gen. Oblig. Law \u00A7 7-108(1-a)(c) requires an itemized statement with \u201ccopies of receipts for the actual costs incurred.\u201d This is similar to California\u2019s standard. A landlord who deducts without providing actual receipt copies has not met the statutory requirement.',
      },
      {
        heading: 'Florida',
        body: 'Fla. Stat. \u00A7 83.49(3)(b) requires the landlord to send a claim notice by certified mail within 30 days that states:\n\n\u2022 The landlord\u2019s intention to impose a claim\n\u2022 The specific reasons for the claim\n\u2022 The amount of the claim\n\u2022 Required statutory language about the tenant\u2019s 15-day objection right\n\nThe certified mail requirement is strict. Regular mail does not satisfy the statute.',
      },
      {
        heading: 'What to Do If They Didn\u2019t Itemize',
        body: 'A landlord who withholds the deposit without providing a proper itemized statement has violated the statute in all four states. A demand letter citing the specific itemization requirement is often sufficient to get a response, because the landlord knows that going to court without proper documentation puts them at a significant disadvantage.',
      },
    ],
  },

  /* ---- 15. Painting Charges ---- */
  {
    slug: 'landlord-charge-painting-move-out',
    title: 'Can Your Landlord Charge You for Painting After You Move Out?',
    description: 'Repainting is one of the most disputed deductions. Here\u2019s when it\u2019s legitimate, when it\u2019s normal wear, and what the statute says in each state.',
    category: 'deposit-general',
    publishedAt: '2026-05-27',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter',
    sections: [
      {
        body: 'Repainting is the single most common deposit deduction \u2014 and one of the most frequently disputed. The general rule: if paint faded, scuffed, or wore from normal living over the lease term, repainting is normal wear and the landlord cannot charge for it. If the tenant painted the walls an unauthorized color or caused unusual damage, it\u2019s chargeable.',
      },
      {
        heading: 'The General Rule',
        body: 'Every state\u2019s deposit statute prohibits deductions for normal wear and tear. Paint that fades from sunlight, scuffs from regular furniture placement, or shows minor marks after years of occupancy is normal wear. A landlord who repaints between every tenant does so for their own benefit \u2014 that\u2019s a business cost, not a tenant charge.\n\nCourts commonly look at the length of tenancy. After 2\u20133 years, repainting is almost always considered a normal landlord expense.',
      },
      {
        heading: 'When Painting Charges Are Legitimate',
        body: '\u2022 The tenant painted walls without authorization (especially unusual colors)\n\u2022 Excessive smoke damage that discolors walls\n\u2022 Large areas of damage from adhesive, tape residue, or mounted items\n\u2022 Crayon, marker, or other staining that requires special treatment\n\nEven in these cases, the landlord can only charge for the actual cost of painting the damaged areas, not the entire unit.',
      },
      {
        heading: 'Useful Life and Depreciation',
        body: 'Some jurisdictions recognize that paint has a useful life (typically 3\u20135 years). If the paint was already 4 years old when you moved in, the landlord cannot charge the full cost of repainting \u2014 the paint was near the end of its useful life regardless of your tenancy. California courts have applied this depreciation concept, though it\u2019s not explicitly in the statute.',
      },
      {
        heading: 'What to Do',
        body: 'If your landlord deducted for repainting and you believe it was normal wear:\n\n1. Check your lease for any painting clause (some leases require the tenant to repaint, but these clauses may not be enforceable in all states)\n2. Calculate how long you lived there \u2014 longer tenancy strengthens the normal wear argument\n3. Reference your move-in and move-out photos showing the wall condition\n4. Send a demand letter citing the prohibition on normal wear deductions under your state\u2019s statute',
      },
    ],
  },

  /* ---- 16. Cancel Gym Membership ---- */
  {
    slug: 'how-to-cancel-gym-membership',
    title: 'How to Cancel a Gym Membership That Won\u2019t Let You Cancel',
    description: 'Gyms use certified letter requirements, in-person visits, and hidden contract terms to make cancellation difficult. Here\u2019s what federal and state law says about your cancellation options.',
    category: 'subscription',
    publishedAt: '2026-05-27',
    ctaHref: '/tools/cancel-subscription',
    ctaText: 'Generate your free cancellation emails',
    sections: [
      {
        body: 'Gym memberships are the most commonly complained-about subscription cancellation. The barriers are deliberate: certified letter requirements, in-person visits, 30-day notice periods, and aggressive retention calls. But federal and state consumer protection law addresses many of these barriers.',
      },
      {
        heading: 'The Federal Baseline: ROSCA',
        body: 'The Restore Online Shoppers\u2019 Confidence Act (ROSCA) and the FTC\u2019s Negative Option Rule (16 CFR Part 425) require sellers offering negative option features (recurring charges) to:\n\n\u2022 Clearly disclose the terms of the recurring charge before obtaining billing information\n\u2022 Obtain the consumer\u2019s express informed consent\n\u2022 Provide a simple mechanism to cancel\n\nIf you signed up for your gym membership online or through a digital process, the FTC rule generally requires a simple online cancellation path.',
      },
      {
        heading: 'State Health Club Laws',
        body: 'Several states have specific health club statutes:\n\n\u2022 California: Cal. Civ. Code \u00A7\u00A7 1812.80-1812.98 (Health Studio Services Contract Law) \u2014 requires written contracts, right to cancel within 5 business days, cancellation rights if facility closes or relocates\n\u2022 New York: N.Y. Gen. Bus. Law \u00A7\u00A7 620-627 \u2014 3-day cooling-off period, disability cancellation, facility closure refunds\n\u2022 Texas: Tex. Occ. Code \u00A7 702 (Health Spa Act) \u2014 3-day cancellation, relocation cancellation (if you move 25+ miles)\n\u2022 Florida: Fla. Stat. \u00A7\u00A7 501.012-501.019 \u2014 3-day cancellation, facility closure refunds\n\nThese state laws often provide stronger protections than the federal baseline.',
      },
      {
        heading: 'The Certified Letter Barrier',
        body: 'Some gyms (notably Planet Fitness) require cancellation by certified letter. If you signed up online or digitally, this requirement may conflict with the FTC Click-to-Cancel rule, which generally requires that cancellation be as easy as sign-up. A written email citing ROSCA and the FTC rule puts the gym on notice of this tension.',
      },
      {
        heading: 'What to Do',
        body: 'A 3-step email sequence is more effective than a single cancellation request:\n\n1. Day 0: Formal cancellation citing ROSCA and your state\u2019s health club law\n2. Day 7: Follow-up noting lack of response, naming the regulatory agency\n3. Day 14: Final notice with FTC and state AG complaint references\n\nThe escalation pattern increases the cost of ignoring you at each step.',
      },
    ],
  },

  /* ---- 17. ROSCA Explained ---- */
  {
    slug: 'ftc-rosca-negative-option-rule',
    title: 'The FTC\u2019s Negative Option Rule (ROSCA) \u2014 What Companies Must Do When You Want to Cancel',
    description: 'ROSCA and the FTC Negative Option Rule require companies to make cancellation simple. Here\u2019s what the rule says, who it applies to, and how to cite it in a cancellation request.',
    category: 'subscription',
    publishedAt: '2026-05-27',
    ctaHref: '/tools/cancel-subscription',
    ctaText: 'Generate your free cancellation emails',
    sections: [
      {
        body: 'The Restore Online Shoppers\u2019 Confidence Act (ROSCA, 15 U.S.C. \u00A7\u00A7 8401-8405) and the FTC\u2019s Negative Option Rule (16 CFR Part 425) are the primary federal laws governing subscription cancellation. If a company makes it easy to sign up but hard to cancel, these rules apply.',
      },
      {
        heading: 'What ROSCA Requires',
        body: 'ROSCA addresses \u201cnegative option\u201d marketing \u2014 any arrangement where silence or failure to act is treated as acceptance of an offer. Under ROSCA, sellers must:\n\n\u2022 Clearly and conspicuously disclose all material terms of the transaction before obtaining billing information\n\u2022 Obtain the consumer\u2019s express informed consent before charging\n\u2022 Provide a simple mechanism to stop recurring charges and cancel\n\nViolation of ROSCA is treated as an unfair or deceptive act under the FTC Act.',
      },
      {
        heading: 'The Click-to-Cancel Principle',
        body: 'The FTC has interpreted ROSCA to mean that cancellation must be at least as easy as sign-up. If you subscribed online with a few clicks, the company must generally provide an equally simple online cancellation path. Requiring a phone call, certified letter, or in-person visit when the subscription was initiated online may violate this principle.',
      },
      {
        heading: 'Who ROSCA Applies To',
        body: 'ROSCA applies to any person or entity that charges consumers through negative option features in online transactions. This includes:\n\n\u2022 Gym memberships sold online\n\u2022 SaaS and software subscriptions\n\u2022 Streaming services\n\u2022 Telecom services sold online\n\u2022 Mobile app subscriptions\n\u2022 Any subscription where you provided billing information online\n\nROSCA is federal law \u2014 it applies in all 50 states.',
      },
      {
        heading: 'How to Cite ROSCA in a Cancellation Email',
        body: 'An effective reference reads: \u201cUnder the Restore Online Shoppers\u2019 Confidence Act (ROSCA), 16 CFR Part 425, sellers offering negative option features are required to provide consumers with a simple mechanism to stop recurring charges. I am exercising that right and revoking authorization for future charges to my payment method.\u201d\n\nThis is factual, cites the specific rule, and states what the consumer is doing \u2014 without evaluating the case or predicting an outcome.',
      },
    ],
  },

  /* ---- 18. Cancel Subscription When Impossible ---- */
  {
    slug: 'cancel-subscription-company-makes-impossible',
    title: 'How to Cancel a Subscription When the Company Makes It Impossible',
    description: 'Hidden cancel buttons, required phone calls, retention loops \u2014 companies design friction to prevent cancellation. Here are the specific federal and state laws that protect you.',
    category: 'subscription',
    publishedAt: '2026-05-27',
    ctaHref: '/tools/cancel-subscription',
    ctaText: 'Generate your free cancellation emails',
    sections: [
      {
        body: 'You\u2019ve looked through every settings page. You\u2019ve searched the help center. You\u2019ve been transferred three times. The company doesn\u2019t want you to cancel, and they\u2019ve designed the process to make you give up. This is exactly what consumer protection law addresses.',
      },
      {
        heading: 'Common Obstruction Tactics',
        body: '\u2022 Cancel button buried 5 levels deep in account settings\n\u2022 \u201cContact support to cancel\u201d with no email option (phone only)\n\u2022 Hold queues that last 30+ minutes\n\u2022 Retention specialists trained to offer discounts and delay\n\u2022 \u201cProcessing your request\u201d with no confirmation\n\u2022 Cancellation that \u201cdidn\u2019t go through\u201d and you\u2019re charged again\n\nAll of these friction patterns are designed to exploit the fact that most people give up.',
      },
      {
        heading: 'Why Written Email Beats a Phone Call',
        body: 'A phone call leaves no paper trail. The company can claim the call never happened, that you agreed to stay, or that the cancellation \u201cdidn\u2019t process.\u201d\n\nA written email:\n\u2022 Creates a timestamped record\n\u2022 Cites the specific law that applies\n\u2022 States the specific account and effective date\n\u2022 Revokes payment authorization in writing\n\u2022 Sets a deadline for confirmation\n\nIf the company later claims they never received a cancellation request, you have the sent email as evidence.',
      },
      {
        heading: 'The Legal Basis',
        body: 'Federal: ROSCA (16 CFR Part 425) requires a simple cancellation mechanism. If sign-up was online, cancellation must be equally accessible.\n\nCalifornia: Bus. & Prof. Code \u00A7 17602 (ARL) requires that if you accepted auto-renewal terms online, you must be able to cancel online.\n\nNew York: GBL \u00A7 527-a requires clear auto-renewal disclosures and a simple cancellation mechanism.\n\nFair Credit Billing Act: If you\u2019re charged after cancellation, you can dispute the charge with your credit card issuer within 60 days.',
      },
      {
        heading: 'The Escalation Path',
        body: 'If the company ignores your cancellation email:\n\n1. Follow up at Day 7 naming the regulatory agency (FTC, state AG)\n2. Send a final notice at Day 14 with the specific FTC complaint URL (ftc.gov/complaint) and CFPB URL (consumerfinance.gov/complaint)\n3. Dispute post-cancellation charges with your credit card issuer under the FCBA\n4. File the FTC and/or state AG complaint\n\nMost companies respond at step 2 or 3. They would rather cancel your subscription than deal with a regulatory complaint.',
      },
    ],
  },

  /* ---- 19. Dispute Credit Card Charge ---- */
  {
    slug: 'dispute-credit-card-charge-subscription-cancelled',
    title: 'How to Dispute a Credit Card Charge for a Subscription You Cancelled',
    description: 'The Fair Credit Billing Act gives you chargeback rights for unauthorized charges. Here\u2019s how to file a dispute, what to include, and the 60-day deadline.',
    category: 'subscription',
    publishedAt: '2026-05-27',
    ctaHref: '/tools/cancel-subscription',
    ctaText: 'Generate your free cancellation emails',
    sections: [
      {
        body: 'If a company continues charging you after you requested cancellation, the Fair Credit Billing Act (FCBA) gives you the right to dispute those charges with your credit card issuer. This is one of the strongest tools available to consumers \u2014 and most people don\u2019t know it exists.',
      },
      {
        heading: 'What the FCBA Covers',
        body: 'The Fair Credit Billing Act (15 U.S.C. \u00A7 1666) protects consumers against:\n\n\u2022 Unauthorized charges (charges made without your consent)\n\u2022 Charges for goods or services not delivered as agreed\n\u2022 Billing errors\n\nA charge made after you requested cancellation is generally an unauthorized charge \u2014 you explicitly revoked authorization for future billing.',
      },
      {
        heading: 'The 60-Day Deadline',
        body: 'You must dispute the charge within 60 days of the billing statement on which the charge appears. If you wait longer, you may lose the right to dispute through your card issuer. Set a calendar reminder when you see a post-cancellation charge.',
      },
      {
        heading: 'How to File',
        body: 'Most card issuers allow online disputes:\n\n1. Log into your credit card account\n2. Find the charge in your transaction history\n3. Select \u201cDispute this charge\u201d or \u201cReport a billing error\u201d\n4. Select \u201cI cancelled this service but was still charged\u201d (or similar reason)\n5. Upload your cancellation email as evidence\n6. Submit\n\nThe card issuer will investigate and may issue a temporary credit while the dispute is resolved. Investigations typically take 30\u201390 days.',
      },
      {
        heading: 'What to Include as Evidence',
        body: '\u2022 A copy of your cancellation email (the one you sent to the company)\n\u2022 The date you sent it\n\u2022 Any response or lack of response from the company\n\u2022 The charge amount and date\n\u2022 A brief statement: \u201cI requested cancellation on [date]. The company charged me on [date], which is after my cancellation request. I did not authorize this charge.\u201d',
      },
      {
        heading: 'Why This Matters',
        body: 'Credit card disputes cost the company money. The card issuer charges the company a processing fee ($15\u201325) for every dispute, regardless of the outcome. Companies that receive too many chargebacks face higher processing rates or lose their merchant account entirely. This is why mentioning chargeback rights in your cancellation emails often accelerates the response.',
      },
    ],
  },

  /* ---- 20. 3-Step Cancellation Sequence Explained ---- */
  {
    slug: 'three-step-cancellation-email-sequence',
    title: 'The 3-Step Cancellation Email Sequence: Why One Email Is Never Enough',
    description: 'Companies count on you sending one polite email and giving up. A 3-step sequence with escalating citations changes the equation. Here\u2019s how and why it works.',
    category: 'subscription',
    publishedAt: '2026-05-27',
    ctaHref: '/tools/cancel-subscription',
    ctaText: 'Generate your free cancellation emails',
    sections: [
      {
        body: 'A single cancellation email is easy to ignore. There\u2019s no consequence. No escalation. No paper trail. Companies know this \u2014 it\u2019s why they route cancellation requests to support queues that take days to respond. A 3-step sequence with escalating legal citations changes the calculus.',
      },
      {
        heading: 'Why Three Emails',
        body: 'Each email serves a specific purpose:\n\n\u2022 Email 1 (Day 0): Establishes the formal request, cites the applicable law, revokes payment authorization, and sets a deadline.\n\u2022 Email 2 (Day 7): Documents the lack of response, names the specific regulatory agency, and mentions credit card dispute rights.\n\u2022 Email 3 (Day 14): Provides the actual FTC and CFPB complaint URLs and states intent to dispute all post-cancellation charges.\n\nThe cost to the company of ignoring you increases with each step.',
      },
      {
        heading: 'Email 1: The Foundation',
        body: 'The first email does the heavy lifting. It:\n\n\u2022 Addresses the company by name with your account identifier\n\u2022 States that you are requesting cancellation effective immediately\n\u2022 Cites ROSCA (16 CFR Part 425) and applicable state law\n\u2022 Explicitly revokes authorization for future charges\n\u2022 Requests written confirmation within 7 business days\n\nThis email creates the paper trail. Everything after builds on it.',
      },
      {
        heading: 'Email 2: The Escalation',
        body: 'If the company hasn\u2019t responded or confirmed cancellation after 7 days, the second email:\n\n\u2022 References your first email by date\n\u2022 Notes the lack of confirmation\n\u2022 Names the specific regulatory agency (FTC, state AG, FCC for telecom)\n\u2022 Mentions Fair Credit Billing Act chargeback rights\n\u2022 Sets another deadline\n\nMost companies respond at this stage. The combination of a documented first request plus a regulatory escalation notice triggers internal review.',
      },
      {
        heading: 'Email 3: The Final Notice',
        body: 'The third email is the last written request before action:\n\n\u2022 References both previous emails\n\u2022 States this is the final request\n\u2022 Provides the FTC complaint URL (ftc.gov/complaint)\n\u2022 Provides the CFPB complaint URL (consumerfinance.gov/complaint)\n\u2022 States intent to dispute all charges since Email 1 with the credit card issuer\n\nCompanies that ignored two emails rarely ignore the third. The combination of regulatory complaint + chargeback threat creates real financial risk for them.',
      },
      {
        heading: 'The Paper Trail Is the Point',
        body: 'Even if the company finally cancels after Email 1, you now have:\n\n\u2022 A documented cancellation request with date\n\u2022 Evidence of when you revoked payment authorization\n\u2022 A basis for disputing any charges made after that date\n\nIf they charged you after Email 1, you can file a credit card dispute with your cancellation email as evidence. Without that email, you have nothing.',
      },
    ],
  },

  /* ---- 21. DIY Demand Letter to Landlord ---- */
  {
    slug: 'diy-demand-letter-landlord-security-deposit',
    title: 'How to Write a DIY Demand Letter to Your Landlord',
    description: 'A step-by-step guide to writing a security deposit demand letter yourself: what to include, the statute to cite, how to send it, and the mistakes that get letters ignored.',
    category: 'deposit-general',
    publishedAt: '2026-08-28',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate a statute-cited demand letter',
    sections: [
      {
        body: 'A demand letter is the single most effective step you can take to get a wrongfully withheld security deposit back — and you can write one yourself. It is a formal, written request that puts your landlord on notice, cites the law they are violating, and creates a paper trail you can use in small claims court. This guide walks through exactly what to put in it, how to send it, and the mistakes that get DIY letters ignored.',
      },
      {
        heading: 'Why a Demand Letter Works',
        body: 'Most landlords who keep a deposit are betting you won’t push back. A vague email — “hey, can I get my deposit back?” — confirms that bet. A formal demand letter that cites the specific statute, the exact deadline they missed, and the penalty they now face changes the math: it signals you know what the law requires and are prepared to act.\n\nIt also does something a phone call can’t: it creates evidence. If the case ends up in small claims court, your demand letter proves you tried to resolve the dispute in good faith before filing — which judges look for.',
      },
      {
        heading: 'The Seven Things Every Demand Letter Needs',
        body: '1. Your details and the landlord’s. Full names, the rental address, and your current forwarding address (in Texas, this is legally required before the clock even starts).\n\n2. The move-out date. The statutory deadline counts from the day you vacated — state it clearly.\n\n3. The amount owed. The full deposit, minus any deductions you agree are legitimate.\n\n4. The statute. Cite the exact law: the return deadline and the penalty provision. This is what separates a letter that gets read from one that gets filed in the trash.\n\n5. A rebuttal of improper deductions. If they kept money for “cleaning” or “painting” that is really normal wear and tear, say so — and say why it isn’t deductible under your state’s law.\n\n6. A firm deadline. Give them a specific number of days (10–14 is standard) to return the money before you escalate.\n\n7. A clear statement of next steps. Name what happens if they don’t comply: a small claims filing for the deposit plus any statutory penalty.',
      },
      {
        heading: 'Cite the Right Statute for Your State',
        body: 'The citation is the part most DIY letters get wrong — they either skip it or cite the wrong thing. Each state’s security deposit law lives in a specific statute with a specific deadline and penalty:\n\n• California — Cal. Civ. Code § 1950.5: 21-day deadline, up to 2× the deposit for bad-faith retention.\n• Texas — Tex. Prop. Code §§ 92.103/92.109: 30 days after you give a written forwarding address; bad faith exposes the landlord to $100 plus 3× the wrongfully withheld amount plus attorney’s fees.\n• New York — Gen. Oblig. Law § 7-108: 14-day deadline; miss it and the landlord forfeits the right to keep any of the deposit.\n• Florida — Fla. Stat. § 83.49: written notice by certified mail within 30 days, or the landlord forfeits the claim entirely.\n\nIf your state is one of these, cite the section number and the penalty provision by name. A letter that says “under § 1950.5(l), a court may award up to twice the deposit for bad-faith retention” carries far more weight than one that doesn’t.',
      },
      {
        heading: 'How to Send It (This Part Matters)',
        body: 'Send the letter by certified mail with return receipt requested. This gives you dated proof that the landlord received it — which you will need if you file in court. Keep a copy of the letter and the mailing receipt.\n\nIn Florida, certified mail isn’t just good practice: the statute itself is built around a certified-mail notice requirement, and email alone may not satisfy it. When in doubt, use certified mail and keep everything.',
      },
      {
        heading: 'The Mistakes That Get DIY Letters Ignored',
        body: '• No statute cited. “Please return my deposit” reads as a request, not a demand. Cite the law.\n• An emotional tone. Anger is understandable, but a calm, factual letter is harder to dismiss and reads better in court.\n• No deadline. Without a firm date, there’s no pressure and no trigger for your next step.\n• Sent by regular mail or text. If you can’t prove they received it, it barely happened. Certified mail fixes this.\n• Wrong or vague amount. Be exact: the deposit figure, the deductions you dispute, and the total you’re demanding.\n• Threats you won’t follow through on. Don’t threaten “legal action” in the abstract — name the specific small claims court and the penalty statute.',
      },
      {
        heading: 'What Happens After You Send It',
        body: 'Many landlords pay once they receive a properly written demand letter — it’s cheaper than losing in court and owing a statutory penalty on top. If yours doesn’t respond by your deadline, the letter becomes Exhibit A when you file in small claims court. Filing limits and fees vary by state and county, but you don’t need a lawyer, and your documented demand letter is exactly the kind of evidence these courts want to see.',
      },
      {
        heading: 'Writing It Yourself vs. Generating One',
        body: 'You can absolutely write this letter by hand — everything above is what you need. The hard parts are getting the statute citation exactly right, rebutting each deduction in the correct legal terms, and making sure the penalty provision you cite actually applies to your situation.\n\nResolvaio does those parts for you: it asks about your specific situation, then generates a demand letter with the correct citations for your state, an itemized rebuttal of each deduction, and the penalty language — every citation validated against primary legal sources. It is a writing and research assistance tool, not a law firm, so you stay in control of what you send. Whether you write it yourself or generate it, the letter is the step that gets deposits back.',
      },
    ],
  },

  /* ---- 22. Illegal & Wrongful Deductions ---- */
  {
    slug: 'illegal-security-deposit-deductions',
    title: 'Illegal Security Deposit Deductions: What Landlords Can’t Charge',
    description: 'Landlords routinely deduct for things the law doesn’t allow. Here’s what counts as a wrongful deduction, how normal wear and tear is defined, and how to challenge charges you didn’t agree to.',
    category: 'deposit-general',
    publishedAt: '2026-08-28',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate a statute-cited demand letter',
    sections: [
      {
        body: 'Most security deposit disputes come down to a single question: was the deduction legal? Landlords keep money for “cleaning,” “painting,” and “wear” that the law often does not let them charge for. This guide explains the line between a legitimate deduction and a wrongful one — and what to do when your landlord crosses it.',
      },
      {
        heading: 'The Core Rule: Damage vs. Normal Wear and Tear',
        body: 'Across every state, the same principle governs deductions: a landlord can charge you for damage, but not for normal wear and tear. Damage is harm beyond what ordinary, careful use would cause — a cracked window, a pet-stained carpet, a hole punched in a wall. Normal wear and tear is the gradual, expected decline that happens simply from living somewhere: faded paint, minor carpet wear in walkways, small nail holes from hanging pictures.\n\nThe distinction matters because it decides who pays. Fixing damage is your responsibility; absorbing normal wear is the landlord’s cost of doing business.',
      },
      {
        heading: 'Deductions That Are Usually Illegal',
        body: 'These are the charges tenants most often see — and most often should not accept:\n\n• Repainting for normal fading or scuffs after a typical tenancy.\n• Replacing carpet worn only in high-traffic paths (as opposed to torn, burned, or stained carpet).\n• Routine cleaning to the same condition every tenant leaves — as opposed to cleaning up genuine filth.\n• “Wear” on fixtures and appliances that simply aged during your tenancy.\n• Charges with no itemization or no receipts, where the law requires them.\n• Deductions that exceed the actual cost of the repair.\n• Fees invented by the landlord that aren’t tied to real damage or unpaid rent.',
      },
      {
        heading: 'Deductions That Are Usually Legal',
        body: 'To be fair to the other side, these are the deductions the law generally does allow:\n\n• Unpaid rent or unpaid utilities you were responsible for.\n• Repair of actual damage beyond normal wear and tear.\n• Cleaning needed to return the unit to its move-in condition — not a higher standard.\n• Restoration or replacement specifically permitted by your lease.\n\nEven a legal deduction must usually be itemized and, in several states, backed by receipts.',
      },
      {
        heading: 'What the Law Requires by State',
        body: 'The documentation rules that make a deduction stand or fall vary:\n\n• California (Cal. Civ. Code § 1950.5) — deductions limited to four statutory categories; receipts required for anything over $125; before-and-after photos required since April 2025.\n• Texas (Tex. Prop. Code § 92.104) — itemized list of deductions required; no charge for normal wear and tear.\n• New York (Gen. Oblig. Law § 7-108) — itemized statement required; deductions limited to unpaid rent and damage beyond ordinary wear.\n• Florida (Fla. Stat. § 83.49) — the landlord must state the specific reasons for the claim in a certified-mail notice, and you have 15 days to object in writing.\n\nWhen a landlord skips the required itemization or receipts, the deduction is on shaky ground even before you argue the merits.',
      },
      {
        heading: 'How to Challenge a Wrongful Deduction',
        body: 'Start by requesting the itemized statement and receipts if you didn’t get them — in most states the landlord is required to provide them. Compare each line against the damage-vs-wear rule above. For anything that’s really normal wear, an unreceipted charge, or an invented fee, write a demand letter that objects to each improper deduction specifically and cites your state’s statute.\n\nGeneric complaints get ignored. A letter that says “the $400 repainting charge is a deduction for normal wear and tear, which is not permitted under [statute]” is much harder to brush aside — and it becomes your evidence if the dispute reaches small claims court.',
      },
      {
        heading: 'Document Everything Before You Move Out',
        body: 'The best defense against a wrongful deduction is proof of condition. Take dated, time-stamped photos and video of every room the day you move out, after cleaning. If your landlord later claims damage that was never there — or that existed at move-in — your own record is often the deciding evidence. In California, landlords now have their own photo obligation, but relying on the other side’s documentation is a mistake — keep your own record.',
      },
      {
        heading: 'When to Push Back',
        body: 'If your landlord has kept money for normal wear, failed to itemize, or can’t produce receipts the law requires, you have solid grounds to demand it back. Resolvaio generates a demand letter that rebuts each deduction in the correct legal terms and cites the statute and penalty for your state — every citation validated against primary legal sources. It is a writing and research assistance tool, not a law firm; you decide what to send.',
      },
    ],
  },

  /* ---- 23. Demand Letter vs. Lawyer ---- */
  {
    slug: 'demand-letter-vs-lawyer-security-deposit',
    title: 'Demand Letter vs. Hiring a Lawyer: What a Tenant Actually Needs',
    description: 'For a withheld security deposit, do you need a lawyer — or is a demand letter enough? A practical breakdown of cost, when each makes sense, and why small claims court doesn’t usually involve attorneys.',
    category: 'deposit-general',
    publishedAt: '2026-08-28',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate a statute-cited demand letter',
    sections: [
      {
        body: 'When a landlord keeps your deposit, the instinct is often to “get a lawyer.” For most security deposit disputes, that’s more firepower than the situation needs — and it can cost more than the deposit itself. Here’s an honest look at when a demand letter is enough, when a lawyer makes sense, and why the two aren’t really competing.',
      },
      {
        heading: 'The Math Problem With Hiring a Lawyer',
        body: 'Most withheld deposits are a few hundred to a couple thousand dollars. A lawyer’s hourly rate can equal or exceed that before they’ve done much at all. Unless your dispute is large or unusually complex, paying an attorney to recover a $1,200 deposit rarely pencils out — you could win and still come out behind.\n\nThat’s exactly why the system has a lower-cost path built in: small claims court, where you represent yourself.',
      },
      {
        heading: 'Small Claims Court Is Built for This',
        body: 'Security deposit disputes are one of the most common small claims cases in the country. The process is designed for people without lawyers: simplified forms, low filing fees, and a judge who’s used to hearing directly from tenants and landlords. In some states — California, for one — lawyers generally aren’t even allowed to represent parties in small claims court. So for the venue where most deposit cases are actually decided, “hire a lawyer” often isn’t an option anyway.',
      },
      {
        heading: 'What a Demand Letter Does',
        body: 'A well-written demand letter resolves a large share of disputes before court is ever needed. It puts the landlord on formal notice, cites the specific statute and penalty they’re facing, and sets a deadline. Many landlords pay at this stage because it’s cheaper than losing in court and owing a statutory penalty on top.\n\nAnd if it doesn’t work, the letter isn’t wasted — it becomes evidence that you tried to resolve things in good faith, which is exactly what a small claims judge wants to see.',
      },
      {
        heading: 'When You Actually Do Want a Lawyer',
        body: 'A demand letter isn’t always enough. Consider talking to an attorney when:\n\n• The amount at stake is large — beyond the small claims limit in your state.\n• The dispute is entangled with something bigger: an eviction, a habitability claim, a counterclaim, or a lawsuit already in progress.\n• The landlord has a lawyer and the matter has escalated past a simple deposit return.\n• You’re facing retaliation or a complex lease dispute, not just a withheld deposit.\n\nIn those situations, the stakes justify the cost — and a tool that only helps with the letter isn’t the right fit. Many areas also have free legal aid and tenant clinics for exactly these cases.',
      },
      {
        heading: 'The Practical Answer for Most Tenants',
        body: 'For a straightforward withheld deposit, the sequence that works is: a statute-cited demand letter first, and small claims court if that’s ignored — no lawyer required for either. The letter is the pressure; the court is the backstop.\n\nResolvaio handles the letter: it generates one with the correct citations, an itemized rebuttal of each deduction, and the penalty language for your state, validated against primary legal sources. It is a writing and research assistance tool, not a law firm — so if your case turns out to be one of the complex ones above, it will point you toward the right resources rather than pretend to replace an attorney.',
      },
    ],
  },

  /* ---- 24. California vs. Texas Tenant Rights ---- */
  {
    slug: 'california-vs-texas-tenant-rights-security-deposit',
    title: 'California vs. Texas Tenant Rights: Security Deposits Compared',
    description: 'How security deposit law differs between California and Texas — return deadlines, deposit caps, penalties, and the one Texas rule that trips up most tenants.',
    category: 'deposit-general',
    publishedAt: '2026-08-28',
    ctaHref: '/start?wedge=deposit',
    ctaText: 'Generate your demand letter',
    sections: [
      {
        body: 'California and Texas are two of the largest rental markets in the country, and their security deposit laws are strikingly different. If you’ve rented in one and moved to the other, the rules you relied on may no longer apply. Here’s how the two states compare on the things that actually decide a deposit dispute.',
      },
      {
        heading: 'Return Deadline',
        body: 'California gives landlords 21 calendar days after move-out to return the deposit or provide an itemized statement (Cal. Civ. Code § 1950.5). Texas gives 30 days — but with a crucial catch covered below (Tex. Prop. Code § 92.103).\n\nCalifornia’s clock starts automatically when you vacate. Texas’s clock does not start until you take a specific action.',
      },
      {
        heading: 'The Texas Forwarding-Address Rule (Most-Missed Difference)',
        body: 'This is the single biggest difference tenants overlook. In Texas, the landlord has no obligation to return the deposit until you provide a written forwarding address (Tex. Prop. Code § 92.107). No forwarding address, no deadline — the 30 days never start.\n\nCalifornia has no such precondition. This one rule explains why so many Texas tenants wait indefinitely and assume the landlord is stalling, when the clock simply never started. Always send your forwarding address in writing and keep proof.',
      },
      {
        heading: 'Deposit Caps',
        body: 'California limits most security deposits to one month’s rent as of AB 12 (2024). Texas has no statutory cap at all — a landlord can ask for whatever the market will bear. If you’re moving from California to Texas, a larger deposit request isn’t necessarily illegal there; if you’re moving the other way, the cap now protects you.',
      },
      {
        heading: 'Penalties for Wrongful Retention',
        body: 'Both states have real teeth, but they’re structured differently:\n\n• California — up to twice the deposit for bad-faith retention, on top of actual damages (§ 1950.5(l)).\n• Texas — $100, plus three times the portion of the deposit wrongfully withheld in bad faith, plus reasonable attorney’s fees (§ 92.109).\n\nTexas’s treble-damages structure can produce a larger award on a small deposit; California’s doubling is simpler and applies broadly to bad-faith retention.',
      },
      {
        heading: 'Where You File',
        body: 'California small claims court handles individual deposit disputes up to $12,500. In Texas, deposit cases go to the Justice of the Peace (small claims) courts, which handle disputes up to $20,000. Neither state requires a lawyer — and California generally doesn’t allow one in small claims court at all.',
      },
      {
        heading: 'Side-by-Side Summary',
        body: '• Return deadline: California 21 days · Texas 30 days (after written forwarding address)\n• Clock starts: California on move-out · Texas only after forwarding address\n• Deposit cap: California one month’s rent · Texas no cap\n• Bad-faith penalty: California up to 2× deposit · Texas $100 + 3× withheld + fees\n• Small claims limit: California $12,500 · Texas $20,000\n• Primary statute: California Cal. Civ. Code § 1950.5 · Texas Tex. Prop. Code § 92.103',
      },
      {
        heading: 'Getting Your Deposit Back in Either State',
        body: 'The winning move is the same in both: a demand letter that cites the correct statute and penalty for that state, sent with proof of delivery, followed by small claims court if it’s ignored. The citations differ, and in Texas the forwarding-address step comes first. Resolvaio generates a demand letter with the right citations for whichever state your rental is in — a writing and research assistance tool, not a law firm.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getAllSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}
