'use client';

/**
 * Currency node — dollar input with $ prefix, auto-formatting, and validation.
 *
 * Formats with commas for readability. Validates against node.validation
 * (min, max). Shows a warning when value exceeds high_amount_threshold.
 */

import { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { CurrencyNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface CurrencyNodeProps {
  node: CurrencyNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function stripFormatting(str: string): string {
  return str.replace(/[^0-9.]/g, '');
}

function formatCurrency(raw: string): string {
  const cleaned = stripFormatting(raw);
  if (!cleaned) return '';

  const parts = cleaned.split('.');
  const integerPart = parts[0] ?? '';
  const decimalPart = parts[1];

  // Add thousand separators
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart !== undefined) {
    return `${formatted}.${decimalPart.slice(0, 2)}`;
  }
  return formatted;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CurrencyNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: CurrencyNodeProps): React.JSX.Element {
  const [display, setDisplay] = useState(
    previousAnswer !== undefined ? formatCurrency(String(previousAnswer)) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const validation = node.validation;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatCurrency(raw);
      setDisplay(formatted);
      setError(null);

      // Check high amount threshold
      const numeric = parseFloat(stripFormatting(formatted));
      if (
        validation?.high_amount_threshold &&
        !Number.isNaN(numeric) &&
        numeric >= validation.high_amount_threshold
      ) {
        setWarning(
          validation.high_amount_refusal ??
            'This amount seems unusually high. Please double-check.',
        );
      } else {
        setWarning(null);
      }
    },
    [validation],
  );

  function handleSubmit(): void {
    const numericStr = stripFormatting(display);
    if (!numericStr) {
      if (node.required) {
        setError('Please enter an amount.');
        return;
      }
      onAnswer(0);
      return;
    }

    const numeric = parseFloat(numericStr);
    if (Number.isNaN(numeric)) {
      setError('Please enter a valid amount.');
      return;
    }

    if (validation?.min !== undefined && numeric < validation.min) {
      setError(`Amount must be at least $${String(validation.min)}.`);
      return;
    }
    if (validation?.max !== undefined && numeric > validation.max) {
      setError(`Amount cannot exceed $${String(validation.max)}.`);
      return;
    }

    setError(null);
    onAnswer(numeric);
  }

  return (
    <div className="space-y-4">
      {(node.question ?? node.label) && (
        <h3 className="text-base font-medium text-foreground">
          {node.question ?? node.label}
        </h3>
      )}
      {node.help_text && (
        <p className="text-sm text-muted-foreground">{node.help_text}</p>
      )}

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          placeholder="0.00"
          className={cn(
            'w-full rounded-lg border bg-card pl-7 pr-3.5 py-2.5 text-sm text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            error && 'border-destructive',
          )}
        />
      </div>

      {warning && (
        <div className="rounded-lg bg-warning/10 px-3.5 py-2.5">
          <p className="text-sm text-warning">{warning}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        size="sm"
        onClick={handleSubmit}
        className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
      >
        Continue
      </Button>
    </div>
  );
}
