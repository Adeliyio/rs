# Resolvaio — User Journeys

_Documented from the codebase after the Supabase → self-hosted Convex migration
(branch `migrate/convex`). Every journey below is traced to real files; API
routes are named as the frontend calls them. **Abnormalities** are flagged
inline with ⚠️ and collected at the end._

Resolvaio is a self-help legal-writing tool with two "wedges":

- **Deposit** — recover a security deposit. Paid, single-case. Supported in **CA, TX, NY, FL** only.
- **Subscription** — cancel an unwanted subscription. Free, all 50 states + DC.

It is deliberately **not a dashboard**. The app always shows the user their one
current next action for the active case (`src/app/(app)/layout.tsx`).

---

## The case status state machine

Every case moves through this machine (`convex/caseStatus.ts`):

```
intake ─▶ generated ─▶ sent ─▶ awaiting ─▶ escalation_drafted ─▶ resolved ─▶ closed
   │           │          │         │                │                │
   └───────────┴──────────┴─────────┴────────────────┴────────────────┴──▶ closed (always allowed)
```

| From | Allowed to | Trigger |
|------|-----------|---------|
| `intake` | `generated`, `closed` | Generation completes (internal) / refusal |
| `generated` | `sent`, `closed` | User clicks "Mark as Sent" |
| `sent` | `awaiting`, `closed` | User reports "no response yet" |
| `awaiting` | `escalation_drafted`, `resolved`, `closed` | User escalates or reports outcome |
| `escalation_drafted` | `resolved`, `closed` | User marks filed / resolved |
| `resolved` | `closed` | — |
| `closed` | (terminal) | — |

- User-initiated transitions go through `POST /api/cases/[id]/status` →
  `caseStatus.transitionMine` (owner-gated, **validates** the transition atomically
  with a history row).
- `intake → generated` is set **internally** by the generation flow
  (`caseStatus.setStatusInternal`), which is **not** state-machine-guarded.
- **Side effects** fire only from the `/status` route: `sent` schedules T+14/30/60
  outcome-follow-up emails; `resolved`/`closed` cancel them.

---

## Journey 1 — Discovery → starting a case

**Marketing → app.** The landing page (`src/app/page.tsx`) and SEO pages
(`/deposit/*`, `/subscription/*`, `/cancel/*`, `/tools/*`, `/blog`) drive to a
"start" CTA.

- Subscription funnels → `/new` (requires auth; the `(app)` layout redirects to
  `/login` if signed out).
- Deposit funnels → `/register`.

Both eventually reach **`/new`**, which renders the wedge chooser
(`src/components/dashboard/empty-state.tsx`):

1. **Security Deposit** tile → state picker modal (CA/TX/NY/FL only). Includes a
   "My state isn't listed" path → unsupported-jurisdiction screen (Journey 6).
2. **Cancel a Subscription** tile → 50-state + DC picker.

On selection → `POST /api/cases` (`cases.create`). The mutation enforces the
former `uq_active_case` rule: at most one active case per (user, wedge,
jurisdiction). If a duplicate active case exists, the API returns
`DUPLICATE_ACTIVE_CASE` + `existing_case_id` and the UI redirects to it.
On success → redirect to `/case/{id}`.

> ⚠️ **A1 — Marketing pre-selection is dead.** Every marketing CTA passes
> `?wedge=deposit`, `?wedge=subscription`, or `?plan=unlimited`, but `/new` /
> `EmptyState` never read `searchParams`. Users always land on the generic
> two-tile chooser and must re-pick the wedge.
>
> ⚠️ **A2 — Inconsistent entry.** Subscription CTAs go to `/new`, deposit CTAs go
> to `/register`. Different first-screen UX for the two wedges.

---

## Journey 2 — Authentication (Convex Auth, OTP-based)

Logic hub: `src/lib/convex/use-auth.ts` (client hook over `@convex-dev/auth`).

**Register** (`(auth)/register/page.tsx`) — two steps, in-page:
1. Name + email + password + confirm. On submit → `signIn('password', flow:'signUp')`,
   which emails an **8-digit OTP code** and swaps the form to a code-entry step.
2. Enter the code → `flow:'email-verification'` → redirect to `/new`.

**Login** (`(auth)/login/page.tsx`): email + password → `flow:'signIn'` → `/new`.
Rate-limited by IP server-side.

**Forgot password** (`(auth)/forgot-password/page.tsx`) — two steps:
1. Email → `flow:'reset'` emails an 8-digit code (neutral "if an account exists"
   message, no enumeration).
2. Code + new password → `flow:'reset-verification'` → `/login` with a success banner.

**Logout**: the sidebar calls `auth.logout()` → `signOut()` → `/`.

> ⚠️ **A3 — Verify/reset are OTP CODES, not links** (migration change from
> Supabase's magic links). `update-password` now just redirects to
> `/forgot-password`; `/auth/callback` and `/auth/confirm` are reduced to
> graceful redirects (Google OAuth is handled by Convex Auth's own HTTP routes).
>
> ⚠️ **A4 — Google OAuth not wired in the UI.** `auth.google()` exists in the hook
> but no Google button is rendered on the login/register pages.
>
> ⚠️ **A5 — Register validation mismatch.** Inputs advertise `minLength=6`, but the
> code enforces ≥8 chars + one uppercase + one number.

---

## Journey 3 — Deposit case (the paid flow)

### 3.1 Intake diagnostic
`/case/{id}` at status `intake` renders `IntakeClient → DiagnosticShell`
(`src/features/diagnostic/`). The diagnostic is a **graph** of typed question
nodes (select, boolean, date, currency, text, address, deduction_table, group,
info, file_upload, computed, **preview**, **payment**, summary). State
auto-saves debounced (500ms) via `PUT /api/diagnostic/state`; loads via
`GET /api/diagnostic/state?caseId=`. PII in answers is encrypted at the app layer.

Evidence upload happens in a **file_upload node** → `POST /api/documents/upload`
(→ Cloudflare R2, tenant-isolated key `{userId}/{caseId}/{file}`).

### 3.2 Preview → payment (inside the diagnostic)
- **Preview node** → `GET /api/cases/[id]/preview` shows a credibility teaser
  (statute count, deadlines, penalty availability, one sample citation) — the
  conversion driver. No payment required to see it.
- **Payment node** → disclaimer acknowledgment → **Paddle overlay checkout**.
  On success → `POST /api/cases/[id]/checkout` links the Paddle transaction to
  the case (does **not** mark paid). Payment is confirmed **asynchronously** by
  the Paddle webhook.

### 3.3 Completion → generation
`IntakeClient.onComplete` (deposit): **polls** `GET /api/cases/[id]/payment-status`
every 2s up to 60s for `paid` (webhook lag), then `POST /api/cases/[id]/generate`.

The generate route (`api/cases/[id]/generate/route.ts`):
1. Requires status `intake`, diagnostic complete.
2. **Refusal check** (`checkRefusal`) — a `hard_block` returns 422.
3. **Payment gate** — deposit requires `payment_status === 'paid'`, else 402.
4. **Jurisdiction gate** — unsupported state → attempts auto-refund → 422.
5. **Circuit breaker** — if the generation queue depth ≥ **50**, the job is
   enqueued (BullMQ) and the user is told to check email; otherwise it generates
   synchronously.
6. Deposit generation → writes the letter, an audit row, sets status `generated`,
   schedules statutory **deadlines**, and enqueues a "letter ready" email.

### 3.4 Letter view (status `generated`)
`LetterView` → `GET /api/cases/[id]/letter`. Shows the letter, an optional
rebuttal table, **Download PDF** (`POST /api/cases/[id]/pdf` → renders + uploads
to R2 → signed URL), a certified-mail "how to send" guide, and a subscription
upsell. **"I Sent It — Mark as Sent"** → `POST /status {sent}` → schedules the
outcome follow-up emails.

### 3.5 Awaiting → escalation
At `awaiting`, if the statutory deadline has expired, `CasePageClient` shows an
escalation prompt → `EscalationFlow`: pick venue (**small claims** or **state
AG**) → county (for small claims) → `POST /api/cases/[id]/packet` builds a filing
packet ZIP (bundles the demand letter PDF) → download → **"I've Filed"** →
`POST /status {escalation_drafted}`.

### 3.6 Outcome capture
`OutcomePrompt` (shown at `sent`/`awaiting`) is time-phased from the sent date:
<14d nothing, 14–30d "got a response?", 30–60d "anything changed?", >60d "how
did it resolve?". Reporting a response opens the **adversarial-counsel flow**
(Journey 5). Reporting resolution opens `TestimonialConsent` → `POST
/api/cases/[id]/outcome` (upsert) and → `POST /status {resolved}`.

---

## Journey 4 — Subscription case (the free flow)

Same intake diagnostic, but **no preview/payment nodes** — it's free.

`IntakeClient.onComplete` (subscription): directly `POST /api/cases/[id]/generate`.
Generation produces a **3-step email sequence** (`sequence_v1`), personalizing
`[YOUR NAME]/[YOUR EMAIL]/[DATE]` placeholders, and sets status `generated`.

At `generated`, `DeliveryScreen → SequenceView` shows the three emails —
**Email 1: Cancellation Request → Email 2: Follow-Up → Email 3: Final Notice** —
one active at a time. The user **copies and sends each email themselves** (the
app does not send on their behalf), then clicks **"Mark Sent"** →
`POST /api/sequences/[id]/advance {step_number}`, which stamps the sent date,
advances the step, and transitions the case (`sent` after step 1, `awaiting`
after step 3). This view is **reactive** (Convex `useQuery`) — it updates live
without a page reload.

Outcome capture is the same as the deposit flow (Journey 3.6).

---

## Journey 5 — Safety / compliance gates (UPL protection)

- **Refusal during generation** — `checkRefusal` runs before generation; a
  `hard_block` (e.g. deposit amount above a threshold, disqualifying answers)
  returns 422 with a `decline_reason`. The client then calls
  `POST /api/cases/[id]/refusal` → `caseStatus.setRefusalMine` → case forced to
  `closed` with the trigger recorded.
- **Adversarial-counsel flow** — the single highest-UPL-risk moment. Triggered
  from "Report Response" after sending. A 3-step yes/no gate: if the other side
  has a **lawyer** or has **threatened to sue**, it fires
  `POST /api/cases/[id]/refusal` (trigger `adversarial_counsel`) and shows a
  compassionate **DeclineScreen** pointing the user to real legal resources.

> ⚠️ **A6 — Refusal is a two-step close.** Generation returns 422 but the case
> stays `intake` until the client separately calls `/refusal`. If the client
> never does, a hard-blocked case is never actually closed server-side.
>
> ⚠️ **A7 — `DeclineScreen` isn't reachable during intake.** It's only rendered by
> the post-send adversarial flow. A refusal rule firing mid-diagnostic has no
> rendered decline path there; it surfaces only via the generate 422 or the
> `closed`-status note on the case page.
>
> ⚠️ **A8 — Refusal condition evaluation is fail-open.** Unparseable rule
> conditions or missing answer fields return `false` (never block).
>
> ⚠️ **A9 — `ExtractionConfirmation` is orphaned.** The document parse→confirm loop
> (`/api/documents/[id]/parse` GPT-4o Vision, `/confirm`, and the
> `ExtractionConfirmation` UI) exists and works server-side, but the confirmation
> component is imported nowhere — the extract→review→confirm journey isn't mounted
> in the current diagnostic UI, and confirmed fields aren't fed back into
> `diagnostic_state.answers`.

---

## Journey 6 — Unsupported jurisdiction (deposit only)

From the deposit state picker, "My state isn't listed" →
`UnsupportedJurisdictionScreen`: explains limited coverage, offers a **generic
demand-letter template** download, shows state resources (statute, small claims,
legal aid, AG), and captures a **waitlist** entry → `POST /api/waitlist` (public,
rate-limited by IP; dedups on email+state+wedge).

---

## Journey 7 — Multi-case navigation

The always-visible **sidebar** (`src/components/dashboard/sidebar.tsx`) lists the
user's cases split into **Active** and **Past**, each linking to `/case/{id}`
with a status badge. "New Case" and "Home" both go to `/new`. Settings →
`/settings`. The logout button calls the Convex Auth `signOut`.

---

## Journey 8 — Account management (settings)

- **Export my data** → `GET /api/account/export` (`account.exportMine`) returns
  all the user's data as JSON, decrypting PII for the export.
- **Delete my account** → `POST /api/account/delete`: an **atomic** Convex cascade
  (`account.deleteMyAccountCascade`) removes all cases + children + subscriptions,
  returns the R2 object keys, then the route deletes those from R2 and deletes the
  auth user.
- **Subscription** → `GET /api/account/subscription` (`subscriptions.currentMine`).

> ⚠️ **A10 — Account deletion no longer re-verifies the password** (migration
> change). Supabase's `signInWithPassword` re-auth is gone; Convex Auth has no
> synchronous server-side password check. Deletion is now gated by the
> confirmation phrase ("DELETE MY ACCOUNT") + an active session only.

---

## Background jobs (BullMQ + Redis)

| Job | Cadence | What it does |
|-----|---------|-------------|
| `deadline-check` | every 5 min | Fires due statutory deadlines → deadline-prompt emails |
| outcome follow-ups | delayed T+14/30/60 | "How did it go?" emails, scheduled when a case is `sent` |
| `law-monitor` | weekly (Sun 02:00 UTC) | Checks CA/TX/NY/FL deposit statutes for amendments via Tavily + GPT-4o; emails `ADMIN_EMAILS` on a detected change |
| generation | on demand | Async letter/sequence generation when the circuit breaker trips |
| email delivery | continuous | Sends all transactional email |

---

## Payment & webhook flow (deposit)

1. Checkout node → Paddle overlay → `POST /checkout` links the transaction id.
2. Paddle → `POST /api/webhooks/paddle`: verifies HMAC, stores the event
   (idempotent), and processes it. `transaction.completed` → marks the case
   `paid` + queues a confirmation email. `transaction.refunded` → `refunded` +
   `closed`.
3. `POST /generate` is the paywall: deposit generation requires `paid`.

---

## Abnormalities & risks — consolidated

### Fixed during this migration/documentation pass
- ✅ **`webhooks/paddle` `const secret` collision** (Paddle secret vs service
  secret) — was compile-breaking; renamed to `svcSecret`.
- ✅ **`case/[id]/page.tsx` packet block** still referenced the deleted `supabase`
  client + a renamed variable — would `ReferenceError` on post-`generated`
  statuses; now uses `q(api.packets.listByCaseMine)`.

### Product / UX (pre-existing, not migration-caused)
- **A1** Marketing `?wedge=`/`?plan=` params are ignored by `/new`.
- **A2** Subscription funnels → `/new`, deposit funnels → `/register` (inconsistent).
- **A4** Google OAuth exists in code but has no UI button.
- **A5** Register password `minLength` says 6; code enforces 8 + upper + digit.
- **A7** `DeclineScreen` unreachable during intake.
- **A9** `ExtractionConfirmation` + the parse/confirm loop are orphaned (not mounted).
- **Deposit payment dead-end**: if the Paddle webhook exceeds the 60s poll window,
  the user gets a manual "refresh the page" error.
- **Reload-heavy**: most completions use `window.location.reload()`/`router.refresh()`
  rather than reactive updates — only the subscription sequence is reactive.

### Correctness / server-side (worth prioritizing)
- **Auto-refund only fires from `/generate`, never from the webhook.** A user in
  an unsupported jurisdiction who pays but never triggers generation is not
  refunded. (The checkout route blocks unsupported jurisdictions pre-payment, but
  only if the client called checkout-link first.)
- **Outcome-email lifecycle is coupled only to the `/status` route.** A refund or
  any internal close (`setStatusInternal` / `setPaymentStatusInternal`) neither
  schedules nor cancels follow-ups — a refunded case can leave follow-up emails
  scheduled.
- **Async generation worker skips the payment + refusal + status + duplicate
  checks** the synchronous route enforces. Safe only because the route is the sole
  enqueuer today; not independently safe.
- **Circuit breaker is fail-open on a Redis outage** — it runs synchronously
  during exactly the spike it's meant to shed.
- **Single `outcome-followup` queue backs all transactional email** (self-flagged
  in code). Throughput problems couple all email types.
- **A6/A8** Refusal is a two-step close and evaluates fail-open (see Journey 5).
- **Packet route has no status/payment/eligibility gate** — any case owner can
  generate a filing packet regardless of case state.
- **Deadline re-fire risk**: `markDeadlineFired` runs after the email enqueue; a
  crash in between can re-fire on the next 5-min tick (dedup only within job
  retention).

### Migration behavioral changes (intended, documented for support)
- **A3** Email verification & password reset are OTP codes, not links.
- **A10** Account deletion no longer re-checks the password.
- `subscriptions.userId` is optional (Paddle `customer_id` ≠ app user id).

---

_Traceability: frontend journeys map to `src/app/(app)/**`, `src/features/**`,
`src/components/dashboard/**`; server flows to `src/app/api/**`,
`src/lib/**`, `src/workers/**`, and `convex/**`. See `convex/MIGRATION.md` for
the data-layer migration details._
