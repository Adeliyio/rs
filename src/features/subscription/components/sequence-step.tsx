'use client';

/**
 * Individual email step display for the subscription cancellation sequence.
 *
 * Renders one email step with subject, body, copy-to-clipboard, and
 * mark-as-sent functionality. Visual state depends on whether the step
 * is active, scheduled, or already sent.
 */

import { useState, useCallback, useMemo } from 'react';
import { Check, Copy, Clock, Send, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SequenceStep as SequenceStepType } from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface SequenceStepProps {
  step: SequenceStepType;
  status: 'active' | 'scheduled' | 'sent';
  onMarkSent?: () => void;
  sentAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Citation highlight helper                                         */
/* ------------------------------------------------------------------ */

/**
 * Wraps statute references in the body text with subtle underline styling.
 * Matches patterns like "16 CFR Part 425", "15 U.S.C. ...", etc.
 */
function highlightCitations(body: string): React.ReactNode[] {
  const citationPattern =
    /(\d{1,2}\s+(?:U\.S\.C\.\s*§\s*\d+[\w.-]*|CFR\s+Part\s+\d+)|§\s*\d+[\w.-]*|Cal\.\s+(?:Bus\.\s*&\s*Prof\.|Civ\.)\s+Code\s*§?\s*\d+[\w.-]*|N\.Y\.\s+(?:Gen\.\s*Bus\.\s*Law|GBL)\s*§?\s*\d+[\w.-]*|Tex\.\s+(?:Occ\.|Bus\.\s*&\s*Com\.)\s+Code\s*§?\s*\d+[\w.-]*|Fla\.\s+Stat\.\s*§?\s*\d+[\w.-]*|FTC\s+(?:Click-to-Cancel|Negative\s+Option)\s+Rule|Fair\s+Credit\s+Billing\s+Act|ROSCA|FCBA)/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match = citationPattern.exec(body);
  let key = 0;

  while (match !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }

    // The citation itself
    parts.push(
      <span
        key={key++}
        className="underline decoration-primary/30 decoration-1 underline-offset-2"
        title="Legal reference from verified knowledge base"
      >
        {match[0]}
      </span>,
    );

    lastIndex = match.index + match[0].length;
    match = citationPattern.exec(body);
  }

  // Remaining text
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function SequenceStep({
  step,
  status,
  onMarkSent,
  sentAt,
}: SequenceStepProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(status === 'active');

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(step.subject);
    const body = encodeURIComponent(step.body);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [step.subject, step.body]);

  const handleCopy = useCallback(async () => {
    const fullText = `Subject: ${step.subject}\n\n${step.body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no clipboard API available
    }
  }, [step.subject, step.body]);

  const handleToggle = useCallback(() => {
    // Scheduled steps can be toggled; active and sent are always expandable
    setIsExpanded((prev) => !prev);
  }, []);

  /* ---- Status badge ---- */
  const statusBadge = (() => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Ready to Send
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {step.timing_description}
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
            <Check className="h-3 w-3" />
            Sent{sentAt ? ` on ${new Date(sentAt).toLocaleDateString()}` : ''}
          </Badge>
        );
    }
  })();

  /* ---- Collapsed view for scheduled steps ---- */
  const chevron = isExpanded ? (
    <ChevronDown className="h-4 w-4 text-muted-foreground" />
  ) : (
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        status === 'active' && 'ring-1 ring-primary/20 shadow-md',
        status === 'scheduled' && 'opacity-75',
        status === 'sent' && 'opacity-90',
      )}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {chevron}
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {step.step_number}
              </span>
              <CardTitle className="text-base truncate">
                {step.name}
              </CardTitle>
            </div>
          </div>
          {statusBadge}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Subject line */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subject
            </p>
            <p className="font-medium text-sm">
              {step.subject}
            </p>
          </div>

          {/* Email body */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Body
            </p>
            <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap font-[system-ui]">
              {highlightCitations(step.body)}
            </div>
          </div>

          {/* Instruction text */}
          {status === 'active' && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Copy the email below and send it from your personal email account,
              or use &ldquo;Open in email&rdquo; to launch your email client with the
              subject and body pre-filled. Add the company&apos;s email address as
              the recipient before sending.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5"
            >
              <a href={mailtoHref}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Email
              </a>
            </Button>

            {status === 'active' && onMarkSent && (
              <Button
                size="sm"
                onClick={onMarkSent}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Mark as Sent
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
