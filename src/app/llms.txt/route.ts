import { absoluteUrl, siteUrl } from '@/lib/seo/site';
import { SITE, STATIC_PAGES, VERTICALS, JURISDICTIONS } from '@/lib/seo/config';

/**
 * /llms.txt — one honest, machine-readable summary for AI assistants, generated
 * from seo/config so it can't drift from the site. ONE file (not per-page
 * Markdown mirrors, which would split ranking signal across duplicates). States
 * only verifiable facts — no client counts, no invented results — and discloses
 * that Resolvaio is an AI writing tool.
 */

export const dynamic = 'force-dynamic';

function line(title: string, path: string): string {
  return `- [${title}](${absoluteUrl(path)})`;
}

export function GET(): Response {
  const base = siteUrl();

  const body = `# ${SITE.name}

> ${SITE.tagline}

${SITE.aiDisclosure}

## What this is
${SITE.name} generates two kinds of documents, each grounded in the specific
statute that applies to the user's situation — not generic templates and not
AI-invented citations. Every statute cited is validated against primary legal
sources before a document is produced.

## Security deposit recovery (paid, US$49 per case)
A demand letter citing the state's deposit statute, plus an escalation packet
for small-claims court. Currently supported states:
${JURISDICTIONS.map((j) => `- ${j.name}: ${j.statuteCitation} — landlord must return the deposit within ${j.returnDeadlineDays} days.`).join('\n')}

## Subscription cancellation (free, all 50 states)
A 3-step email sequence citing the FTC ROSCA rule and the user's state law.
${VERTICALS.map((v) => line(v.title, v.path)).join('\n')}

## Key pages
${STATIC_PAGES.map((p) => line(p.title, p.path)).join('\n')}
${JURISDICTIONS.map((j) => line(j.page.title, j.page.path)).join('\n')}

## Honest limits
- ${SITE.name} is a writing and research tool, not a law firm, and does not give
  legal advice, evaluate a case, or predict outcomes.
- Deposit letters are supported only in the states listed above.
- Users review and edit every document before sending it.

Site: ${base}
Contact: ${SITE.supportEmail}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
