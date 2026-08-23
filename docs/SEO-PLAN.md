# Resolvaio SEO — held against the Yardstick

Applying the Synqall/Nikola SEO Yardstick to Resolvaio. This is an **audit +
implementation plan**, ordered by the ship-gate checklist. Every item below is
either ✅ present, ⚠️ present-but-broken, or ❌ missing — assessed against the
actual codebase, not generically.

> The one rule under everything: **earn the ranking, never fake it.** Resolvaio
> has a real advantage here — its whole pitch is "we cite the *actual verified
> statute*." Honest schema and problem-aware content aren't a constraint for this
> app; they're the product. That's the SEO to lean into.

---

## Current state — audit against the checklist

### Technical
| Item | Status | Reality |
|---|---|---|
| One canonical per page from a single resolver | ⚠️ **broken** | Canonicals exist, but the domain `https://resolvaio.com` is **hardcoded in 24 files** (sitemap, robots, layout `metadataBase`, landing schema, every legal + blog + marketing page). No `siteUrl()` resolver. Production cutover = a 24-file hunt; a wrong env can't degrade safely. |
| Sitemap lists indexable pages, excludes private | ⚠️ | `sitemap.ts` exists and correctly omits `/app`, `/case`, `/admin`, auth. But it's **hand-maintained** (deposit states typed by hand) — it will drift from the real pages. `lastmod` is `new Date()` at request time, not build time. |
| robots.txt points to sitemap; names AI + search crawlers | ⚠️ | `robots.ts` exists. Need to verify it names GPTBot/ClaudeBot/PerplexityBot/CCBot etc. explicitly, not just `*`. |
| Hidden pages: noindex meta + X-Robots-Tag + robots disallow (all three) | ⚠️ | The app subdomain (`app.resolvaio.com`) holds all private pages and the middleware gates them, but there's **no `X-Robots-Tag: noindex` header** on `/app`, `/case`, `/admin`, `/settings`. Belt only, no braces. |
| HTTPS, HSTS, baseline CSP at the edge | ✅ | All present in `next.config.mjs` (HSTS 2yr, CSP, the full header set). Done in the security pass. |

### On-page & content
| Item | Status | Reality |
|---|---|---|
| One intent per URL; no two pages compete | ⚠️ | Mostly clean (`/deposit/california` vs `/deposit`), but no explicit priority nesting enforced, and there's no guard against a future overlap. |
| Title = competitive phrase; H1 = outcome; brand once | ❌ **broken** | The state pages set `title: 'California Security Deposit Recovery | Resolvaio'` — the layout template **also** appends `| Resolvaio`, producing **double-branding** (`… | Resolvaio | Resolvaio`), and the title leads with the category, not the phrase people type (`how to get security deposit back in california`). This is a live bug the Yardstick's CI test would catch. |
| Meta description ≤165 chars, real reason to click | ⚠️ | Descriptions exist; not length-guarded, some run long. |
| ≥1 problem-aware guide that wins the question | ✅ (partial) | A blog exists. Whether the articles target real "how do I get my deposit back in X" queries needs a content pass, but the surface is there. |

### Structured & programmatic
| Item | Status | Reality |
|---|---|---|
| Org + WebSite + Service + Breadcrumb schema from config, zero invented facts | ⚠️ | Organization + FAQ JSON-LD exist on the landing page (hand-written, hardcoded domain). **No Breadcrumb schema** anywhere — and breadcrumbs are the one schema type still earning a SERP feature, especially valuable across the deposit hierarchy. No `Service` schema. |
| No deprecated schema | ⚠️ | The landing page emits **`FAQPage`** — Google **retired FAQ rich results for all sites in 2026**. Keep it only if honest; don't expect a feature. No `HowTo` (good). |
| Programmatic pages: unique title/desc/local value, gated | ❌ **untapped** | Only 4 hand-built state pages. The real opportunity — **deposit jurisdiction × county** (e.g. `/deposit/california/los-angeles-county`) — isn't built. This is Resolvaio's biggest winnable, under-served surface (local "small claims" + deposit terms that keyword tools under-report). |
| A single truthful `/llms.txt` | ❌ **missing** | No `/llms.txt`. AI assistants (a growing slice of "how do I get my deposit back" discovery) have no honest summary to read. |

### The foundation
| Item | Status |
|---|---|
| Everything generated from one validated config | ❌ — the whole point, and it's absent. Titles/descs/sitemap/robots/schema each hardcode their own copy of the domain and facts. |
| Key rules asserted in CI (title length, no double-brand, unique titles) | ❌ — no SEO tests. The double-branding bug proves the ratchet is missing. |
| App refuses to boot on invalid SEO config | ❌ |

---

## The plan — in ship-gate order

Ordered so the **foundation lands first** (everything else derives from it), then
the high-leverage wins.

### Phase 1 — The source of truth (unlocks everything, fixes 24-file drift)
1. **`src/lib/seo/site.ts` — the `siteUrl()` resolver.** One helper: reads
   `NEXT_PUBLIC_SITE_URL` (or `APP_URL`), strips trailing slash, and a blank env
   **degrades to `https://resolvaio.com` with a console warning** rather than
   shipping a staging URL. Every absolute link, canonical, OG tag, sitemap entry,
   robots sitemap ref, and JSON-LD `@id` derives from it. Replace the 24
   hardcoded occurrences.
2. **`src/lib/seo/config.ts` — the validated SEO data layer (zod).** One place
   that owns: the site name, the deposit jurisdictions (CA/TX/NY/FL) and their
   real statute + small-claims facts (sourced from the existing KB, not
   re-typed), the subscription verticals, the tools, and the per-page
   title/description/priority. The app already `zod`-validates env and refuses to
   boot; SEO config joins that gate.
3. **`src/lib/seo/metadata.ts` — a `buildMetadata()` helper** every page's
   `generateMetadata` calls. It enforces: title carries the competitive phrase
   and **never the brand** (the layout template appends it once), description
   ≤165 chars (truncate-with-warning), canonical from `siteUrl()`, OG/Twitter
   filled. This is where the double-branding bug dies.

### Phase 2 — Fix the live bugs
4. **Kill the double-branding.** Remove `| Resolvaio` from every page-level title
   (the `layout.tsx` template `%s | Resolvaio` adds it). Rewrite the state titles
   to lead with the searched phrase — e.g. `Get your security deposit back in
   California` (title) / `California requires your deposit back in 21 days —
   here's how` (H1).
5. **Sitemap + robots derive from `seo/config.ts`.** Auto-generated, per-type
   priority (vertical 0.9, county 0.7 — county nested below its parent so it
   can't shadow the state term), `lastmod` = build time. robots.txt names the 13
   crawler tokens explicitly + points to the sitemap.
6. **Belt-and-braces on private pages.** Add `X-Robots-Tag: noindex` via the
   middleware/edge for `/app`, `/case`, `/admin`, `/settings` (they already carry
   the app subdomain + aren't in the sitemap; add the header + a meta tag).

### Phase 3 — Structured data (honest, from config)
7. **Breadcrumb JSON-LD** on the deposit hierarchy (Home › Deposit › California ›
   LA County) — the one schema still earning a SERP feature. **`Service`** +
   **`Organization`** + **`WebSite`** schema, all built from `seo/config.ts` so
   they can't contradict the page. `price: "0"` on the free subscription offer
   because it genuinely is. `areaServed` only on a state/county page, never
   guessed nationally.
8. **Decide on FAQ markup.** Google retired FAQ rich results in 2026. Keep the
   `FAQPage` markup only if the FAQ is honest (it is) — but drop any expectation
   of a SERP feature, and don't spend effort expanding it.

### Phase 4 — Programmatic pages (the biggest winnable surface)
9. **Deposit jurisdiction × county pages**, generated from `seo/config.ts` with
   **real per-county facts** (small-claims court name, filing limit, the state's
   deposit deadline). Each page carries a unique title (`security deposit small
   claims los angeles county`), description, and local content + Breadcrumb +
   `areaServed` schema. **The Yardstick gate applies verbatim:** warn at 30
   location pages, hard-stop at 50 without justified unique content. Start with
   the biggest counties in the 4 live states (LA, SF, San Diego, Sacramento;
   Harris, Dallas, Travis, Bexar; the NYC boroughs; Miami-Dade, Broward…) —
   roughly 16–24 pages, each genuinely distinct, well under the cap.
   - **The honesty test, applied:** each page must answer a question a real
     person in that county types. If it's the state page with the county swapped
     in, it's a doorway page — so each carries that county's actual court,
     address, filing fee, and procedure.

### Phase 5 — GEO + the ratchet
10. **`/llms.txt`** generated from `seo/config.ts` — one file, honest summary of
    what Resolvaio is (a writing-assistance tool, not a law firm — disclosed),
    what it does, links to the real money + guide pages. Zero invented numbers.
11. **CI tests as the ratchet** (`src/lib/seo/__tests__`): assert every page
    title (a) never contains "Resolvaio", (b) is unique across pages, (c) ≤60
    chars; every description ≤165; the county-page count respects the 30/50 gate;
    `siteUrl()` never emits a trailing slash. The standard survives whoever
    touches it next.

---

## Resolvaio-specific notes

- **The natural programmatic grid is `jurisdiction × topic`, not `industry ×
  location`** — deposit-by-state-by-county for the paid wedge, and
  subscription-cancellation-by-vertical (already partly built: `/cancel/gym` etc.)
  for the free wedge. Both derive from the same KB config.
- **Only build county pages for the 4 states you actually serve.** `areaServed`
  must be true — a county page for a state Resolvaio can't generate a letter for
  would be a lie the Yardstick forbids (and a bad user experience: they'd hit the
  unsupported-jurisdiction wall).
- **The AI-disclosure requirement is a fit, not a burden.** `/llms.txt` and the
  schema both get a line disclosing this is an AI writing tool — which the app is
  already legally required to say, so honesty here costs nothing.

---

## Decisions for you

1. **Scope of this pass** — do the whole plan, or foundation-first (Phases 1–3:
   the resolver, bug fixes, schema) and treat the programmatic county grid (Phase
   4) as a follow-up once you confirm the per-county facts you want to publish?
2. **County data source** — the per-county small-claims facts (court name, filing
   limit, address) need to come from somewhere verifiable. Do you have this data,
   or should I derive a first cut from the state KB + official court sites (to be
   fact-checked before publish)? Honesty gate: we don't publish a county page
   until its facts are verified.
3. **Site URL env** — confirm the production domain is `resolvaio.com` (marketing)
   with `app.resolvaio.com` (app), so the resolver + noindex split are right.
