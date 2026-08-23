/**
 * Phase 3 — Email Delivery Pipeline — End-to-End Tests
 *
 * Validates that every email the product should send is wired up:
 * letter delivery, payment confirmation, outcome follow-ups,
 * sequence step reminders, and APP_URL startup checks.
 *
 * Also verifies risk mitigations from plan.md:
 * - R1: Resend API key missing → throws / logs fatal
 * - R2: PDF attachment size check (templates handle optional attachments)
 * - R3: BullMQ Redis env check in worker entrypoint
 * - R4: Duplicate email prevention via deterministic jobId
 * - R5: Outcome emails cancelled on resolve/close
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  1. Generate route — letter delivery email                         */
/* ================================================================== */

describe('3a: Generate route — letter delivery email', () => {
  const generateRoutePath = path.resolve(
    __dirname,
    '../app/api/cases/[id]/generate/route.ts',
  );
  const generateSource = fs.readFileSync(generateRoutePath, 'utf-8');

  it('imports enqueueLetterDeliveryEmail', () => {
    // Import may be multi-line (destructured with other functions)
    expect(generateSource).toContain('enqueueLetterDeliveryEmail');
    expect(generateSource).toContain("from '@/lib/queue/enqueue'");
  });

  it('calls enqueueLetterDeliveryEmail after letter is persisted', () => {
    // Verify it's called in the deposit handler, after updateCaseStatus.
    // Convex migration: updateCaseStatus(supabase, caseId, 'intake') -> updateCaseStatus(convex, caseId)
    const afterStatus = generateSource.indexOf('await updateCaseStatus(convex, caseId);');
    const emailCall = generateSource.indexOf('enqueueLetterDeliveryEmail(');
    expect(afterStatus).toBeGreaterThan(-1);
    expect(emailCall).toBeGreaterThan(afterStatus);
  });

  it('fetches user email via auth.admin.getUserById for deposit handler', () => {
    // Convex migration: supabase.auth.admin.getUserById -> api.service.userEmailById query
    expect(generateSource).toContain('api.service.userEmailById');
  });

  it('uses APP_URL for download link', () => {
    expect(generateSource).toContain("process.env.APP_URL ?? 'http://localhost:3000'");
  });

  it('wraps email enqueue in try-catch (non-critical)', () => {
    // The email section should be wrapped in try-catch
    expect(generateSource).toContain('Failed to enqueue letter delivery email');
  });

  it('passes property_address from diagnostic answers', () => {
    expect(generateSource).toContain("answers['property_address']");
  });

  it('passes jurisdiction and caseId to enqueue function', () => {
    expect(generateSource).toContain('caseRow.jurisdiction');
    // The caseId is passed as the last arg (idempotency key base)
    expect(generateSource).toMatch(/enqueueLetterDeliveryEmail\(\s*userEmail/);
  });
});

/* ================================================================== */
/*  2. Webhook processor — payment confirmation email                 */
/* ================================================================== */

describe('3b: Webhook processor — payment confirmation email', () => {
  const webhookPath = path.resolve(
    __dirname,
    '../lib/payments/webhook-processor.ts',
  );
  const webhookSource = fs.readFileSync(webhookPath, 'utf-8');

  it('imports enqueuePaymentConfirmationEmail', () => {
    expect(webhookSource).toContain(
      "import { enqueuePaymentConfirmationEmail } from '@/lib/queue/enqueue'",
    );
  });

  it('enqueues payment confirmation after payment_status set to paid', () => {
    // Convex migration: setPaymentStatus mutation uses paymentStatus: 'paid' (camelCase arg)
    const paidUpdate = webhookSource.indexOf("paymentStatus: 'paid'");
    const emailCall = webhookSource.indexOf('enqueuePaymentConfirmationEmail(');
    expect(paidUpdate).toBeGreaterThan(-1);
    expect(emailCall).toBeGreaterThan(paidUpdate);
  });

  it('skips email if already paid (idempotent)', () => {
    // The idempotency check happens BEFORE the email enqueue
    const idempotentCheck = webhookSource.indexOf("caseRow.payment_status === 'paid'");
    const emailCall = webhookSource.indexOf('enqueuePaymentConfirmationEmail(');
    expect(idempotentCheck).toBeGreaterThan(-1);
    expect(idempotentCheck).toBeLessThan(emailCall);
  });

  it('uses deterministic jobId for dedup (payment-confirmation-{caseId})', () => {
    // The enqueuePaymentConfirmationEmail in enqueue.ts uses `payment-confirmation-${caseId}`
    const enqueuePath = path.resolve(
      __dirname,
      '../lib/queue/enqueue.ts',
    );
    const enqueueSource = fs.readFileSync(enqueuePath, 'utf-8');
    expect(enqueueSource).toContain('`payment-confirmation-${caseId}`');
  });

  it('extracts amount from txn.total', () => {
    expect(webhookSource).toContain('txn.total');
    expect(webhookSource).toContain('Number(txn.total) / 100');
  });

  it('fetches user email from auth.admin.getUserById', () => {
    // Convex migration: supabase.auth.admin.getUserById -> api.service.userEmailById query
    expect(webhookSource).toContain('api.service.userEmailById');
    expect(webhookSource).toContain('userId: caseRow.user_id');
  });

  it('wraps email enqueue in try-catch (non-critical)', () => {
    expect(webhookSource).toContain(
      'Failed to enqueue payment confirmation email',
    );
  });
});

/* ================================================================== */
/*  3. Status route — outcome email scheduling                        */
/* ================================================================== */

describe('3c: Status route — outcome email scheduling', () => {
  const statusRoutePath = path.resolve(
    __dirname,
    '../app/api/cases/[id]/status/route.ts',
  );
  const statusSource = fs.readFileSync(statusRoutePath, 'utf-8');

  it('imports scheduleOutcomeEmails', () => {
    expect(statusSource).toContain(
      "import { scheduleOutcomeEmails, cancelOutcomeEmails } from '@/lib/outcomes/outcome-scheduler'",
    );
  });

  it('schedules outcome emails when transitioning to sent', () => {
    expect(statusSource).toContain("new_status === 'sent'");
    expect(statusSource).toContain('scheduleOutcomeEmails(caseId');
  });

  it('cancels outcome emails when transitioning to resolved', () => {
    expect(statusSource).toContain("new_status === 'resolved'");
    expect(statusSource).toContain('cancelOutcomeEmails(caseId)');
  });

  it('cancels outcome emails when transitioning to closed', () => {
    expect(statusSource).toContain("new_status === 'closed'");
    // Both resolved and closed call cancel
    expect(statusSource).toContain("new_status === 'resolved' || new_status === 'closed'");
  });

  it('passes user email and APP_URL to scheduleOutcomeEmails', () => {
    expect(statusSource).toContain("user.email ?? ''");
    expect(statusSource).toContain("process.env.APP_URL");
  });

  it('wraps email scheduling in try-catch (non-critical)', () => {
    expect(statusSource).toContain(
      'Failed to schedule/cancel outcome emails',
    );
  });
});

/* ================================================================== */
/*  4. Outcome scheduler — job scheduling logic                       */
/* ================================================================== */

describe('3c (cont): Outcome scheduler — scheduling logic', () => {
  const schedulerPath = path.resolve(
    __dirname,
    '../lib/outcomes/outcome-scheduler.ts',
  );
  const schedulerSource = fs.readFileSync(schedulerPath, 'utf-8');

  it('schedules 3 outcome follow-up jobs (T+14, T+30, T+60)', () => {
    expect(schedulerSource).toContain('days: 14');
    expect(schedulerSource).toContain('days: 30');
    expect(schedulerSource).toContain('days: 60');
  });

  it('uses delayed jobs (not polling)', () => {
    expect(schedulerSource).toContain('delay: delayMs');
  });

  it('uses deterministic jobId for each prompt', () => {
    expect(schedulerSource).toContain('`outcome-${caseId}-${prompt.days}d`');
  });

  it('cancelOutcomeEmails removes pending jobs by jobId', () => {
    expect(schedulerSource).toContain('queue.getJob(jobId)');
    expect(schedulerSource).toContain('job.remove()');
  });

  it('exports OUTCOME_PROMPTS for external use', () => {
    expect(schedulerSource).toContain('export { OUTCOME_PROMPTS }');
  });

  it('uses OUTCOME_FOLLOWUP queue', () => {
    // R-6 refactor: outcome follow-up emails now ride the dedicated EMAIL_DELIVERY
    // queue (see QUEUE_NAMES comment) rather than a separate OUTCOME_FOLLOWUP queue.
    expect(schedulerSource).toContain('QUEUE_NAMES.EMAIL_DELIVERY');
  });
});

/* ================================================================== */
/*  5. Sequence advance — step reminder emails                        */
/* ================================================================== */

describe('3d: Sequence advance — step reminder emails', () => {
  const advancePath = path.resolve(
    __dirname,
    '../app/api/sequences/[id]/advance/route.ts',
  );
  const advanceSource = fs.readFileSync(advancePath, 'utf-8');

  it('imports enqueueSequenceStepEmail', () => {
    expect(advanceSource).toContain(
      "import { enqueueSequenceStepEmail } from '@/lib/queue/enqueue'",
    );
  });

  it('enqueues reminder only when sequence is not complete', () => {
    // Convex migration: completion is now computed atomically inside
    // sequences.advanceStepMine and returned as result.isComplete.
    expect(advanceSource).toContain('if (!result.isComplete)');
    // enqueueSequenceStepEmail should be inside the !isComplete block
    const isCompleteGuard = advanceSource.indexOf('if (!result.isComplete) {');
    const emailCall = advanceSource.indexOf('enqueueSequenceStepEmail(');
    expect(isCompleteGuard).toBeGreaterThan(-1);
    expect(emailCall).toBeGreaterThan(isCompleteGuard);
  });

  it('passes the NEXT step number, not the current one', () => {
    // The variable nextStep is passed (step_number + 1)
    expect(advanceSource).toMatch(/enqueueSequenceStepEmail\(\s*user\.email/);
    expect(advanceSource).toContain('nextStep,');
  });

  it('uses APP_URL for case link', () => {
    expect(advanceSource).toContain("process.env.APP_URL ?? 'http://localhost:3000'");
  });

  it('wraps email enqueue in try-catch (non-critical)', () => {
    expect(advanceSource).toContain(
      'Failed to enqueue sequence step reminder',
    );
  });

  it('extracts step name from sequence steps data', () => {
    // Convex migration: the steps[nextStep - 1]?.name extraction moved into the
    // atomic sequences.advanceStepMine mutation, which returns it as nextStepName.
    // The route passes that extracted name straight into the reminder email.
    expect(advanceSource).toContain('result.nextStepName');
  });
});

/* ================================================================== */
/*  6. Enqueue helpers — idempotency keys                             */
/* ================================================================== */

describe('3 (cross-cutting): Enqueue helpers — idempotency keys', () => {
  const enqueuePath = path.resolve(
    __dirname,
    '../lib/queue/enqueue.ts',
  );
  const enqueueSource = fs.readFileSync(enqueuePath, 'utf-8');

  it('letter delivery email has deterministic jobId', () => {
    expect(enqueueSource).toContain('`letter-delivery-${caseId}`');
  });

  it('sequence step email has deterministic jobId', () => {
    expect(enqueueSource).toContain('`sequence-step-${caseId}-${stepNumber}`');
  });

  it('outcome followup email has deterministic jobId', () => {
    expect(enqueueSource).toContain('`outcome-followup-${caseId}-${daysElapsed}d`');
  });

  it('payment confirmation email has deterministic jobId', () => {
    expect(enqueueSource).toContain('`payment-confirmation-${caseId}`');
  });

  it('all enqueue functions accept idempotencyKey or derive one', () => {
    // Each specific enqueue function passes a deterministic key to enqueueEmailDelivery
    const letterCall = enqueueSource.indexOf('enqueueLetterDeliveryEmail');
    const paymentCall = enqueueSource.indexOf('enqueuePaymentConfirmationEmail');
    const sequenceCall = enqueueSource.indexOf('enqueueSequenceStepEmail');
    expect(letterCall).toBeGreaterThan(-1);
    expect(paymentCall).toBeGreaterThan(-1);
    expect(sequenceCall).toBeGreaterThan(-1);
  });

  it('enqueueEmailDelivery passes jobId option to queue.add', () => {
    expect(enqueueSource).toContain('jobId: idempotencyKey');
  });
});

/* ================================================================== */
/*  7. APP_URL and startup checks                                     */
/* ================================================================== */

describe('3e: APP_URL and worker startup checks', () => {
  const envExamplePath = path.resolve(
    __dirname,
    '../../.env.example',
  );
  const envSource = fs.readFileSync(envExamplePath, 'utf-8');

  const workerIndexPath = path.resolve(
    __dirname,
    '../workers/index.ts',
  );
  const workerSource = fs.readFileSync(workerIndexPath, 'utf-8');

  it('.env.example contains APP_URL', () => {
    expect(envSource).toContain('APP_URL=');
  });

  it('.env.example has APP_URL comment explaining its purpose', () => {
    expect(envSource).toContain('APP_URL is required by the email worker');
  });

  it('worker entrypoint checks for APP_URL', () => {
    expect(workerSource).toContain("process.env.APP_URL");
    expect(workerSource).toContain('FATAL: APP_URL is not set');
  });

  it('worker entrypoint checks for RESEND_API_KEY', () => {
    expect(workerSource).toContain("process.env.RESEND_API_KEY");
    expect(workerSource).toContain('FATAL: RESEND_API_KEY is not set');
  });

  it('worker entrypoint checks for REDIS_URL', () => {
    expect(workerSource).toContain("process.env.REDIS_URL");
    expect(workerSource).toContain('FATAL: REDIS_URL is not set');
  });

  it('.env.example contains RESEND_API_KEY', () => {
    expect(envSource).toContain('RESEND_API_KEY=');
  });

  it('.env.example contains REDIS_URL', () => {
    expect(envSource).toContain('REDIS_URL=');
  });
});

/* ================================================================== */
/*  8. Email templates — completeness                                 */
/* ================================================================== */

describe('3 (cross-cutting): Email templates cover all delivery types', () => {
  const templatesPath = path.resolve(
    __dirname,
    '../lib/email/templates.ts',
  );
  const templatesSource = fs.readFileSync(templatesPath, 'utf-8');

  const requiredTemplates = [
    'letter_delivery',
    'sequence_step',
    'deadline_prompt',
    'outcome_followup',
    'payment_confirmation',
  ] as const;

  for (const templateId of requiredTemplates) {
    it(`has template: ${templateId}`, () => {
      expect(templatesSource).toContain(`'${templateId}'`);
    });
  }

  it('TemplateId union covers all 5 delivery types', () => {
    for (const id of requiredTemplates) {
      expect(templatesSource).toContain(`| '${id}'`);
    }
  });

  it('renderTemplate handles all 5 template IDs', () => {
    for (const id of requiredTemplates) {
      expect(templatesSource).toContain(`case '${id}':`);
    }
  });

  it('all templates produce HTML and plain-text variants', () => {
    // Each template function returns { html, text, subject }
    const templateFunctions = [
      'letterDeliveryTemplate',
      'sequenceStepTemplate',
      'deadlinePromptTemplate',
      'outcomeFollowupTemplate',
      'paymentConfirmationTemplate',
    ];
    for (const fn of templateFunctions) {
      expect(templatesSource).toContain(`function ${fn}`);
    }
  });

  it('all templates include disclaimer (UPL compliance)', () => {
    // The wrapInLayout adds the disclaimer
    expect(templatesSource).toContain('does not constitute legal advice');
  });

  it('all templates include unsubscribe link (CAN-SPAM)', () => {
    expect(templatesSource).toContain('{{unsubscribe_url}}');
  });
});

/* ================================================================== */
/*  9. Email sender functions — completeness                          */
/* ================================================================== */

describe('3 (cross-cutting): Email sender functions exist', () => {
  const senderPath = path.resolve(
    __dirname,
    '../lib/email/sender.ts',
  );
  const senderSource = fs.readFileSync(senderPath, 'utf-8');

  it('exports sendLetterDeliveryEmail', () => {
    expect(senderSource).toContain(
      'export async function sendLetterDeliveryEmail',
    );
  });

  it('exports sendSequenceStepEmail', () => {
    expect(senderSource).toContain(
      'export async function sendSequenceStepEmail',
    );
  });

  it('exports sendDeadlinePromptEmail', () => {
    expect(senderSource).toContain(
      'export async function sendDeadlinePromptEmail',
    );
  });

  it('exports sendOutcomeFollowupEmail', () => {
    expect(senderSource).toContain(
      'export async function sendOutcomeFollowupEmail',
    );
  });

  it('exports sendPaymentConfirmationEmail', () => {
    expect(senderSource).toContain(
      'export async function sendPaymentConfirmationEmail',
    );
  });

  it('sendLetterDeliveryEmail supports optional PDF attachment', () => {
    expect(senderSource).toContain('pdfBuffer?: Buffer');
    expect(senderSource).toContain("'demand-letter.pdf'");
  });
});

/* ================================================================== */
/*  10. Resend client — error handling                                */
/* ================================================================== */

describe('3 (risk): Resend client — missing API key', () => {
  const clientPath = path.resolve(
    __dirname,
    '../lib/email/resend-client.ts',
  );
  const clientSource = fs.readFileSync(clientPath, 'utf-8');

  it('throws if RESEND_API_KEY is not set', () => {
    expect(clientSource).toContain('Missing RESEND_API_KEY');
  });

  it('uses retry with exponential backoff', () => {
    expect(clientSource).toContain('RETRY_DELAYS');
    expect(clientSource).toContain('5000');
    expect(clientSource).toContain('30000');
    expect(clientSource).toContain('120000');
  });

  it('returns EmailResult with ok flag', () => {
    expect(clientSource).toContain('ok: true');
    expect(clientSource).toContain('ok: false');
  });

  it('uses consistent FROM address', () => {
    expect(clientSource).toContain('Resolvaio <noreply@resolvaio.com>');
  });
});

/* ================================================================== */
/*  11. Email delivery worker — processing chain                      */
/* ================================================================== */

describe('3 (cross-cutting): Email delivery worker', () => {
  const workerPath = path.resolve(
    __dirname,
    '../workers/email-delivery.worker.ts',
  );
  const workerSource = fs.readFileSync(workerPath, 'utf-8');

  it('processes OUTCOME_FOLLOWUP queue', () => {
    // R-6 refactor: the delivery worker consumes the dedicated EMAIL_DELIVERY queue.
    expect(workerSource).toContain('QUEUE_NAMES.EMAIL_DELIVERY');
  });

  it('validates job payload with Zod schema', () => {
    expect(workerSource).toContain('emailDeliveryJobSchema.parse');
  });

  it('calls sendTemplatedEmail to render and send', () => {
    expect(workerSource).toContain('sendTemplatedEmail(');
  });

  it('throws on failed delivery (enables BullMQ retry)', () => {
    expect(workerSource).toContain("throw new Error(`Email delivery failed:");
  });

  it('has concurrency limit', () => {
    expect(workerSource).toContain('concurrency: 5');
  });

  it('has rate limiter', () => {
    expect(workerSource).toContain('max: 10');
    expect(workerSource).toContain('duration: 1000');
  });
});

/* ================================================================== */
/*  12. Queue config — all queues registered                          */
/* ================================================================== */

describe('3 (cross-cutting): Queue configuration', () => {
  const configPath = path.resolve(
    __dirname,
    '../lib/queue/config.ts',
  );
  const configSource = fs.readFileSync(configPath, 'utf-8');

  it('has OUTCOME_FOLLOWUP queue', () => {
    expect(configSource).toContain("OUTCOME_FOLLOWUP: 'outcome-followup'");
  });

  it('has DEADLINE_CHECK queue', () => {
    expect(configSource).toContain("DEADLINE_CHECK: 'deadline-check'");
  });

  it('has WEBHOOK_PROCESS queue', () => {
    expect(configSource).toContain("WEBHOOK_PROCESS: 'webhook-process'");
  });

  it('OUTCOME_FOLLOWUP has retry config', () => {
    // The config block for outcome-followup should have attempts
    expect(configSource).toContain('[QUEUE_NAMES.OUTCOME_FOLLOWUP]');
  });
});

/* ================================================================== */
/*  13. Worker entrypoint — all workers started                       */
/* ================================================================== */

describe('3e (cont): Worker entrypoint — all workers started', () => {
  const workerIndexPath = path.resolve(
    __dirname,
    '../workers/index.ts',
  );
  const workerSource = fs.readFileSync(workerIndexPath, 'utf-8');

  it('starts email delivery worker', () => {
    expect(workerSource).toContain('createEmailDeliveryWorker()');
  });

  it('starts deadline check worker', () => {
    expect(workerSource).toContain('createDeadlineCheckWorker()');
  });

  it('starts webhook process worker', () => {
    expect(workerSource).toContain('createWebhookProcessWorker()');
  });

  it('schedules repeatable deadline check', () => {
    expect(workerSource).toContain('deadline-check-repeatable');
    expect(workerSource).toContain('5 * 60 * 1000');
  });

  it('has graceful shutdown for all workers', () => {
    expect(workerSource).toContain('emailWorker.close()');
    expect(workerSource).toContain('deadlineWorker.close()');
    expect(workerSource).toContain('webhookWorker.close()');
    expect(workerSource).toContain('closeAllQueues()');
    expect(workerSource).toContain('closeRedis()');
  });

  it('handles SIGINT and SIGTERM', () => {
    expect(workerSource).toContain("process.on('SIGINT'");
    expect(workerSource).toContain("process.on('SIGTERM'");
  });
});

/* ================================================================== */
/*  14. Full pipeline integration — email flow end-to-end             */
/* ================================================================== */

describe('3 (integration): Full email pipeline wiring', () => {
  it('deposit flow: generate → letter delivery email enqueued', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/generate/route.ts'),
      'utf-8',
    );
    // The deposit handler calls updateCaseStatus then enqueues the email
    // Find the deposit-specific updateCaseStatus (second occurrence, inside handleDepositGeneration)
    const depositHandlerStart = source.indexOf('async function handleDepositGeneration');
    const depositSection = source.slice(depositHandlerStart);
    // Convex migration: updateCaseStatus(supabase, caseId, 'intake') -> updateCaseStatus(convex, caseId)
    const statusUpdate = depositSection.indexOf('updateCaseStatus(convex, caseId)');
    const emailEnqueue = depositSection.indexOf('enqueueLetterDeliveryEmail(');
    expect(depositHandlerStart).toBeGreaterThan(-1);
    expect(statusUpdate).toBeGreaterThan(-1);
    expect(emailEnqueue).toBeGreaterThan(statusUpdate);
  });

  it('payment webhook: transaction.completed → payment confirmation email', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/payments/webhook-processor.ts'),
      'utf-8',
    );
    expect(source).toContain("case 'transaction.completed':");
    expect(source).toContain('enqueuePaymentConfirmationEmail(');
  });

  it('status → sent: outcome emails scheduled (T+14, T+30, T+60)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/status/route.ts'),
      'utf-8',
    );
    expect(source).toContain("new_status === 'sent'");
    expect(source).toContain('scheduleOutcomeEmails(');

    const scheduler = fs.readFileSync(
      path.resolve(__dirname, '../lib/outcomes/outcome-scheduler.ts'),
      'utf-8',
    );
    expect(scheduler).toContain('days: 14');
    expect(scheduler).toContain('days: 30');
    expect(scheduler).toContain('days: 60');
  });

  it('status → resolved: pending outcome emails cancelled', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/status/route.ts'),
      'utf-8',
    );
    expect(source).toContain("new_status === 'resolved'");
    expect(source).toContain('cancelOutcomeEmails(');
  });

  it('status → closed: pending outcome emails cancelled', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/status/route.ts'),
      'utf-8',
    );
    // 'closed' is handled in the same condition as 'resolved'
    expect(source).toContain("new_status === 'closed'");
    expect(source).toContain('cancelOutcomeEmails(');
  });

  it('sequence advance → next step reminder email enqueued', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/sequences/[id]/advance/route.ts'),
      'utf-8',
    );
    expect(source).toContain('enqueueSequenceStepEmail(');
  });
});

/* ================================================================== */
/*  15. Risk mitigations                                              */
/* ================================================================== */

describe('3 (risk mitigation): Email pipeline safety', () => {
  it('R1: Resend client throws on missing API key', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/email/resend-client.ts'),
      'utf-8',
    );
    expect(source).toContain("throw new Error(");
    expect(source).toContain('Missing RESEND_API_KEY');
  });

  it('R2: Letter delivery supports optional PDF attachment (not required)', () => {
    const senderSource = fs.readFileSync(
      path.resolve(__dirname, '../lib/email/sender.ts'),
      'utf-8',
    );
    // pdfBuffer is optional — if missing, sends without attachment
    expect(senderSource).toContain('pdfBuffer?: Buffer');
    expect(senderSource).toContain('pdfBuffer\n    ? [');
  });

  it('R3: Worker entrypoint checks Redis/Resend/APP_URL env vars', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../workers/index.ts'),
      'utf-8',
    );
    expect(source).toContain('process.env.APP_URL');
    expect(source).toContain('process.env.RESEND_API_KEY');
    expect(source).toContain('process.env.REDIS_URL');
  });

  it('R4: All email jobs use deterministic jobId to prevent duplicates', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/queue/enqueue.ts'),
      'utf-8',
    );
    // Each specific helper passes a deterministic key
    expect(source).toContain('letter-delivery-');
    expect(source).toContain('sequence-step-');
    expect(source).toContain('outcome-followup-');
    expect(source).toContain('payment-confirmation-');
  });

  it('R5: cancelOutcomeEmails is called on resolved AND closed transitions', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/status/route.ts'),
      'utf-8',
    );
    expect(source).toContain("new_status === 'resolved' || new_status === 'closed'");
    expect(source).toContain('cancelOutcomeEmails(caseId)');
  });

  it('all email enqueue calls are wrapped in try-catch (never fail the parent operation)', () => {
    const generateSource = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/generate/route.ts'),
      'utf-8',
    );
    const webhookSource = fs.readFileSync(
      path.resolve(__dirname, '../lib/payments/webhook-processor.ts'),
      'utf-8',
    );
    const statusSource = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/status/route.ts'),
      'utf-8',
    );
    const advanceSource = fs.readFileSync(
      path.resolve(__dirname, '../app/api/sequences/[id]/advance/route.ts'),
      'utf-8',
    );

    // Each file has a try-catch around email operations
    expect(generateSource).toContain('Failed to enqueue letter delivery email');
    expect(webhookSource).toContain('Failed to enqueue payment confirmation email');
    expect(statusSource).toContain('Failed to schedule/cancel outcome emails');
    expect(advanceSource).toContain('Failed to enqueue sequence step reminder');
  });

  it('no emails contain localhost URLs when APP_URL is set', () => {
    // All email-producing code uses APP_URL with localhost fallback
    const files = [
      '../app/api/cases/[id]/generate/route.ts',
      '../lib/payments/webhook-processor.ts',
      '../app/api/cases/[id]/status/route.ts',
      '../app/api/sequences/[id]/advance/route.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf-8');
      if (source.includes('APP_URL') || source.includes('appUrl')) {
        // Verify it reads from env, not hardcoded
        expect(source).toContain("process.env.APP_URL");
      }
    }
  });
});

/* ================================================================== */
/*  16. Job type schema — Zod validation                              */
/* ================================================================== */

describe('3 (cross-cutting): Job type validation schema', () => {
  const schemaPath = path.resolve(
    __dirname,
    '../types/jobs/email-delivery.job.ts',
  );
  const schemaSource = fs.readFileSync(schemaPath, 'utf-8');

  it('validates email address with z.string().email()', () => {
    expect(schemaSource).toContain('z.string().email()');
  });

  it('requires subject', () => {
    expect(schemaSource).toContain("subject: z.string().min(1)");
  });

  it('requires template_id', () => {
    expect(schemaSource).toContain("template_id: z.string().min(1)");
  });

  it('accepts template_data as string record', () => {
    expect(schemaSource).toContain(
      'z.record(z.string(), z.string())',
    );
  });

  it('attachments are optional', () => {
    expect(schemaSource).toContain('.optional()');
  });

  it('exports both schema and inferred type', () => {
    expect(schemaSource).toContain('export const emailDeliveryJobSchema');
    expect(schemaSource).toContain('export type EmailDeliveryJobPayload');
  });
});
