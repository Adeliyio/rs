/**
 * Email templates — server-only.
 *
 * Generates HTML email bodies for different delivery scenarios.
 * All templates include the CAN-SPAM unsubscribe link and are
 * designed to work as both HTML and plain-text fallback.
 */

/* ------------------------------------------------------------------ */
/*  Template types                                                    */
/* ------------------------------------------------------------------ */

export type TemplateId =
  | 'letter_delivery'
  | 'sequence_step'
  | 'deadline_prompt'
  | 'outcome_followup'
  | 'payment_confirmation'
  | 'statute_amendment_alert';

export interface TemplateData {
  [key: string]: string;
}

/* ------------------------------------------------------------------ */
/*  Common wrapper                                                    */
/* ------------------------------------------------------------------ */

function wrapInLayout(bodyHtml: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${preheader ? `<meta name="x-preheader" content="${escapeHtml(preheader)}" />` : ''}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 20px; margin: 0; }
    .content { margin-bottom: 32px; }
    .content p { margin: 0 0 16px 0; }
    .cta { display: inline-block; background: #1a1a1a; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; }
    .footer { border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #666; }
    .disclaimer { font-size: 11px; color: #999; margin-top: 16px; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    ${bodyHtml}
    <div class="footer">
      <p>Resolvaio &mdash; Writing assistance for consumer disputes</p>
      <p class="disclaimer">This email and any attachments were drafted with writing assistance and do not constitute legal advice. Review all content before sending.</p>
      <p><a href="{{unsubscribe_url}}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  HTML escaping (SEC-07)                                            */
/* ------------------------------------------------------------------ */

/**
 * Escapes HTML special characters in template data to prevent XSS.
 * Applied to all user-derived values interpolated into HTML emails.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates and escapes a URL for use in href attributes.
 * Only allows http:, https:, and # (fallback). Prevents javascript: and data: URIs.
 */
function escapeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '#' || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return escapeHtml(trimmed);
  }
  return '#';
}

/* ------------------------------------------------------------------ */
/*  Individual templates                                              */
/* ------------------------------------------------------------------ */

function letterDeliveryTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const jurisdiction = escapeHtml(data['jurisdiction'] ?? 'your state');
  const propertyAddress = escapeHtml(data['property_address'] ?? 'your property');
  const downloadUrl = escapeUrl(data['download_url'] ?? '#');

  const html = wrapInLayout(
    `<div class="header">
      <h1>Your Demand Letter Is Ready</h1>
    </div>
    <div class="content">
      <p>Your security deposit demand letter for ${propertyAddress} (${jurisdiction}) has been generated and is ready for your review.</p>
      <p><strong>Before sending:</strong></p>
      <ul>
        <li>Review every detail in the letter carefully</li>
        <li>Verify all names, addresses, dates, and amounts</li>
        <li>Print and sign the letter</li>
        <li>Send via certified mail with return receipt</li>
        <li>Keep a copy for your records</li>
      </ul>
      <p><a class="cta" href="${downloadUrl}">Download Your Letter (PDF)</a></p>
      <p style="font-size: 13px; color: #666;">You can also access your letter anytime by logging into your account.</p>
    </div>`,
    'Your demand letter is ready for review and download.',
  );

  const rawAddress = data['property_address'] ?? 'your property';
  const rawJurisdiction = data['jurisdiction'] ?? 'your state';
  const text = `Your Demand Letter Is Ready

Your security deposit demand letter for ${rawAddress} (${rawJurisdiction}) has been generated.

Before sending:
- Review every detail carefully
- Verify all names, addresses, dates, and amounts
- Print and sign the letter
- Send via certified mail with return receipt
- Keep a copy for your records

Download: ${data['download_url'] ?? 'Log in to your account'}

---
This email was drafted with writing assistance and does not constitute legal advice.`;

  return {
    html,
    text,
    subject: `Your Demand Letter for ${rawAddress} Is Ready`,
  };
}

function sequenceStepTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const stepNumber = escapeHtml(data['step_number'] ?? '1');
  const companyName = escapeHtml(data['company_name'] ?? 'the company');
  const stepName = escapeHtml(data['step_name'] ?? 'Cancellation Email');
  const caseUrl = escapeUrl(data['case_url'] ?? '#');

  const html = wrapInLayout(
    `<div class="header">
      <h1>Time to Send Email ${stepNumber}: ${stepName}</h1>
    </div>
    <div class="content">
      <p>It's time to send the next email in your cancellation sequence to ${companyName}.</p>
      <p><strong>Email ${stepNumber}:</strong> ${stepName}</p>
      <p>Log in to view the full email text, review it, and send it to ${companyName}.</p>
      <p><a class="cta" href="${caseUrl}">View &amp; Send Email</a></p>
      <p style="font-size: 13px; color: #666;">Remember to review the email content and personalize it before sending.</p>
    </div>`,
    `Time to send cancellation email ${stepNumber} to ${companyName}.`,
  );

  const rawStep = data['step_number'] ?? '1';
  const rawCompany = data['company_name'] ?? 'the company';
  const rawName = data['step_name'] ?? 'Cancellation Email';
  const text = `Time to Send Email ${rawStep}: ${rawName}

It's time to send the next email in your cancellation sequence to ${rawCompany}.

Log in to view and send: ${data['case_url'] ?? 'Log in to your account'}

---
This email was drafted with writing assistance and does not constitute legal advice.`;

  return {
    html,
    text,
    subject: `Action Needed: Send Email ${rawStep} to ${rawCompany}`,
  };
}

function deadlinePromptTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const deadlineDate = escapeHtml(data['deadline_date'] ?? 'soon');
  const promptMessage = escapeHtml(data['prompt_message'] ?? 'A deadline is approaching.');
  const daysRemaining = escapeHtml(data['days_remaining'] ?? '?');
  const caseUrl = escapeUrl(data['case_url'] ?? '#');

  const html = wrapInLayout(
    `<div class="header">
      <h1>Deadline Approaching: ${daysRemaining} Days Remaining</h1>
    </div>
    <div class="content">
      <p>${promptMessage}</p>
      <p><strong>Deadline date:</strong> ${deadlineDate}</p>
      <p>Log in to your account to review your case status and next steps.</p>
      <p><a class="cta" href="${caseUrl}">View Your Case</a></p>
    </div>`,
    `Deadline approaching: ${daysRemaining} days remaining.`,
  );

  const rawDays = data['days_remaining'] ?? '?';
  const rawMessage = data['prompt_message'] ?? 'A deadline is approaching.';
  const rawDate = data['deadline_date'] ?? 'soon';
  const text = `Deadline Approaching: ${rawDays} Days Remaining

${rawMessage}

Deadline date: ${rawDate}

View your case: ${data['case_url'] ?? 'Log in to your account'}

---
This email was drafted with writing assistance and does not constitute legal advice.`;

  return {
    html,
    text,
    subject: `Deadline Approaching: ${rawDays} Days Remaining`,
  };
}

function outcomeFollowupTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const daysElapsed = escapeHtml(data['days_elapsed'] ?? '14');
  const outcomeUrl = escapeUrl(data['outcome_url'] ?? '#');

  const html = wrapInLayout(
    `<div class="header">
      <h1>How Did It Go?</h1>
    </div>
    <div class="content">
      <p>It's been ${daysElapsed} days since your letter was sent. We'd like to know how things are going.</p>
      <p>Your feedback helps us improve and helps other consumers in similar situations understand what to expect.</p>
      <p><a class="cta" href="${outcomeUrl}">Share Your Outcome</a></p>
      <p style="font-size: 13px; color: #666;">This is completely optional. Your information remains private unless you choose to share.</p>
    </div>`,
    `It's been ${daysElapsed} days — how did it go?`,
  );

  const rawDays = data['days_elapsed'] ?? '14';
  const text = `How Did It Go?

It's been ${rawDays} days since your letter was sent. We'd like to know how things are going.

Share your outcome: ${data['outcome_url'] ?? 'Log in to your account'}

---
This is completely optional. Your information remains private unless you choose to share.`;

  return {
    html,
    text,
    subject: `How Did It Go? Share Your Outcome`,
  };
}

function paymentConfirmationTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const amount = escapeHtml(data['amount'] ?? '$49');
  const productName = escapeHtml(data['product_name'] ?? 'Security Deposit Letter');
  const caseUrl = escapeUrl(data['case_url'] ?? '#');

  const html = wrapInLayout(
    `<div class="header">
      <h1>Payment Confirmed</h1>
    </div>
    <div class="content">
      <p>Thank you for your purchase.</p>
      <p><strong>Product:</strong> ${productName}<br/>
         <strong>Amount:</strong> ${amount}</p>
      <p>Your letter is being generated now. You'll receive another email when it's ready for download.</p>
      <p><strong>What to expect:</strong></p>
      <ul>
        <li>This tool generates writing assistance, not legal advice</li>
        <li>Review all content carefully before sending</li>
        <li>Individual results vary based on the specific circumstances of each case</li>
      </ul>
      <p><a class="cta" href="${caseUrl}">View Your Case</a></p>
    </div>`,
    `Payment confirmed for ${productName}.`,
  );

  const rawProduct = data['product_name'] ?? 'Security Deposit Letter';
  const rawAmount = data['amount'] ?? '$49';
  const text = `Payment Confirmed

Product: ${rawProduct}
Amount: ${rawAmount}

Your letter is being generated. You'll receive another email when it's ready.

What to expect:
- This tool generates writing assistance, not legal advice
- Review all content carefully before sending
- Individual results vary based on specific circumstances

View your case: ${data['case_url'] ?? 'Log in to your account'}`;

  return {
    html,
    text,
    subject: `Payment Confirmed — ${rawProduct}`,
  };
}

function statuteAmendmentAlertTemplate(data: TemplateData): {
  html: string;
  text: string;
  subject: string;
} {
  const citation = escapeHtml(data['citation'] ?? 'Unknown Statute');
  const jurisdiction = escapeHtml(data['jurisdiction'] ?? '??');
  const changeSummary = escapeHtml(data['change_summary'] ?? 'No details available.');
  const severity = escapeHtml(data['severity'] ?? 'info');
  const confidence = escapeHtml(data['confidence'] ?? '0');
  const sourceUrls = (data['source_urls'] ?? '').split('\n').filter(Boolean);
  const kbEntryId = escapeHtml(data['kb_entry_id'] ?? 'unknown');
  const dashboardUrl = escapeUrl(data['dashboard_url'] ?? '#');

  const severityColor =
    severity === 'critical' ? '#dc2626' :
    severity === 'warning' ? '#d97706' :
    '#2563eb';

  const severityLabel =
    severity === 'critical' ? 'CRITICAL' :
    severity === 'warning' ? 'WARNING' :
    'INFO';

  const sourceUrlsHtml = sourceUrls.length > 0
    ? sourceUrls.map((u) => `<li><a href="${escapeUrl(u)}" style="color: #2563eb; word-break: break-all;">${escapeHtml(u)}</a></li>`).join('')
    : '<li>No source URLs available</li>';

  const html = wrapInLayout(
    `<div class="header">
      <h1>Potential Statute Amendment Detected</h1>
    </div>
    <div class="content">
      <div style="background: ${severityColor}15; border-left: 4px solid ${severityColor}; padding: 12px 16px; margin-bottom: 16px;">
        <p style="margin: 0; font-weight: 600; color: ${severityColor};">${severityLabel}: ${citation} (${jurisdiction})</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Confidence: ${confidence}%</p>
      </div>
      <p><strong>Summary of detected change:</strong></p>
      <p>${changeSummary}</p>
      <p><strong>Affected KB entry:</strong> ${kbEntryId}</p>
      <p><strong>Sources:</strong></p>
      <ul style="font-size: 13px;">${sourceUrlsHtml}</ul>
      <p><a class="cta" href="${dashboardUrl}">Review in Admin Dashboard</a></p>
      <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 16px; margin-top: 16px; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; font-weight: 600; color: #92400e;">This is an AI-detected change. Please verify against official sources before updating the KB.</p>
      </div>
    </div>`,
    `Potential amendment detected: ${citation} (${jurisdiction})`,
  );

  const rawCitation = data['citation'] ?? 'Unknown Statute';
  const rawJurisdiction = data['jurisdiction'] ?? '??';
  const rawSummary = data['change_summary'] ?? 'No details available.';
  const rawSeverity = data['severity'] ?? 'info';
  const rawConfidence = data['confidence'] ?? '0';
  const rawKbEntryId = data['kb_entry_id'] ?? 'unknown';
  const rawSourceUrls = (data['source_urls'] ?? '').split('\n').filter(Boolean);

  const text = `Potential Statute Amendment Detected

${rawSeverity.toUpperCase()}: ${rawCitation} (${rawJurisdiction})
Confidence: ${rawConfidence}%

Summary of detected change:
${rawSummary}

Affected KB entry: ${rawKbEntryId}

Sources:
${rawSourceUrls.length > 0 ? rawSourceUrls.map((u) => `- ${u}`).join('\n') : '- No source URLs available'}

Review in Admin Dashboard: ${data['dashboard_url'] ?? 'Log in to your admin account'}

IMPORTANT: This is an AI-detected change. Please verify against official sources before updating the KB.

---
This email was generated by the Resolvaio Law Monitor system.`;

  return {
    html,
    text,
    subject: `[Action Required] Potential amendment detected: ${rawCitation}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Template resolver                                                 */
/* ------------------------------------------------------------------ */

/**
 * Renders an email template by ID with the given data.
 */
export function renderTemplate(
  templateId: TemplateId,
  data: TemplateData,
): { html: string; text: string; subject: string } {
  switch (templateId) {
    case 'letter_delivery':
      return letterDeliveryTemplate(data);
    case 'sequence_step':
      return sequenceStepTemplate(data);
    case 'deadline_prompt':
      return deadlinePromptTemplate(data);
    case 'outcome_followup':
      return outcomeFollowupTemplate(data);
    case 'payment_confirmation':
      return paymentConfirmationTemplate(data);
    case 'statute_amendment_alert':
      return statuteAmendmentAlertTemplate(data);
    default: {
      const _exhaustive: never = templateId;
      throw new Error(`Unknown template ID: ${_exhaustive}`);
    }
  }
}

// Export for testing (SEC-07)
export { escapeHtml, escapeUrl };
