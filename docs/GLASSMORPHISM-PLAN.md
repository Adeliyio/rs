# Landing page → glassmorphism: a plan

**Short answer:** yes, this is very doable. The landing page is one self-contained
file (`src/app/page.tsx`, ~970 lines) with 11 clearly-structured sections and its
own inline color tokens — so a glass redesign touches nothing else in the app and
carries no functional risk.

Below is the plan. Read it, then tell me to proceed (or adjust the direction).

---

## The honest design read first

Glassmorphism (frosted, semi-transparent "panes" floating over a colorful,
blurred background) is a look that's **easy to get wrong** for a product like
this. The current landing page is deliberately sober — near-black `#111` on warm
off-white `#F7F7F5`, hairline borders, a scales-of-justice mark. That soberness is
doing a job: this is a legal/consumer-protection tool where the whole pitch is
"we cite the *real* law, not flashy nonsense." Full frosted-glass everything
would undercut that trust and read as generic.

So the plan is **restrained, editorial glassmorphism**, not the maximal Apple-
keynote version:

- Glass is used **where it earns depth** — the sticky nav, the hero's sample-
  letter card, the pricing cards, the trust stats, the final CTA — not on every
  paragraph.
- The frosted panes float over a **quiet, brand-appropriate ambient background**
  (a soft aurora of the existing ink + one accent), not a rainbow gradient.
- Type, spacing, and copy stay exactly as they are. This is a **surface**
  treatment, not a rewrite.

The result should feel like the current page gained physical depth and light —
not like it was reskinned into a different product.

---

## The glass system (design tokens)

A small, reusable token set drives the whole thing so it stays consistent and
theme-able, rather than ad-hoc blur on each element.

**Palette** — carries the existing neutral, adds depth + one restrained accent.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg-base` | `#EEEDEA` | `#0C0D10` | the ground the aurora paints on |
| `--aurora-1` | warm sand `#E7E1D6` | deep slate `#12151d` | ambient blob A |
| `--aurora-2` | soft indigo `#DDE0F2` | indigo `#1a2038` | ambient blob B (the accent) |
| `--glass-fill` | `rgba(255,255,255,0.55)` | `rgba(22,25,34,0.5)` | pane fill |
| `--glass-stroke` | `rgba(255,255,255,0.7)` | `rgba(255,255,255,0.08)` | 1px top-lit edge |
| `--glass-shadow` | `0 8px 32px rgba(17,17,17,0.08)` | `0 8px 32px rgba(0,0,0,0.4)` | soft lift |
| `--ink` / `--ink-soft` | `#111` / `#5F5F5F` | `#EDEEF2` / `#A7ADBF` | text (unchanged in light) |
| `--accent` | indigo `#4257D6` | `#8B9BFF` | the single bold color, used sparingly |

Accent is deliberately **one** color (a considered indigo), used only for the
primary CTA and a couple of focal accents — everything else stays neutral so the
glass reads as calm, not busy.

**The glass recipe** (one utility class, applied consistently):
```
background: var(--glass-fill);
backdrop-filter: blur(16px) saturate(1.4);
-webkit-backdrop-filter: blur(16px) saturate(1.4);
border: 1px solid var(--glass-stroke);
box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255,255,255,0.5);
border-radius: 20px;
```
The `inset 0 1px 0` top highlight is the detail that sells real glass (a lit top
edge) rather than a flat translucent box.

**The ambient background** (behind everything, `position: fixed`): two or three
large, very soft radial-gradient blobs in the aurora colors, slowly drifting
(`@keyframes`, ~30s, `prefers-reduced-motion` disables it). This is what the glass
refracts — without it, glass on flat color looks like nothing.

---

## What changes, section by section

1. **Ambient background layer** — new fixed `<div>` behind the page painting the
   aurora. This is the foundation; glass needs something behind it to blur.
2. **Sticky nav** — already has `backdrop-blur-md`; upgrade to the full glass
   recipe (stronger blur, lit edge, softer border). Small, high-impact.
3. **Hero** — the copy stays. The right-side scales-of-justice SVG gets set inside
   a **floating glass card** with a faint accent glow behind it; the two CTAs get
   a subtle glass-vs-solid contrast (primary = solid ink/accent, secondary = ghost).
4. **"The difference" before/after** — the two comparison panels become glass
   cards (the "before" muted, the "after" faintly accent-tinted).
5. **How it works** — step cards → glass tiles with the number badges lifted.
6. **Citation engine / sample letter** — the marquee credibility moment. The
   sample-letter card becomes the hero glass object (frosted, floating, a soft
   inner glow), so the thing that proves the product looks the most premium.
7. **Trust stats** — stat tiles → small glass chips in a row.
8. **Pricing** — the three plan cards → glass cards; the recommended plan gets an
   accent-tinted fill + a slightly stronger lift so it reads as the pick.
9. **FAQ** — kept simple; at most a single glass container around the accordion.
10. **Final CTA** — a single wide glass panel over the brightest part of the
    aurora, primary CTA solid.
11. **Footer** — stays flat/quiet (glass everywhere is a mistake; the footer
    grounds the page).

---

## Craft guardrails (so it doesn't look AI-generated or cheap)

- **Contrast is checked on glass.** Translucent panes can wreck text contrast;
  every text-over-glass pairing gets a fill opacity high enough to stay ≥ 4.5:1.
  If a section can't hold contrast, it stays more opaque there.
- **Performance:** `backdrop-filter` is GPU-cheap in moderation but expensive if
  stacked deeply. I cap it to ~6–8 glass surfaces, and the animated aurora uses
  `transform` only (compositor-friendly), gated by `prefers-reduced-motion`.
- **A Safari/`backdrop-filter` fallback:** where `backdrop-filter` is unsupported,
  the panes fall back to a solid-ish `--glass-fill` so the layout never breaks.
- **Both themes designed, not inverted** — the dark palette above is authored, and
  the page already renders in the marketing (light) context; dark tokens are ready
  if you later add a theme toggle.
- **Accessibility:** focus rings stay visible on glass; the aurora is
  `aria-hidden`.

---

## Scope, risk, and how I'd verify

- **Files touched:** `src/app/page.tsx` (the classes) + a small block of glass
  utilities/keyframes in `src/app/globals.css`. **Nothing functional** — no
  routes, data, or auth. Fully reversible (one commit).
- **Risk:** cosmetic only. Worst case is "we don't like the look," which is a
  revert, not a bug.
- **Verify:** build the page, screenshot it at desktop + mobile widths in the
  browser, check text contrast on the glass panels, and confirm reduced-motion
  disables the aurora. I'll show you screenshots before considering it done.

---

## One decision for you

How far to push the glass:

- **A — Restrained (my recommendation):** the plan above. Glass on ~6 focal
  surfaces + a quiet aurora. Premium but still clearly a serious legal tool.
- **B — Fuller:** glass on most sections + a more colorful, animated aurora.
  More striking, more "designed," slightly less sober.
- **C — Minimal:** glass only on the nav + hero card + pricing. The lightest
  touch; closest to today.

Tell me A / B / C (or your own mix) and I'll build it.
