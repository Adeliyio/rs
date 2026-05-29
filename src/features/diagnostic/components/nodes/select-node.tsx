'use client';

/**
 * Select node — renders option cards with radio-button behavior.
 *
 * For `options_source: "all_us_states"` it renders a searchable dropdown
 * instead of cards (51 items would be unwieldy as cards).
 */

import { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { ALL_US_STATES } from '@/lib/kb/us-states';
import type { SelectNode, DiagnosticOption } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface SelectNodeProps {
  node: SelectNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: string;
}

/* ------------------------------------------------------------------ */
/*  Searchable state dropdown                                         */
/* ------------------------------------------------------------------ */

function StateDropdown({
  onSelect,
  previousAnswer,
}: {
  onSelect: (code: string) => void;
  previousAnswer?: string;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(previousAnswer ?? null);

  const filtered = useMemo(() => {
    if (!query) return ALL_US_STATES;
    const q = query.toLowerCase();
    return ALL_US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search states..."
        className={cn(
          'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm',
          'text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
        )}
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border bg-card">
        {filtered.length === 0 && (
          <p className="px-3.5 py-3 text-sm text-muted-foreground">
            No states match your search.
          </p>
        )}
        {filtered.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => {
              setSelected(s.code);
              onSelect(s.code);
            }}
            className={cn(
              'flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors',
              'hover:bg-accent/50',
              selected === s.code && 'bg-accent text-accent-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                selected === s.code
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/40',
              )}
            >
              {selected === s.code && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              )}
            </span>
            <span>
              {s.name}{' '}
              <span className="text-muted-foreground">({s.code})</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Option cards                                                      */
/* ------------------------------------------------------------------ */

function OptionCards({
  options,
  onSelect,
  previousAnswer,
}: {
  options: DiagnosticOption[];
  onSelect: (value: string) => void;
  previousAnswer?: string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(previousAnswer ?? null);

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            setSelected(opt.value);
            onSelect(opt.value);
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all',
            'card-interactive',
            selected === opt.value
              ? 'border-primary bg-accent/50'
              : 'bg-card hover:border-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
              selected === opt.value
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/40',
            )}
          >
            {selected === opt.value && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            )}
          </span>
          <span className="text-foreground">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SelectNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: SelectNodeProps): React.JSX.Element {
  const isStateSelect = node.options_source === 'all_us_states';

  return (
    <div className="space-y-4">
      {node.question && (
        <h3 className="text-base font-medium text-foreground">
          {node.question}
        </h3>
      )}
      {node.label && !node.question && (
        <h3 className="text-base font-medium text-foreground">
          {node.label}
        </h3>
      )}
      {node.help_text && (
        <p className="text-sm text-muted-foreground">{node.help_text}</p>
      )}

      {isStateSelect ? (
        <StateDropdown onSelect={(code) => onAnswer(code)} previousAnswer={previousAnswer} />
      ) : node.options ? (
        <OptionCards
          options={node.options}
          onSelect={(value) => onAnswer(value)}
          previousAnswer={previousAnswer}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No options available for this question.
        </p>
      )}
    </div>
  );
}
