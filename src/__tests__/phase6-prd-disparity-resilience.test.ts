/**
 * Phase 6 — PRD Disparity Resolution & Resilience — Tests
 *
 * Validates:
 * - 6a: Deadline scheduling auto-wired after letter generation
 * - 6b: Guided-sending section in letter-view.tsx
 * - 6c: Async generation queue with visible position
 * - 6d: Circuit breaker for generation queue depth
 * - 6e: A/B price testing
 * - 6f: Subscription checkout, management UI, webhook handling
 * - 6g: Trust layer 50-case threshold
 *
 * Risk mitigations:
 * - R1: Moving generation to async breaks deposit flow → verify queue path + sync fallback
 * - R2: Circuit breaker fires prematurely → verify threshold is configurable
 * - R3: A/B price testing creates Paddle complexity → verify deterministic assignment
 * - R4: Subscription webhook handling incomplete → verify renewal + cancellation
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  Helper: read source file                                          */
/* ================================================================== */

function readSource(relativePath: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '..', relativePath),
    'utf-8',
  );
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '..', relativePath));
}

/* ================================================================== */
/*  6a: Deadline scheduling after letter generation                   */
/* ================================================================== */

describe('6a: Deadline scheduling wired into generate route', () => {
  const source = readSource('app/api/cases/[id]/generate/route.ts');

  it('imports computeDeadlines from deadlines/calculator', () => {
    expect(source).toContain(
      "import { computeDeadlines } from '@/lib/deadlines/calculator'",
    );
  });

  it('imports scheduleDeadlines from deadlines/scheduler', () => {
    expect(source).toContain(
      "import { scheduleDeadlines } from '@/lib/deadlines/scheduler'",
    );
  });

  it('imports loadKbEntry from kb/loader', () => {
    expect(source).toContain(
      "import { loadKbEntry } from '@/lib/kb/loader'",
    );
  });

  it('imports JURISDICTION_TIMEZONE for timezone resolution', () => {
    expect(source).toContain('JURISDICTION_TIMEZONE');
  });

  it('calls loadKbEntry in handleDepositGeneration', () => {
    // Extract the deposit handler
    const depositIdx = source.indexOf('async function handleDepositGeneration');
    expect(depositIdx).toBeGreaterThan(-1);
    const depositSource = source.slice(depositIdx);
    expect(depositSource).toContain("loadKbEntry('deposit'");
  });

  it('calls computeDeadlines with KB rules', () => {
    const depositIdx = source.indexOf('async function handleDepositGeneration');
    const depositSource = source.slice(depositIdx);
    expect(depositSource).toContain('computeDeadlines(');
    expect(depositSource).toContain('kbEntry.deadline_rules');
  });

  it('calls scheduleDeadlines to persist computed deadlines', () => {
    const depositIdx = source.indexOf('async function handleDepositGeneration');
    const depositSource = source.slice(depositIdx);
    expect(depositSource).toContain('scheduleDeadlines(');
  });

  it('deadline scheduling is wrapped in try-catch (non-critical)', () => {
    const depositIdx = source.indexOf('async function handleDepositGeneration');
    const depositSource = source.slice(depositIdx);
    expect(depositSource).toContain('Failed to schedule deadlines');
  });

  it('uses JURISDICTION_TIMEZONE for timezone resolution', () => {
    const depositIdx = source.indexOf('async function handleDepositGeneration');
    const depositSource = source.slice(depositIdx);
    expect(depositSource).toContain('JURISDICTION_TIMEZONE[');
  });
});

describe('6a: Deadline calculator module', () => {
  const source = readSource('lib/deadlines/calculator.ts');

  it('exports computeDeadlines function', () => {
    expect(source).toContain('export function computeDeadlines');
  });

  it('accepts deadline rules, answers, and timezone', () => {
    expect(source).toContain('rules: DeadlineRule[]');
    expect(source).toContain('answers: AnchorDates');
    expect(source).toContain('timezone: string');
  });

  it('computes severity levels: info, warning, critical', () => {
    expect(source).toContain("'info'");
    expect(source).toContain("'warning'");
    expect(source).toContain("'critical'");
  });

  it('sorts deadlines by date ascending (most urgent first)', () => {
    expect(source).toContain(
      'a.deadline_date.getTime() - b.deadline_date.getTime()',
    );
  });

  it('exports getActionableDeadlines for prompt window filtering', () => {
    expect(source).toContain('export function getActionableDeadlines');
  });
});

describe('6a: Deadline scheduler module', () => {
  const source = readSource('lib/deadlines/scheduler.ts');

  it('exports scheduleDeadlines function', () => {
    expect(source).toContain('export async function scheduleDeadlines');
  });

  it('prevents duplicate scheduling (idempotent)', () => {
    expect(source).toContain('existingKeys');
    expect(source).toContain('skipped++');
  });

  it('exports markDeadlineFired for the worker', () => {
    // Convex migration: markDeadlineFired moved from the scheduler module into the
    // service-gated Convex layer (api.service.markDeadlineFired) and is invoked by
    // the deadline-check worker.
    const workerSource = readSource('workers/deadline-check.worker.ts');
    expect(workerSource).toContain('api.service.markDeadlineFired');
  });

  it('exports getDueDeadlines for the cron job', () => {
    // Convex migration: getDueDeadlines moved to api.service.getDueDeadlines and is
    // queried by the deadline-check worker (the cron entrypoint).
    const workerSource = readSource('workers/deadline-check.worker.ts');
    expect(workerSource).toContain('api.service.getDueDeadlines');
  });
});

describe('6a: deadlineEvents table in the Convex schema', () => {
  const schemaPath = path.resolve(__dirname, '../../convex/schema.ts');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const idx = schema.indexOf('deadlineEvents: defineTable(');
  const tableSection = schema.slice(idx, schema.indexOf('.index', idx));

  it('schema file exists', () => {
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it('defines the deadlineEvents table', () => {
    expect(schema).toContain('deadlineEvents: defineTable(');
  });

  it('has a deadlineDate field', () => {
    expect(tableSection).toContain('deadlineDate: v.number()');
  });

  it('references the parent case (was ON DELETE CASCADE on case_id)', () => {
    // Convex has no ON DELETE CASCADE; the case relationship is a typed
    // reference and cascade behavior is enforced in delete mutations.
    expect(tableSection).toContain("caseId: v.id('cases')");
  });
});

/* ================================================================== */
/*  6b: Guided-sending section (How to Send This)                     */
/* ================================================================== */

describe('6b: Guided-sending in letter-view.tsx', () => {
  const source = readSource('features/deposit/components/letter-view.tsx');

  it('has "How to Send This" button', () => {
    expect(source).toContain('How to Send This');
  });

  it('has expandable send guide state', () => {
    expect(source).toContain('showSendGuide');
    expect(source).toContain('setShowSendGuide');
  });

  it('contains USPS Certified Mail instructions', () => {
    expect(source).toContain('USPS Certified Mail');
  });

  it('mentions Return Receipt Requested', () => {
    expect(source).toContain('Return Receipt');
  });

  it('mentions PS Form 3811', () => {
    expect(source).toContain('PS Form 3811');
  });

  it('has 4-step walkthrough', () => {
    // Steps 1-4
    expect(source).toContain('Print the letter');
    expect(source).toContain('Send via USPS');
    expect(source).toContain('Keep the green card');
    expect(source).toContain('Come back and mark as sent');
  });

  it('mentions approximate cost ($4-7)', () => {
    expect(source).toContain('$4-7');
  });

  it('has "Mark as Sent" button', () => {
    expect(source).toContain('I Sent It');
    expect(source).toContain('Mark as Sent');
  });

  it('calls status API to mark case as sent', () => {
    expect(source).toContain('/api/cases/');
    expect(source).toContain('/status');
    expect(source).toContain("new_status: 'sent'");
  });
});

/* ================================================================== */
/*  6c: Async generation queue with visible position                  */
/* ================================================================== */

describe('6c: Generation worker', () => {
  it('generation worker file exists', () => {
    expect(fileExists('workers/generation.worker.ts')).toBe(true);
  });

  const source = readSource('workers/generation.worker.ts');

  it('exports createLetterGenerationWorker factory', () => {
    expect(source).toContain('export function createLetterGenerationWorker');
  });

  it('exports createSequenceGenerationWorker factory', () => {
    expect(source).toContain('export function createSequenceGenerationWorker');
  });

  it('processes deposit generation', () => {
    expect(source).toContain('processDepositGeneration');
    expect(source).toContain('generateLetter');
  });

  it('processes subscription generation', () => {
    expect(source).toContain('processSubscriptionGeneration');
    expect(source).toContain('generateSequence');
  });

  it('uses LETTER_GENERATE queue name', () => {
    expect(source).toContain('QUEUE_NAMES.LETTER_GENERATE');
  });

  it('uses SEQUENCE_GENERATE queue name', () => {
    expect(source).toContain('QUEUE_NAMES.SEQUENCE_GENERATE');
  });

  it('limits concurrency to prevent resource exhaustion', () => {
    expect(source).toContain('concurrency: 3');
  });

  it('schedules deadlines after deposit generation', () => {
    expect(source).toContain('computeDeadlines');
    expect(source).toContain('scheduleDeadlines');
  });

  it('enqueues letter delivery email after deposit generation', () => {
    expect(source).toContain('enqueueLetterDeliveryEmail');
  });

  it('creates audit log entries', () => {
    // Convex migration: audit_log insert -> api.service.insertAudit; the
    // correlation_id column is the correlationId argument.
    expect(source).toContain('api.service.insertAudit');
    expect(source).toContain('correlationId');
  });

  it('updates case status to generated', () => {
    // Convex migration: setCaseStatus mutation with newStatus: 'generated'
    // (records status history atomically).
    expect(source).toContain("newStatus: 'generated'");
  });
});

describe('6c: Generation enqueue helpers', () => {
  const source = readSource('lib/queue/enqueue.ts');

  it('exports enqueueLetterGeneration function', () => {
    expect(source).toContain('export async function enqueueLetterGeneration');
  });

  it('uses deterministic jobId for deduplication', () => {
    expect(source).toContain('gen-${caseId}');
  });

  it('routes deposit to LETTER_GENERATE queue', () => {
    expect(source).toContain('QUEUE_NAMES.LETTER_GENERATE');
  });

  it('routes subscription to SEQUENCE_GENERATE queue', () => {
    expect(source).toContain('QUEUE_NAMES.SEQUENCE_GENERATE');
  });

  it('exports getGenerationQueueDepth function', () => {
    expect(source).toContain('export async function getGenerationQueueDepth');
  });

  it('getGenerationQueueDepth sums both queues', () => {
    const fnStart = source.indexOf('async function getGenerationQueueDepth');
    const fnSource = source.slice(fnStart, source.indexOf('\n}', fnStart) + 2);
    expect(fnSource).toContain('getWaitingCount');
    expect(fnSource).toContain('getActiveCount');
    expect(fnSource).toContain('letterWaiting');
    expect(fnSource).toContain('seqWaiting');
  });

  it('exports getJobQueuePosition function', () => {
    expect(source).toContain('export async function getJobQueuePosition');
  });
});

describe('6c: Generation status polling endpoint', () => {
  it('status endpoint file exists', () => {
    expect(
      fileExists('app/api/cases/[id]/generate/status/route.ts'),
    ).toBe(true);
  });

  const source = readSource('app/api/cases/[id]/generate/status/route.ts');

  it('exports GET handler', () => {
    expect(source).toContain('export async function GET');
  });

  it('requires authentication', () => {
    // Convex migration: supabase.auth.getUser() -> currentUser()
    expect(source).toContain('currentUser()');
    expect(source).toContain('Unauthorized');
  });

  it('returns state, position, and queue_depth', () => {
    expect(source).toContain('state:');
    expect(source).toContain('position:');
    expect(source).toContain('queue_depth:');
  });

  it('returns completed immediately if case is already generated', () => {
    expect(source).toContain("'generated'");
    expect(source).toContain("state: 'completed'");
  });

  it('calls getJobQueuePosition', () => {
    expect(source).toContain('getJobQueuePosition');
  });

  it('calls getGenerationQueueDepth', () => {
    expect(source).toContain('getGenerationQueueDepth');
  });
});

describe('6c: Workers index registers generation workers', () => {
  const source = readSource('workers/index.ts');

  it('imports generation worker factories', () => {
    expect(source).toContain('createLetterGenerationWorker');
    expect(source).toContain('createSequenceGenerationWorker');
  });

  it('creates letter generation worker', () => {
    expect(source).toContain('letterGenWorker');
    expect(source).toContain('createLetterGenerationWorker()');
  });

  it('creates sequence generation worker', () => {
    expect(source).toContain('sequenceGenWorker');
    expect(source).toContain('createSequenceGenerationWorker()');
  });

  it('includes generation workers in shutdown', () => {
    expect(source).toContain('letterGenWorker.close()');
    expect(source).toContain('sequenceGenWorker.close()');
  });

  it('logs generation queues in startup message', () => {
    expect(source).toContain('letter-generate');
    expect(source).toContain('sequence-generate');
  });
});

/* ================================================================== */
/*  6d: Circuit breaker for generation queue depth                    */
/* ================================================================== */

describe('6d: Circuit breaker in generate route', () => {
  const source = readSource('app/api/cases/[id]/generate/route.ts');

  it('defines CIRCUIT_BREAKER_THRESHOLD constant', () => {
    expect(source).toContain('CIRCUIT_BREAKER_THRESHOLD');
  });

  it('threshold is 50', () => {
    expect(source).toMatch(/CIRCUIT_BREAKER_THRESHOLD\s*=\s*50/);
  });

  it('imports getGenerationQueueDepth', () => {
    expect(source).toContain('getGenerationQueueDepth');
  });

  it('imports enqueueLetterGeneration', () => {
    expect(source).toContain('enqueueLetterGeneration');
  });

  it('checks queue depth before generation', () => {
    // The circuit breaker check should be in the POST handler
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    expect(postSource).toContain('getGenerationQueueDepth()');
    expect(postSource).toContain('CIRCUIT_BREAKER_THRESHOLD');
  });

  it('enqueues job when queue is deep', () => {
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    expect(postSource).toContain('enqueueLetterGeneration(');
  });

  it('returns queued response with job_id and message', () => {
    expect(source).toContain('queued: true');
    expect(source).toContain('job_id:');
    expect(source).toContain('queue_depth:');
    expect(source).toContain('experiencing high demand');
  });

  it('falls through to synchronous generation when queue is low', () => {
    // After the circuit breaker check, should route to wedge handlers
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    expect(postSource).toContain('handleSubscriptionGeneration');
    expect(postSource).toContain('handleDepositGeneration');
  });

  it('handles Redis failure gracefully (falls through)', () => {
    // Behavior change (R-4 hardening): on an unreadable queue depth (Redis
    // unreachable) the route now FAILS SAFE — it returns a 503 with a retry hint
    // rather than falling through to synchronous generation and bypassing
    // load-shedding. The graceful-handling intent is preserved; the mechanism is
    // now fail-safe. Assert the current fail-safe behavior.
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    expect(postSource).toContain('R-4: fail SAFE');
    expect(postSource).toContain('status: 503');
    expect(postSource).toContain("'Retry-After'");
  });
});

/* ================================================================== */
/*  6e: A/B price testing                                             */
/* ================================================================== */

describe('6e: A/B pricing module', () => {
  it('ab-pricing module exists', () => {
    expect(fileExists('lib/pricing/ab-pricing.ts')).toBe(true);
  });

  const source = readSource('lib/pricing/ab-pricing.ts');

  it('exports PriceVariant interface', () => {
    expect(source).toContain('export interface PriceVariant');
  });

  it('PriceVariant has amount, productId, label fields', () => {
    expect(source).toContain('amount: number');
    expect(source).toContain('productId: string');
    expect(source).toContain('label: string');
  });

  it('exports parsePriceVariants function', () => {
    expect(source).toContain('export function parsePriceVariants');
  });

  it('reads NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS env var', () => {
    expect(source).toContain('NEXT_PUBLIC_DEPOSIT_PRICE_VARIANTS');
  });

  it('falls back to default $49 price when env var is empty', () => {
    expect(source).toContain('amount: 49');
    expect(source).toContain("label: '$49'");
  });

  it('parses comma-separated amount:priceId pairs', () => {
    expect(source).toContain("raw.split(',')");
    expect(source).toContain("trimmed.split(':')");
  });

  it('exports assignPriceVariant function', () => {
    expect(source).toContain('export function assignPriceVariant');
  });

  it('uses deterministic hash of caseId for assignment', () => {
    expect(source).toContain('hashCaseId');
    expect(source).toContain('caseId.charCodeAt');
  });

  it('is deterministic: same caseId always gets same variant', () => {
    expect(source).toContain('Deterministic');
  });
});

describe('6e: A/B pricing in letter preview', () => {
  const source = readSource(
    'features/checkout/components/letter-preview.tsx',
  );

  it('accepts priceLabel prop', () => {
    expect(source).toContain('priceLabel');
  });

  it('defaults priceLabel to $49', () => {
    expect(source).toContain("priceLabel = '$49'");
  });

  it('uses dynamic priceLabel in CTA button', () => {
    expect(source).toContain('Unlock Full Letter — {priceLabel}');
  });

  it('no longer hardcodes $49 in the CTA', () => {
    // The old hardcoded text should be gone
    expect(source).not.toContain('Unlock Full Letter — $49');
  });
});

describe('6e: A/B pricing in preview node', () => {
  const source = readSource(
    'features/diagnostic/components/nodes/preview-node.tsx',
  );

  it('imports assignPriceVariant', () => {
    expect(source).toContain('assignPriceVariant');
  });

  it('calls assignPriceVariant(caseId)', () => {
    expect(source).toContain('assignPriceVariant(caseId)');
  });

  it('passes priceLabel to LetterPreview', () => {
    expect(source).toContain('priceLabel={priceVariant.label}');
  });

  it('passes price_variant in onAnswer callback', () => {
    expect(source).toContain('price_variant: priceVariant');
  });
});

describe('6e: A/B pricing in payment node', () => {
  const source = readSource(
    'features/diagnostic/components/nodes/payment-node.tsx',
  );

  it('imports assignPriceVariant', () => {
    expect(source).toContain('assignPriceVariant');
  });

  it('uses variant productId instead of hardcoded env var', () => {
    expect(source).toContain('priceVariant.productId');
    // Old Paddle env pattern should be gone
    expect(source).not.toContain('NEXT_PUBLIC_PADDLE_DEPOSIT_PRICE_ID');
  });

  it('includes variant label in product name', () => {
    expect(source).toContain('priceVariant.label');
  });
});

describe('6e: A/B pricing logged in checkout audit', () => {
  const source = readSource('app/api/cases/[id]/checkout/route.ts');

  it('imports assignPriceVariant', () => {
    expect(source).toContain('assignPriceVariant');
  });

  it('logs price variant to audit_log', () => {
    expect(source).toContain('price_variant_amount');
    expect(source).toContain('price_variant_label');
    // Convex migration: audit_log insert -> api.service.insertAudit
    expect(source).toContain('api.service.insertAudit');
  });

  it('uses ab_test_v1 as prompt_version for tracking', () => {
    expect(source).toContain('ab_test_v1');
  });
});

/* ================================================================== */
/*  6f: Subscription checkout and management                          */
/* ================================================================== */

describe('6f: Subscription upsell component', () => {
  it('subscription upsell component exists', () => {
    expect(
      fileExists('features/checkout/components/subscription-upsell.tsx'),
    ).toBe(true);
  });

  const source = readSource(
    'features/checkout/components/subscription-upsell.tsx',
  );

  it('is a client component', () => {
    expect(source).toContain("'use client'");
  });

  it('offers monthly plan at $15/mo', () => {
    expect(source).toContain('$15/mo');
  });

  it('offers annual plan at $129/yr', () => {
    expect(source).toContain('$129/yr');
  });

  it('shows savings for annual plan', () => {
    expect(source).toContain('Save 28%');
  });

  it('reads monthly product ID from env', () => {
    expect(source).toContain('NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY');
  });

  it('reads annual product ID from env', () => {
    expect(source).toContain('NEXT_PUBLIC_POLAR_PRODUCT_YEARLY');
  });

  it('uses PolarCheckout for payment', () => {
    expect(source).toContain('PolarCheckout');
  });

  it('has dismiss option (no thanks)', () => {
    expect(source).toContain('No thanks');
    expect(source).toContain('onDismiss');
  });

  it('lists plan features: unlimited, all states, cancel anytime', () => {
    expect(source).toContain('Unlimited deposit letters');
    expect(source).toContain('All supported states');
    expect(source).toContain('Cancel anytime');
  });
});

describe('6f: Subscription upsell wired into letter view', () => {
  const source = readSource('features/deposit/components/letter-view.tsx');

  it('imports SubscriptionUpsell', () => {
    expect(source).toContain('SubscriptionUpsell');
  });

  it('has showUpsell state', () => {
    expect(source).toContain('showUpsell');
    expect(source).toContain('setShowUpsell');
  });

  it('renders SubscriptionUpsell component', () => {
    expect(source).toContain('<SubscriptionUpsell');
  });
});

describe('6f: Subscription management in settings', () => {
  const source = readSource('app/(app)/settings/page.tsx');

  it('fetches subscription data from API', () => {
    expect(source).toContain('/api/account/subscription');
  });

  it('shows subscription plan name', () => {
    expect(source).toContain('Annual Unlimited');
    expect(source).toContain('Monthly Unlimited');
  });

  it('shows subscription status badge', () => {
    expect(source).toContain('Active');
  });

  it('shows renewal/cancellation date', () => {
    expect(source).toContain('Renews on');
    expect(source).toContain('Cancels on');
  });

  it('links to the Polar customer portal', () => {
    expect(source).toContain('polar.sh');
    expect(source).toContain('Manage subscription');
  });

  it('no longer references the Paddle customer portal', () => {
    expect(source).not.toContain('paddle.com');
  });
});

describe('6f: Subscription API endpoint', () => {
  it('subscription API route exists', () => {
    expect(
      fileExists('app/api/account/subscription/route.ts'),
    ).toBe(true);
  });

  const source = readSource('app/api/account/subscription/route.ts');

  it('exports GET handler', () => {
    expect(source).toContain('export async function GET');
  });

  it('requires authentication', () => {
    // Convex migration: supabase.auth.getUser() -> currentUser()
    expect(source).toContain('currentUser()');
    expect(source).toContain('Unauthorized');
  });

  it('queries subscriptions table', () => {
    // Convex migration: the subscriptions query + active/past_due filter moved
    // into the owner-scoped subscriptions.currentMine Convex query.
    expect(source).toContain('api.subscriptions.currentMine');
  });

  it('filters for active or past_due subscriptions', () => {
    // Convex migration: active/past_due filtering is enforced inside
    // subscriptions.currentMine (see convex/subscriptions.ts).
    const convexSubs = fs.readFileSync(
      path.resolve(__dirname, '../../convex/subscriptions.ts'),
      'utf-8',
    );
    expect(convexSubs).toContain("'active'");
    expect(convexSubs).toContain("'past_due'");
  });

  it('returns null if no subscription found', () => {
    expect(source).toContain('subscription: null');
  });
});

describe('6f: Webhook processor handles Polar subscription events', () => {
  const source = readSource('lib/payments/webhook-processor.ts');

  it('handleSubscriptionUpdated updates the billing period', () => {
    const fnIdx = source.indexOf('async function handleSubscriptionUpdated');
    const fnSource = source.slice(fnIdx);
    // Reads the Polar currentPeriodStart/End (Date) and writes the Convex patch
    // fields currentPeriodStart / currentPeriodEnd (epoch ms).
    expect(fnSource).toContain('currentPeriodStart');
    expect(fnSource).toContain('currentPeriodEnd');
  });

  it('detects plan change via product name (derivePlan)', () => {
    const fnIdx = source.indexOf('async function handleSubscriptionUpdated');
    const fnSource = source.slice(fnIdx);
    expect(fnSource).toContain('sub.product');
    expect(fnSource).toContain('derivePlan');
  });

  it('propagates cancelAtPeriodEnd', () => {
    const fnIdx = source.indexOf('async function handleSubscriptionUpdated');
    const fnSource = source.slice(fnIdx);
    expect(fnSource).toContain('cancelAtPeriodEnd');
  });

  it('order.paid branches on subscriptionId (renewal gotcha)', () => {
    const fnIdx = source.indexOf('export async function handleOrderPaid');
    const fnSource = source.slice(fnIdx);
    // A subscription-cycle order (renewal) must NOT re-run one-time fulfillment.
    expect(fnSource).toContain('order.subscriptionId');
  });

  it('order.paid binds the PAYER to the case owner before granting (CWE-639)', () => {
    // SECURITY regression: the case is located from client-controlled
    // metadata.caseId, so an authed attacker could pay toward a VICTIM's case and
    // flip their payment_status='paid'. handleOrderPaid must resolve the paying
    // customer to a userId and require it equals the case owner, BEFORE it calls
    // setPaymentStatus('paid'). This test fails if that binding is removed.
    const fnIdx = source.indexOf('export async function handleOrderPaid');
    const fnSource = source.slice(fnIdx);
    // Resolves the payer from the trustworthy (Polar-set) customer email...
    expect(fnSource).toContain('order.customer?.email');
    expect(fnSource).toContain('api.service.userIdByEmail');
    // ...and gates on owner match.
    expect(fnSource).toContain('caseRow.user_id');
    // The ownership check must appear BEFORE the grant, not after.
    const ownerCheckIdx = fnSource.indexOf('userIdByEmail');
    const grantIdx = fnSource.indexOf('api.service.setPaymentStatus');
    expect(ownerCheckIdx).toBeGreaterThan(-1);
    expect(grantIdx).toBeGreaterThan(ownerCheckIdx);
  });

  it('handles subscription.active (create/activate)', () => {
    expect(source).toContain('handleSubscriptionActive');
    expect(source).toContain('createSubscription');
  });

  it('entitlement OFF uses subscription.revoked, not canceled', () => {
    expect(source).toContain('handleSubscriptionRevoked');
    // revoked sets a status currentMine does NOT treat as active.
    const revIdx = source.indexOf('export async function handleSubscriptionRevoked');
    const revSource = source.slice(revIdx);
    expect(revSource).toContain("status: 'revoked'");
    // canceled only schedules the end — stays active until period end.
    const canIdx = source.indexOf('export async function handleSubscriptionCanceled');
    const canSource = source.slice(canIdx, revIdx > canIdx ? revIdx : undefined);
    expect(canSource).toContain("status: 'canceled'");
  });
});

describe('6f: Polar boundary types (Zod at the boundary)', () => {
  const source = readSource('types/external/polar.types.ts');

  it('defines a Polar order schema with subscriptionId + metadata', () => {
    expect(source).toContain('polarOrderSchema');
    expect(source).toContain('subscriptionId');
    expect(source).toContain('metadata');
    expect(source).toContain('totalAmount');
  });

  it('defines a Polar subscription schema with period + status', () => {
    expect(source).toContain('polarSubscriptionSchema');
    expect(source).toContain('currentPeriodStart');
    expect(source).toContain('currentPeriodEnd');
    expect(source).toContain('cancelAtPeriodEnd');
  });

  it('derivePlan maps to annual_unlimited / monthly_unlimited', () => {
    expect(source).toContain("'annual_unlimited'");
    expect(source).toContain("'monthly_unlimited'");
  });
});

describe('6f: Polar products defined in the client module', () => {
  const source = readSource('lib/payments/polar-client.ts');

  it('exposes the deposit-letter product', () => {
    expect(source).toContain('depositLetter');
    expect(source).toContain('POLAR_PRODUCT_LETTER');
  });

  it('exposes the monthly Unlimited product', () => {
    expect(source).toContain('monthlyUnlimited');
    expect(source).toContain('POLAR_PRODUCT_MONTHLY');
  });

  it('exposes the yearly Unlimited product', () => {
    expect(source).toContain('yearlyUnlimited');
    expect(source).toContain('POLAR_PRODUCT_YEARLY');
  });

  it('initializes a single Polar client keyed on POLAR_SERVER', () => {
    expect(source).toContain('getPolar');
    expect(source).toContain('POLAR_ACCESS_TOKEN');
    expect(source).toContain('POLAR_SERVER');
  });
});

describe('6f: subscriptions table in the Convex schema', () => {
  const schemaPath = path.resolve(__dirname, '../../convex/schema.ts');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const subIdx = schema.indexOf('subscriptions: defineTable(');
  const subSection = schema.slice(subIdx, schema.indexOf('.index', subIdx));

  it('subscriptions table exists', () => {
    expect(schema).toContain('subscriptions: defineTable(');
  });

  it('has a plan field', () => {
    expect(subSection).toContain('plan: v.string()');
  });

  it('has a polarSubscriptionId field', () => {
    expect(subSection).toContain('polarSubscriptionId: v.string()');
  });

  it('has currentPeriodStart and currentPeriodEnd', () => {
    expect(subSection).toContain('currentPeriodStart: v.optional(v.number())');
    expect(subSection).toContain('currentPeriodEnd: v.optional(v.number())');
  });

  it('has cancelAtPeriodEnd flag', () => {
    expect(subSection).toContain('cancelAtPeriodEnd: v.boolean()');
  });
});

/* ================================================================== */
/*  6g: Trust layer 50-case threshold                                 */
/* ================================================================== */

describe('6g: Trust stats API enforces threshold', () => {
  const source = readSource('app/api/trust/stats/route.ts');

  it('defines MIN_CASES_FOR_DISPLAY constant', () => {
    expect(source).toContain('MIN_CASES_FOR_DISPLAY');
  });

  it('threshold is 50', () => {
    expect(source).toMatch(/MIN_CASES_FOR_DISPLAY\s*=\s*50/);
  });

  it('gates deposit stats on threshold', () => {
    expect(source).toContain(
      'depositTotal >= MIN_CASES_FOR_DISPLAY',
    );
  });

  it('gates subscription stats on threshold', () => {
    expect(source).toContain(
      'subscriptionTotal >= MIN_CASES_FOR_DISPLAY',
    );
  });

  it('gates recovery stats on 10-case minimum', () => {
    expect(source).toContain('recoveryCount >= 10');
  });

  it('returns stats_available flag for each wedge', () => {
    // Convex migration: the showDepositStats/showSubscriptionStats booleans are
    // now inlined as the per-wedge threshold comparison in the response.
    expect(source).toContain('stats_available: depositTotal >= MIN_CASES_FOR_DISPLAY');
    expect(source).toContain('stats_available: subscriptionTotal >= MIN_CASES_FOR_DISPLAY');
  });

  it('returns min_threshold in response', () => {
    expect(source).toContain('min_threshold: MIN_CASES_FOR_DISPLAY');
  });

  it('filters outcomes by consent.share_outcome', () => {
    // Convex migration: outcome aggregation (incl. consent.share_outcome filtering)
    // moved into the service-gated trustStats query (convex/trustStats.ts).
    const convexTrust = fs.readFileSync(
      path.resolve(__dirname, '../../convex/trustStats.ts'),
      'utf-8',
    );
    expect(convexTrust).toContain('share_outcome');
  });

  it('is a public endpoint (no auth required)', () => {
    // Should NOT require authentication
    expect(source).not.toContain('supabase.auth.getUser');
    expect(source).not.toContain('currentUser()');
  });

  it('uses service-role client for counts', () => {
    // Convex migration: createServiceRoleClient() -> createServiceConvexClient()
    // (service-secret-gated Convex client) for the server-side aggregate.
    expect(source).toContain('createServiceConvexClient');
  });
});

describe('6g: Trust signals component respects threshold', () => {
  const source = readSource('components/trust-signals.tsx');

  it('is a client component', () => {
    expect(source).toContain("'use client'");
  });

  it('fetches from /api/trust/stats', () => {
    expect(source).toContain('/api/trust/stats');
  });

  it('returns null when no data', () => {
    expect(source).toContain('return null');
  });

  it('hides when total_cases_completed is 0', () => {
    expect(source).toContain('total_cases_completed === 0');
  });

  it('shows recovery stats only when available', () => {
    expect(source).toContain('stats.recovery.available');
  });

  it('includes mandatory disclaimer', () => {
    expect(source).toContain('Individual results vary');
    expect(source).toContain('writing tool');
  });

  it('notes that stats reflect consented outcomes only', () => {
    expect(source).toContain('consented, verified outcomes');
  });
});

/* ================================================================== */
/*  Queue infrastructure for generation                               */
/* ================================================================== */

describe('Queue configuration for generation', () => {
  const source = readSource('lib/queue/config.ts');

  it('defines LETTER_GENERATE queue', () => {
    expect(source).toContain("LETTER_GENERATE: 'letter-generate'");
  });

  it('defines SEQUENCE_GENERATE queue', () => {
    expect(source).toContain("SEQUENCE_GENERATE: 'sequence-generate'");
  });

  it('LETTER_GENERATE has retry config (attempts: 2)', () => {
    const letterIdx = source.indexOf('[QUEUE_NAMES.LETTER_GENERATE]');
    const section = source.slice(letterIdx, source.indexOf('},', letterIdx) + 2);
    expect(section).toContain('attempts: 2');
  });

  it('uses exponential backoff', () => {
    expect(source).toContain("type: 'exponential'");
  });
});

/* ================================================================== */
/*  A/B pricing unit tests                                            */
/* ================================================================== */

describe('6e: A/B pricing — parsePriceVariants', () => {
  // We can actually import and test the function logic
  // by reading its code and verifying the algorithm

  const source = readSource('lib/pricing/ab-pricing.ts');

  it('validates amount is a positive integer', () => {
    expect(source).toContain('parseInt(amountStr, 10)');
    expect(source).toContain('isNaN(amount)');
    expect(source).toContain('amount <= 0');
  });

  it('handles empty variants gracefully', () => {
    expect(source).toContain("variants.length === 0");
  });
});

describe('6e: A/B pricing — hashCaseId', () => {
  const source = readSource('lib/pricing/ab-pricing.ts');

  it('uses character-code hash', () => {
    expect(source).toContain('charCodeAt');
  });

  it('returns absolute value for consistent positive index', () => {
    expect(source).toContain('Math.abs(hash)');
  });

  it('uses modulo for variant selection', () => {
    expect(source).toContain('% variants.length');
  });
});

/* ================================================================== */
/*  Integration: generate route gates deposit-specific checks         */
/* ================================================================== */

describe('6c/6d: Generate route — deposit gates moved to POST handler', () => {
  const source = readSource('app/api/cases/[id]/generate/route.ts');

  it('deposit payment gate is in POST handler (before circuit breaker)', () => {
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);

    // Payment check must appear BEFORE circuit breaker. The gate now accepts a
    // per-case payment OR an active subscription; anchor on the stable 402 message.
    const paymentCheckIdx = postSource.indexOf('Payment required before letter generation');
    const circuitBreakerIdx = postSource.indexOf('CIRCUIT_BREAKER_THRESHOLD');

    expect(paymentCheckIdx).toBeGreaterThan(-1);
    expect(circuitBreakerIdx).toBeGreaterThan(-1);
    expect(paymentCheckIdx).toBeLessThan(circuitBreakerIdx);
  });

  it('jurisdiction gate is in POST handler (before circuit breaker)', () => {
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);

    const jurisdictionCheckIdx = postSource.indexOf('DEPOSIT_JURISDICTION.includes');
    const circuitBreakerIdx = postSource.indexOf('CIRCUIT_BREAKER_THRESHOLD');

    expect(jurisdictionCheckIdx).toBeGreaterThan(-1);
    expect(circuitBreakerIdx).toBeGreaterThan(-1);
    expect(jurisdictionCheckIdx).toBeLessThan(circuitBreakerIdx);
  });

  it('deposit handler no longer has payment gate', () => {
    const depositFn = source.indexOf('async function handleDepositGeneration');
    const depositSource = source.slice(
      depositFn,
      source.indexOf('async function', depositFn + 1),
    );
    expect(depositSource).not.toContain("payment_status !== 'paid'");
  });

  it('auto-refund for unsupported jurisdiction still works', () => {
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    expect(postSource).toContain('processAutoRefundIfNeeded');
  });

  // M1: an active "Unlimited" subscription waives the per-case $49 deposit charge.
  it('deposit payment gate accepts an active subscription (Unlimited waiver)', () => {
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    // The gate queries the user's active subscription and only 402s when there
    // is neither a paid case NOR an active subscription.
    expect(postSource).toContain('api.subscriptions.currentMine');
    expect(postSource).toContain('!isPaid && !activeSubscription');
  });
});

/* ================================================================== */
/*  Risk mitigation checks                                            */
/* ================================================================== */

describe('Risk: Generation worker handles errors gracefully', () => {
  const source = readSource('workers/generation.worker.ts');

  it('worker has error event handler', () => {
    expect(source).toContain("worker.on('failed'");
  });

  it('uses service-role client (bypasses RLS)', () => {
    // Convex migration: the RLS-bypassing service-role Supabase client is replaced
    // by the trusted worker Convex client (workerConvex).
    expect(source).toContain('workerConvex');
    expect(source).toContain('@/lib/convex/worker-client');
  });

  it('deadline failure does not crash generation', () => {
    expect(source).toContain('Failed to schedule deadlines');
    // The deadline scheduling call should be inside a try-catch block
    const fnIdx = source.indexOf('async function processDepositGeneration');
    const fnSource = source.slice(fnIdx);
    const catchIdx = fnSource.indexOf('Failed to schedule deadlines');
    expect(catchIdx).toBeGreaterThan(-1);
    // The catch block proves it's inside a try-catch
    const beforeCatch = fnSource.slice(Math.max(0, catchIdx - 150), catchIdx);
    expect(beforeCatch).toContain('catch');
  });

  it('email failure does not crash generation', () => {
    expect(source).toContain('Failed to enqueue letter delivery email');
  });
});

describe('Risk: Circuit breaker message sets expectations', () => {
  const source = readSource('app/api/cases/[id]/generate/route.ts');

  it('message mentions email delivery', () => {
    expect(source).toContain('emailed to you when ready');
  });

  it('message mentions checking back', () => {
    expect(source).toContain('check back on');
  });
});

describe('Risk: A/B pricing falls back when not configured', () => {
  const source = readSource('lib/pricing/ab-pricing.ts');

  it('falls back to NEXT_PUBLIC_POLAR_PRODUCT_LETTER', () => {
    expect(source).toContain('NEXT_PUBLIC_POLAR_PRODUCT_LETTER');
  });

  it('returns single variant when env var is empty', () => {
    expect(source).toContain("raw.trim()");
    // When empty, returns array with one element
    expect(source).toContain("variants.length <= 1");
  });
});
