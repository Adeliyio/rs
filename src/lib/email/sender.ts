/**
 * Email sender — server-only.
 *
 * High-level email delivery functions that combine template
 * rendering with Resend sending. Each function handles a specific
 * delivery scenario.
 *
 * All emails are supplementary — in-app access is always available.
 */

import { sendEmail, type EmailResult } from '@/lib/email/resend-client';
import { renderTemplate, type TemplateId, type TemplateData } from '@/lib/email/templates';

/* ------------------------------------------------------------------ */
/*  Generic template sender                                           */
/* ------------------------------------------------------------------ */

/**
 * Renders a template and sends it via Resend.
 */
export async function sendTemplatedEmail(
  to: string,
  templateId: TemplateId,
  data: TemplateData,
  attachments?: {
    filename: string;
    content: Buffer | string;
    content_type?: string;
  }[],
): Promise<EmailResult> {
  const { html, text, subject } = renderTemplate(templateId, data);

  return sendEmail({
    to,
    subject,
    html,
    text,
    attachments,
  });
}

/* ------------------------------------------------------------------ */
/*  Specific senders                                                  */
/* ------------------------------------------------------------------ */

/**
 * Sends the letter delivery email with PDF attachment.
 */
export async function sendLetterDeliveryEmail(
  to: string,
  jurisdiction: string,
  propertyAddress: string,
  downloadUrl: string,
  pdfBuffer?: Buffer,
): Promise<EmailResult> {
  const attachments = pdfBuffer
    ? [
        {
          filename: 'demand-letter.pdf',
          content: pdfBuffer,
          content_type: 'application/pdf',
        },
      ]
    : undefined;

  return sendTemplatedEmail(
    to,
    'letter_delivery',
    {
      jurisdiction,
      property_address: propertyAddress,
      download_url: downloadUrl,
    },
    attachments,
  );
}

/**
 * Sends a sequence step reminder email.
 */
export async function sendSequenceStepEmail(
  to: string,
  stepNumber: string,
  stepName: string,
  companyName: string,
  caseUrl: string,
): Promise<EmailResult> {
  return sendTemplatedEmail(to, 'sequence_step', {
    step_number: stepNumber,
    step_name: stepName,
    company_name: companyName,
    case_url: caseUrl,
  });
}

/**
 * Sends a deadline prompt email.
 */
export async function sendDeadlinePromptEmail(
  to: string,
  deadlineDate: string,
  daysRemaining: string,
  promptMessage: string,
  caseUrl: string,
): Promise<EmailResult> {
  return sendTemplatedEmail(to, 'deadline_prompt', {
    deadline_date: deadlineDate,
    days_remaining: daysRemaining,
    prompt_message: promptMessage,
    case_url: caseUrl,
  });
}

/**
 * Sends an outcome follow-up email.
 */
export async function sendOutcomeFollowupEmail(
  to: string,
  daysElapsed: string,
  outcomeUrl: string,
): Promise<EmailResult> {
  return sendTemplatedEmail(to, 'outcome_followup', {
    days_elapsed: daysElapsed,
    outcome_url: outcomeUrl,
  });
}

/**
 * Sends a payment confirmation email.
 */
export async function sendPaymentConfirmationEmail(
  to: string,
  amount: string,
  productName: string,
  caseUrl: string,
): Promise<EmailResult> {
  return sendTemplatedEmail(to, 'payment_confirmation', {
    amount,
    product_name: productName,
    case_url: caseUrl,
  });
}
