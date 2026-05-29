'use client';

import { useState, useCallback } from 'react';
import {
  ArrowRight,
  Calendar,
  Download,
  FileText,
  Loader2,
  Receipt,
  Shield,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { CaseStatus, Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Deadline {
  label: string;
  date: string;
  is_past: boolean;
}

export interface CaseDetailData {
  id: string;
  wedge: Wedge;
  jurisdiction: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  deposit_amount?: number;
  landlord_name?: string;
  provider_name?: string;
  next_deadline?: Deadline;
  has_letter: boolean;
  has_packet: boolean;
  documents_count: number;
  letter_generated_at?: string;
  packet_url?: string;
}

export interface CaseDetailActions {
  onContinue?: () => void;
  onDownloadPdf?: () => void;
  onMarkSent?: () => void;
  onReportResponse?: () => void;
  onDownloadPacket?: () => void;
  onShareExperience?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<CaseStatus, { label: string; step: number }> = {
  intake: { label: 'Gathering Info', step: 1 },
  generated: { label: 'Letter Ready', step: 2 },
  sent: { label: 'Letter Sent', step: 3 },
  awaiting: { label: 'Awaiting Response', step: 4 },
  escalation_drafted: { label: 'Escalation Ready', step: 5 },
  resolved: { label: 'Resolved', step: 5 },
  closed: { label: 'Closed', step: 5 },
};

/* #4 — renamed labels */
const STEPS = [
  { key: 'intake', label: 'Intake' },
  { key: 'generated', label: 'Letter' },
  { key: 'sent', label: 'Sent' },
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'resolved', label: 'Resolved' },
] as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Next Action Card                                                   */
/* ------------------------------------------------------------------ */

function NextAction({
  caseData,
  actions,
}: {
  caseData: CaseDetailData;
  actions?: CaseDetailActions;
}): React.JSX.Element {
  const { status } = caseData;

  if (status === 'intake') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div className="h-8 w-0.5 shrink-0 rounded-full bg-blue-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Continue your diagnostic</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Answer a few more questions so we can generate your letter.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
          onClick={actions?.onContinue}
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (status === 'generated') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div className="h-8 w-0.5 shrink-0 rounded-full bg-blue-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Your letter is ready</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Download it, review it, and send it via certified mail.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={actions?.onDownloadPdf}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
            onClick={actions?.onMarkSent}
          >
            Mark as Sent
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'sent' || status === 'awaiting') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div className="h-8 w-0.5 shrink-0 rounded-full bg-blue-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Waiting for a response</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            People in similar situations commonly wait for the statutory period
            to expire. We&apos;ll guide you on next steps if needed.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
          onClick={actions?.onReportResponse}
        >
          Report Response
        </Button>
      </div>
    );
  }

  if (status === 'escalation_drafted') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div className="h-8 w-0.5 shrink-0 rounded-full bg-blue-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Escalation packet ready</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your filing documents are prepared. Download them and follow the
            step-by-step filing instructions.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
          onClick={actions?.onDownloadPacket}
        >
          <Download className="h-3.5 w-3.5" />
          Download Packet
        </Button>
      </div>
    );
  }

  if (status === 'resolved') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div className="h-8 w-0.5 shrink-0 rounded-full bg-emerald-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Case resolved</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your case has been marked as resolved. Would you like to share your
            experience to help others?
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-muted-foreground"
          onClick={actions?.onShareExperience}
        >
          Share Experience
        </Button>
      </div>
    );
  }

  return <></>;
}

/* ------------------------------------------------------------------ */
/*  Segmented Progress Bar                                             */
/* ------------------------------------------------------------------ */

function ProgressBar({ status }: { status: CaseStatus }): React.JSX.Element {
  const currentStep = STATUS_CONFIG[status].step;

  return (
    <div>
      <div className="flex gap-1.5">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div
              key={step.key}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                isCompleted && 'bg-emerald-500',
                isCurrent && 'bg-blue-500',
                !isCompleted && !isCurrent && 'bg-border'
              )}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === currentStep;
          return (
            <div key={step.key} className="flex-1">
              <span
                className={cn(
                  'text-[11px]',
                  isCurrent
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function CaseDetail({
  caseData,
  actions,
}: {
  caseData: CaseDetailData;
  actions?: CaseDetailActions;
}): React.JSX.Element {
  const config = STATUS_CONFIG[caseData.status];
  const WedgeIcon = caseData.wedge === 'deposit' ? Shield : Receipt;
  const wedgeLabel =
    caseData.wedge === 'deposit' ? 'Security Deposit Recovery' : 'Subscription Cancellation';

  /* ---- Inline action handlers for generated status ---- */
  const [pdfLoading, setPdfLoading] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (actions?.onDownloadPdf) {
      actions.onDownloadPdf();
      return;
    }
    setPdfLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/pdf`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'PDF generation failed');
      }
      const data = (await res.json()) as { pdf_url: string };
      window.open(data.pdf_url, '_blank');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [actions, caseData.id]);

  const handleMarkSent = useCallback(async () => {
    if (actions?.onMarkSent) {
      actions.onMarkSent();
      return;
    }
    setMarkingSent(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: 'sent' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to update status');
      }
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as sent');
    } finally {
      setMarkingSent(false);
    }
  }, [actions, caseData.id]);

  const handleDownloadPacket = useCallback(() => {
    if (actions?.onDownloadPacket) {
      actions.onDownloadPacket();
      return;
    }
    if (caseData.packet_url) {
      window.open(caseData.packet_url, '_blank');
    }
  }, [actions, caseData.packet_url]);

  const builtActions: CaseDetailActions = {
    ...actions,
    onDownloadPdf: () => void handleDownloadPdf(),
    onMarkSent: () => void handleMarkSent(),
    onDownloadPacket: handleDownloadPacket,
  };

  return (
    /* #8 — tightened spacing: consistent 4/3/4/3/3/3 rhythm */
    <div className="page-enter space-y-4">
      {/* Header */}
      <div>
        {/* #5 — icon in a tinted tile */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-blue-50">
            <WedgeIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium tracking-tight">{wedgeLabel}</h2>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-normal',
                caseData.status === 'resolved'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : ''
              )}
            >
              {config.label}
            </Badge>
          </div>
        </div>
        <p className="mt-1 ml-10 text-sm text-muted-foreground">
          {caseData.jurisdiction}
          {caseData.landlord_name ? ` · ${caseData.landlord_name}` : ''}
          {caseData.provider_name ? ` · ${caseData.provider_name}` : ''}
        </p>

        {/* #2 — amount: text-2xl, prominent but below page heading */}
        {caseData.deposit_amount ? (
          <div className="mt-3 ml-10">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Amount in dispute
            </p>
            <p className="mt-0.5 text-2xl font-medium tracking-tight">
              {formatCurrency(caseData.deposit_amount)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Progress Bar */}
      <ProgressBar status={caseData.status} />

      {/* Action error */}
      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Loading states for inline actions */}
      {(pdfLoading || markingSent) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {pdfLoading ? 'Generating PDF...' : 'Updating status...'}
        </div>
      )}

      {/* Next Action */}
      <NextAction caseData={caseData} actions={builtActions} />

      {/* #6 — tightened info cards: reduced padding */}
      <div className="grid gap-3 sm:grid-cols-2">
        {caseData.next_deadline ? (
          <div className="rounded-lg border bg-card px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Next Deadline
            </p>
            <p
              className={cn(
                'mt-1.5 text-base font-medium',
                caseData.next_deadline.is_past
                  ? 'text-destructive'
                  : 'text-foreground'
              )}
            >
              {formatDate(caseData.next_deadline.date)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
              {caseData.next_deadline.label}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border bg-card px-3.5 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Documents
          </p>
          <p className="mt-1.5 text-base font-medium">
            {String(caseData.documents_count)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {caseData.documents_count === 1 ? 'file uploaded' : 'files uploaded'}
          </p>
        </div>
      </div>

      {/* Letter line */}
      {caseData.has_letter && (
        <div className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">
            Letter generated
            {caseData.letter_generated_at
              ? ` · ${formatDate(caseData.letter_generated_at)}`
              : ''}
          </span>
          <a
            href={`/case/${caseData.id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            View Letter
          </a>
        </div>
      )}

      {/* Timeline hint */}
      <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            What happens next:
          </span>{' '}
          {caseData.status === 'intake' &&
            'Complete the diagnostic and we\'ll generate your letter.'}
          {caseData.status === 'generated' &&
            'Send your letter via certified mail. We\'ll check in to see if you got a response.'}
          {(caseData.status === 'sent' || caseData.status === 'awaiting') &&
            'If no response arrives within the statutory period, we\'ll prepare escalation documents for you.'}
          {caseData.status === 'escalation_drafted' &&
            'File the documents using the step-by-step instructions in your packet.'}
          {caseData.status === 'resolved' &&
            'Your case is resolved. Thank you for using Resolvaio.'}
          {caseData.status === 'closed' && 'This case has been closed.'}
        </p>
      </div>
    </div>
  );
}
