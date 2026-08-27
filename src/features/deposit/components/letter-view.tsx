'use client';

/**
 * Letter view — displays the generated deposit demand letter.
 *
 * Shows: letter content, rebuttal table (if present), PDF download,
 * "Mark as Sent" with certified-mail instructions, disclaimer banner,
 * and "What happens next" timeline.
 *
 * PRD §6.2 steps 9-11, §7.12 (guided-sending confidence).
 */

import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Info,
  Mail,
  Send,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SubscriptionUpsell } from '@/features/checkout/components/subscription-upsell';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface LetterViewProps {
  caseId: string;
  jurisdiction?: string;
}

interface LetterData {
  id: string;
  content: string;
  pdf_url: string | null;
  rebuttal_table?: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Converts \n-separated letter text to paragraphs. */
function renderLetterContent(content: string): React.JSX.Element {
  const paragraphs = content.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        // Disclaimer separator
        if (trimmed.startsWith('________')) {
          return <hr key={i} className="my-4 border-neutral-300" />;
        }

        // Bold line
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <p key={i} className="font-bold">
              {trimmed.replace(/\*\*/g, '')}
            </p>
          );
        }

        // Regular paragraph — preserve single line breaks
        const lines = trimmed.split('\n');
        return (
          <p key={i} className="mb-3 leading-relaxed">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Renders a markdown-style table as HTML. */
function renderRebuttalTable(markdown: string): React.JSX.Element {
  const lines = markdown.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return <p className="text-sm">{markdown}</p>;

  const headerLine = lines[0]!;
  const dataLines = lines.filter((l) => !/^\|[\s-:|]+\|$/.test(l.trim()));

  const parseRow = (line: string) =>
    line
      .split('|')
      .filter((c) => c.trim() !== '')
      .map((c) => c.trim());

  const headers = parseRow(headerLine);
  const rows = dataLines.slice(1).map(parseRow);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-neutral-200 px-3 py-2"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function LetterView({
  caseId,
  jurisdiction,
}: LetterViewProps): React.JSX.Element {
  const [letter, setLetter] = useState<LetterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [markingSent, setMarkingSent] = useState(false);
  const [markedSent, setMarkedSent] = useState(false);
  const [showSendGuide, setShowSendGuide] = useState(false);
  const [showUpsell, setShowUpsell] = useState(true);

  /* ---- Fetch letter on mount ---- */
  useEffect(() => {
    let cancelled = false;

    async function fetchLetter() {
      try {
        const letterRes = await fetch(`/api/cases/${caseId}/letter`);
        if (!letterRes.ok) {
          const body = (await letterRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'Failed to load letter');
        }
        const data = (await letterRes.json()) as LetterData;
        if (!cancelled) {
          setLetter(data);
          if (data.pdf_url) setPdfUrl(data.pdf_url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load letter');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchLetter();
    return () => { cancelled = true; };
  }, [caseId]);

  /* ---- Download PDF ---- */
  const handleDownloadPdf = useCallback(async () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      return;
    }

    setPdfLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/pdf`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'PDF generation failed');
      }
      const data = (await res.json()) as { pdf_url: string };
      setPdfUrl(data.pdf_url);
      window.open(data.pdf_url, '_blank');
    } catch {
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }, [caseId, pdfUrl]);

  /* ---- Mark as Sent ---- */
  const handleMarkSent = useCallback(async () => {
    setMarkingSent(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: 'sent' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to update status');
      }
      setMarkedSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as sent');
    } finally {
      setMarkingSent(false);
    }
  }, [caseId]);

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="page-enter space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Your Demand Letter
          </h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error && !letter) {
    return (
      <div className="page-enter space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Your Demand Letter
          </h1>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!letter) return <></>;

  /* ---- Success: marked as sent ---- */
  if (markedSent) {
    return (
      <div className="page-enter space-y-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 py-8">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <h2 className="text-lg font-semibold text-emerald-900">
            Letter Marked as Sent
          </h2>
          <p className="max-w-md text-center text-sm text-emerald-700">
            We will check in to track progress and guide you through
            next steps if needed. Check your email for updates.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            View Case
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Main letter view ---- */
  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Your Demand Letter Is Ready
            </h1>
            <p className="text-sm text-muted-foreground">
              {jurisdiction ? `${jurisdiction} — ` : ''}Case{' '}
              {caseId.slice(0, 8)}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          This is a writing assistance tool. Review your letter carefully before
          sending. This is not legal advice and does not guarantee any outcome.
          Consider consulting a licensed attorney for advice specific to your
          situation.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowSendGuide(!showSendGuide)}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          How to Send This
        </Button>
        <Button
          variant="outline"
          onClick={handleMarkSent}
          disabled={markingSent}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {markingSent ? 'Updating...' : 'I Sent It — Mark as Sent'}
        </Button>
      </div>

      {/* Sending instructions (expandable) */}
      {showSendGuide && (
        <Card className="border-primary/20 bg-accent/50">
          <CardContent className="px-4 py-4">
            <h3 className="mb-3 text-sm font-semibold text-accent-foreground">
              How to Send Your Demand Letter
            </h3>
            <ol className="space-y-3 text-sm text-accent-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <span>
                  <strong>Print the letter</strong> — download the PDF above and
                  print it on standard paper. Sign it at the bottom.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <span>
                  <strong>Send via USPS Certified Mail with Return Receipt</strong>{' '}
                  — go to your local post office and ask for &quot;Certified Mail
                  with Return Receipt Requested&quot; (PS Form 3811). This costs
                  about $4-7 and gives you proof of delivery.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <span>
                  <strong>Keep the green card</strong> — the post office gives you
                  a tracking number and will mail you a green card when the letter
                  is delivered. Keep both. This is your proof.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  4
                </span>
                <span>
                  <strong>Come back and mark as sent</strong> — click
                  &quot;I Sent It&quot; above so we can track timelines and guide
                  you on next steps.
                </span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-accent-foreground/70">
              People in similar situations commonly send this type of letter.
              Most landlords respond within the statutory window.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Letter content */}
      <Card className="border-border/60 shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Demand Letter
            </h3>
          </div>
        </div>
        <CardContent className="px-6 py-6">
          <div className="prose prose-sm max-w-none font-serif leading-relaxed">
            {renderLetterContent(letter.content)}
          </div>
        </CardContent>
      </Card>

      {/* Rebuttal table */}
      {letter.rebuttal_table && (
        <Card className="border-border/60 shadow-sm">
          <div className="border-b border-neutral-100 px-6 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Itemized Dispute Summary
            </h3>
          </div>
          <CardContent className="px-6 py-4">
            {renderRebuttalTable(letter.rebuttal_table)}
          </CardContent>
        </Card>
      )}

      {/* What happens next */}
      <Card className="border-border/50 shadow-none">
        <CardContent className="px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold">What Happens Next</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Send your letter via certified mail. We will check in at key
                intervals to track progress.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                If no response arrives within the statutory deadline, we can
                prepare escalation documents — a filing packet for small claims
                court or a state attorney general complaint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription upsell */}
      {showUpsell && (
        <SubscriptionUpsell
          userEmail=""
          onDismiss={() => setShowUpsell(false)}
        />
      )}

      {/* Footer disclaimer */}
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        This tool provides writing assistance and general information, not legal
        advice. Review all content before sending. Individual results vary.
        See our refund policy.
      </p>
    </div>
  );
}
