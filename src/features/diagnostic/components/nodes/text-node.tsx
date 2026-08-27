'use client';

/**
 * Text / Textarea node — single-line input or multiline textarea.
 *
 * Handles both `text` and `textarea` type nodes. For `textarea` nodes,
 * respects max_length. Submits on button click.
 */

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { TextNode, TextareaNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface TextNodeProps {
  node: TextNode | TextareaNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function TextNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: TextNodeProps): React.JSX.Element {
  const [value, setValue] = useState(previousAnswer ?? '');
  const [error, setError] = useState<string | null>(null);

  const isTextarea = node.type === 'textarea';
  const maxLength = isTextarea ? (node as TextareaNode).max_length : undefined;

  function handleSubmit(): void {
    const trimmed = value.trim();
    if (!trimmed && node.required) {
      setError('This field is required.');
      return;
    }
    setError(null);
    onAnswer(trimmed);
  }

  const inputClasses = cn(
    'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
    'placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-1 focus:ring-ring',
    error && 'border-destructive',
  );

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

      {isTextarea ? (
        <div className="space-y-1.5">
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            maxLength={maxLength}
            rows={4}
            className={cn(inputClasses, 'resize-y min-h-[100px]')}
          />
          {maxLength !== undefined && (
            <p className="text-right text-[11px] text-muted-foreground">
              {value.length} / {String(maxLength)}
            </p>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className={inputClasses}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        size="sm"
        onClick={handleSubmit}
        className="gap-1.5 bg-accent text-accent-foreground border border-primary/20 hover:bg-accent/80 shadow-none"
      >
        Continue
      </Button>
    </div>
  );
}
