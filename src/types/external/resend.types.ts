/* ------------------------------------------------------------------ */
/*  Resend external API types                                         */
/* ------------------------------------------------------------------ */

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  content_type?: string;
}

export interface SendEmailRequest {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResponse {
  id: string;
}
