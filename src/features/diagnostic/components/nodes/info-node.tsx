'use client';

/**
 * Info node — informational / warning display with a single continue button.
 *
 * Used for bundled-contract warnings, jurisdiction notices, disclaimers, etc.
 * Shows node.label (or node.question) as heading and node.message (or
 * node.help_text) as body.
 */

import { Button } from '@/components/ui/button';
import type { InfoNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface InfoNodeProps {
  node: InfoNode;
  onAnswer: (value: unknown) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function InfoNodeComponent({
  node,
  onAnswer,
}: InfoNodeProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {(node.label ?? node.question) && (
        <h3 className="text-base font-medium text-foreground">
          {node.label ?? node.question}
        </h3>
      )}

      {node.message && (
        <div className="rounded-lg bg-muted/50 px-4 py-3.5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {node.message}
          </p>
        </div>
      )}

      {node.help_text && !node.message && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {node.help_text}
        </p>
      )}

      <Button
        size="sm"
        onClick={() => onAnswer('acknowledged')}
        className="gap-1.5 bg-accent text-accent-foreground border border-primary/20 hover:bg-accent/80 shadow-none"
      >
        I understand
      </Button>
    </div>
  );
}
