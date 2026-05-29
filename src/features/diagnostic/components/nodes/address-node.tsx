'use client';

/**
 * Address node — a single text input for a full mailing address.
 *
 * Uses a textarea so users can enter multi-line addresses naturally.
 */

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AddressNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface AddressNodeProps {
  node: AddressNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function AddressNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: AddressNodeProps): React.JSX.Element {
  const [value, setValue] = useState(previousAnswer ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    const trimmed = value.trim();
    if (!trimmed && node.required) {
      setError('Please enter an address.');
      return;
    }
    setError(null);
    onAnswer(trimmed);
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

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="Street address, city, state, ZIP"
        rows={3}
        className={cn(
          'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          'resize-y min-h-[80px]',
          error && 'border-destructive',
        )}
      />

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
