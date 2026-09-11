# Live $1 payment test — deposit flow

How to exercise the **real** deposit flow end to end — checkout → Polar →
webhook → entitlement → letter generation → PDF — while paying $1 instead of
$49.

This is the one part of the pipeline that unit tests cannot prove. Everything
between "user clicks pay" and "letter exists" depends on Polar actually
delivering a signed webhook to a reachable URL, and that has never been
verified against a real payment.

---

## Why $1 rather than $49

The webhook processor enforces a **price floor**: an order must be worth at
least $49 (4900 cents) before it unlocks the deliverable. That check is what
stops an order for a cheaper or foreign product from unlocking a paid letter,
so it cannot simply be deleted for testing.

Instead there is a single, deliberately awkward override:
`DEPOSIT_LETTER_MIN_CENTS`.

---

## Step 1 — Create the $1 product in Polar

In the Polar dashboard (**use the sandbox organization**, not production):

1. **Products → New Product**
2. Name: `TEST — Deposit Demand Letter ($1)`
   (the leading `TEST` matters: it is how you spot it later)
3. Pricing: **One-time payment**, amount **$1.00**
4. Save, then copy the **product ID** (`prod_...`)

Keep the real $49 product exactly as it is — do not edit its price. Changing
the live product's price would affect real customers and would also mean
changing it back afterwards, which is a step easy to forget.

## Step 2 — Point the app at it

> `.env.example` is gitignored in this repo, so the variable below is
> documented here rather than there. It is also declared in `src/lib/env.ts`.

In your local `.env.local` (or the VPS env file if testing there):

```bash
# Polar sandbox — NOT production
POLAR_SERVER=sandbox
POLAR_ACCESS_TOKEN=<sandbox access token>
POLAR_WEBHOOK_SECRET=<sandbox webhook secret>

# The $1 test product, both server and client copies
POLAR_PRODUCT_LETTER=prod_xxxxxxxxxxxx
NEXT_PUBLIC_POLAR_PRODUCT_LETTER=prod_xxxxxxxxxxxx

# Allow a $1 order to unlock the letter (100 cents).
# Ignored automatically when POLAR_SERVER=production.
DEPOSIT_LETTER_MIN_CENTS=100
```

Restart the app so the new environment is picked up.

## Step 3 — Make Polar's webhook reachable

Polar must be able to POST to your app. Locally that means a tunnel:

```bash
npx untun@latest tunnel http://localhost:3000
# or: cloudflared tunnel --url http://localhost:3000
```

In Polar → **Settings → Webhooks**, point the endpoint at:

```
https://<your-tunnel-host>/api/webhooks/polar
```

Subscribe to at least: `order.paid`, `order.refunded`, `subscription.active`,
`subscription.canceled`, `subscription.updated`, `subscription.revoked`.

Copy the signing secret into `POLAR_WEBHOOK_SECRET`.

> If you are testing on the VPS instead, no tunnel is needed — use
> `https://app.<your-domain>/api/webhooks/polar`.

## Step 4 — Run the flow

1. Sign in (or register) in the app.
2. Start a deposit case in a **supported state** (CA, TX, NY, FL) — an
   unsupported state is auto-refunded by design and will not generate a letter.
3. Complete the diagnostic through to the paywall.
4. Pay with a Polar sandbox test card.
5. Watch the app: it lands on the case page with the letter generated.

## Step 5 — Verify what actually matters

Do not stop at "the page looked right". Check each link in the chain:

| Check | Where | Expected |
|---|---|---|
| Webhook arrived and verified | app logs | no `Invalid webhook signature` |
| Event stored | Convex `webhookEvents` | a row with your `webhook-id` |
| Event **processed** | Convex `webhookEvents` | `processedAt` is set, not null |
| Floor accepted the $1 | app logs | `TEST MODE: deposit-letter price floor lowered to 100c` |
| Payment recorded | Convex `cases` | `payment_status: 'paid'` |
| Payer bound to owner | app logs | no `Order payer does not match the case owner` |
| Letter generated | Convex `letters` | a row for the case |
| Citations verified | Convex `letters` | `citationValidation.pass` is true |
| Rebuttal table stored | Convex `letters` | `rebuttalTable` present (if deductions disputed) |
| PDF downloads | the app | a real, complete PDF |
| Confirmation email | Resend dashboard | delivered |

**The single most important row is `processedAt`.** If the event is stored but
never processed, the customer paid and the letter never arrives — that was a
real defect and this is the check that catches its return.

### Also worth testing while you are set up

- **Refund**: refund the order in Polar. The case should flip to
  `payment_status: 'refunded'` and the letter should stop being downloadable.
- **Replay**: this is the recovery path that was dead code. In Convex, set a
  processed event's `processedAt` back to `null`. Within ~3 minutes the
  reprocess worker should pick it up and complete without error.
- **Subscription**: buy a $1 recurring test product and cancel it from
  **Settings → Manage or cancel subscription**, which should open an
  authenticated Polar portal rather than a generic page.

## Step 6 — Tear down (do not skip)

1. **Remove `DEPOSIT_LETTER_MIN_CENTS`** from every env file.
2. Restore `POLAR_PRODUCT_LETTER` / `NEXT_PUBLIC_POLAR_PRODUCT_LETTER` to the
   real $49 product.
3. Set `POLAR_SERVER=production` and swap in production Polar credentials.
4. Point the webhook endpoint at the production URL.
5. Archive the `TEST —` product in Polar so it cannot be bought.

### The safety net, if you forget

`DEPOSIT_LETTER_MIN_CENTS` is **ignored whenever `POLAR_SERVER=production`**,
and the app logs an error saying so. Leaving it set in a production env file
cannot make the $49 letter purchasable for $1.

It also cannot *raise* the floor: a typo like `DEPOSIT_LETTER_MIN_CENTS=490000`
is clamped back to 4900, so it can never start rejecting legitimate orders.

Neither safeguard is a reason to leave it set — tear it down anyway.
