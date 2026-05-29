'use client';

/**
 * Date node — HTML date input with validation.
 *
 * Submits an ISO date string (YYYY-MM-DD) on confirmation.
 */

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DateNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DateNodeProps {
  node: DateNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function DateNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: DateNodeProps): React.JSX.Element {
  const [value, setValue] = useState(previousAnswer ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (!value) {
      if (node.required) {
        setError('Please select a date.');
        return;
      }
      onAnswer('');
      return;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setError('Please enter a valid date.');
      return;
    }

    setError(null);
    onAnswer(value);
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

      <input
        type="date"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        className={cn(
          'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          error && 'border-destructive',
        )}
      />

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

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
