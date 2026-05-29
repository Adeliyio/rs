'use client';

/**
 * Extraction confirmation — review and edit parsed fields before
 * they are saved to the diagnostic state.
 *
 * Shows each extracted field with its confidence indicator and an
 * editable input. The user reviews, corrects if needed, and confirms.
 */

import { useState, useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ExtractedField {
  value: unknown;
  confidence: number;
}

interface ExtractionConfirmationProps {
  documentId: string;
  fields: Record<string, ExtractedField>;
  /** Called after successful confirmation with the confirmed field values. */
  onConfirmed: (confirmedFields: Record<string, unknown>) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Humanise a snake_case field name into a label. */
function fieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Confidence indicator dot. */
function ConfidenceDot({ confidence }: { confidence: number }): React.JSX.Element {
  let colorClass: string;
  let label: string;

  if (confidence >= 0.9) {
    colorClass = 'bg-emerald-500';
    label = 'High confidence';
  } else if (confidence >= 0.7) {
    colorClass = 'bg-yellow-500';
    label = 'Medium confidence';
  } else {
    colorClass = 'bg-red-500';
    label = 'Low confidence';
  }

  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', colorClass)}
      title={`${label} (${String(Math.round(confidence * 100))}%)`}
      aria-label={label}
    />
  );
}

/** Stringify a value for display in an input. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // Arrays / objects — JSON
  return JSON.stringify(value);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ExtractionConfirmation({
  documentId,
  fields,
  onConfirmed,
}: ExtractionConfirmationProps): React.JSX.Element {
  // Editable state: keyed by field name, value is the display string
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, field] of Object.entries(fields)) {
      initial[key] = displayValue(field.value);
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ---- Confirm all ---- */

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    // Build confirmed fields: try to parse numbers back, otherwise keep string
    const confirmedFields: Record<string, unknown> = {};
    for (const [key, strValue] of Object.entries(editedValues)) {
      const trimmed = strValue.trim();
      if (trimmed === '') {
        confirmedFields[key] = null;
        continue;
      }
      // Try parsing as JSON first (for arrays/objects)
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          confirmedFields[key] = parsed;
          continue;
        }
      } catch {
        // Not JSON — continue to number check
      }
      // Try parsing as number
      const num = Number(trimmed);
      if (!isNaN(num) && trimmed !== '') {
        confirmedFields[key] = num;
      } else {
        confirmedFields[key] = trimmed;
      }
    }

    try {
      const res = await fetch(`/api/documents/${documentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_fields: confirmedFields }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Confirmation failed (${String(res.status)})`);
      }

      onConfirmed(confirmedFields);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [documentId, editedValues, onConfirmed]);

  /* ---- Render ---- */

  const fieldEntries = Object.entries(fields);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-foreground">
          Review extracted information
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Please verify the information below and correct any errors before continuing.
        </p>
      </div>

      {/* Confidence legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Low
        </span>
      </div>

      {/* Fields table */}
      <div className="rounded-lg border overflow-hidden">
        {fieldEntries.map(([key, field], index) => (
          <div
            key={key}
            className={cn(
              'flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30',
            )}
          >
            {/* Label + confidence */}
            <div className="flex items-center gap-2 sm:w-48 sm:shrink-0">
              <ConfidenceDot confidence={field.confidence} />
              <label
                htmlFor={`field-${key}`}
                className="text-sm font-medium text-foreground"
              >
                {fieldLabel(key)}
              </label>
            </div>

            {/* Editable value */}
            <input
              id={`field-${key}`}
              type="text"
              value={editedValues[key] ?? ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className={cn(
                'flex-1 rounded-md border bg-background px-3 py-1.5 text-sm',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-1 focus:ring-ring',
              )}
              placeholder={`Enter ${fieldLabel(key).toLowerCase()}`}
            />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Confirm button */}
      <Button
        onClick={handleConfirm}
        disabled={isSubmitting}
        className="gap-1.5"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirm All
          </>
        )}
      </Button>
    </div>
  );
}
