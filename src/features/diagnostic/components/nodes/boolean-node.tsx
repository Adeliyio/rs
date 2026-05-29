'use client';

/**
 * Boolean node — large Yes / No toggle buttons.
 *
 * Passes 'true' or 'false' (strings) to onAnswer to match the
 * branch keys in the diagnostic graph.
 */

import { cn } from '@/lib/utils';
import type { BooleanNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface BooleanNodeProps {
  node: BooleanNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function BooleanNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: BooleanNodeProps): React.JSX.Element {
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onAnswer('true')}
          className={cn(
            'rounded-lg border bg-card px-4 py-4 text-sm font-medium transition-all',
            'card-interactive',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            previousAnswer === 'true'
              ? 'border-primary bg-accent/50'
              : 'hover:border-primary hover:bg-accent/50',
          )}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onAnswer('false')}
          className={cn(
            'rounded-lg border bg-card px-4 py-4 text-sm font-medium transition-all',
            'card-interactive',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            previousAnswer === 'false'
              ? 'border-primary bg-accent/50'
              : 'hover:border-primary hover:bg-accent/50',
          )}
        >
          No
        </button>
      </div>
    </div>
  );
}
