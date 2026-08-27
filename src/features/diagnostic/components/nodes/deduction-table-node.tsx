'use client';

/**
 * Deduction table node — lets users add/remove deduction rows.
 *
 * Each row has fields defined by `item_fields` on the node (description,
 * amount, dispute_basis, has_evidence). Submits an array of deduction objects.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DeductionTableNode, DeductionItemField } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DeductionTableNodeProps {
  node: DeductionTableNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type RowValues = Record<string, string>;

/* ------------------------------------------------------------------ */
/*  Sub-field renderer                                                */
/* ------------------------------------------------------------------ */

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DeductionItemField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  if (field.type === 'currency') {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className={cn(
            'w-full rounded-lg border bg-card pl-7 pr-3 py-2 text-sm text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-ring',
          )}
        />
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          !value && 'text-muted-foreground',
        )}
      >
        <option value="">Select...</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('true')}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-sm transition-all',
            value === 'true'
              ? 'border-primary bg-accent/50 font-medium'
              : 'bg-card hover:border-muted-foreground/30',
          )}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('false')}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-sm transition-all',
            value === 'false'
              ? 'border-primary bg-accent/50 font-medium'
              : 'bg-card hover:border-muted-foreground/30',
          )}
        >
          No
        </button>
      </div>
    );
  }

  // Default: text
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
      className={cn(
        'w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

function emptyRow(fields: DeductionItemField[]): RowValues {
  const row: RowValues = {};
  for (const f of fields) {
    row[f.field] = '';
  }
  return row;
}

export default function DeductionTableNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: DeductionTableNodeProps): React.JSX.Element {
  // Restore previous deduction rows if available
  const initialRows: RowValues[] = previousAnswer && previousAnswer.length > 0
    ? previousAnswer.map((row) => {
        const vals: RowValues = {};
        for (const f of node.item_fields) {
          vals[f.field] = row[f.field] != null ? String(row[f.field]) : '';
        }
        return vals;
      })
    : [emptyRow(node.item_fields)];
  const [rows, setRows] = useState<RowValues[]>(initialRows);
  const [errors, setErrors] = useState<string | null>(null);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow(node.item_fields)]);
  }, [node.item_fields]);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateField = useCallback(
    (rowIndex: number, fieldKey: string, val: string) => {
      setRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], [fieldKey]: val };
        return next;
      });
      setErrors(null);
    },
    [],
  );

  function handleSubmit(): void {
    // Validate required fields in each row
    for (let i = 0; i < rows.length; i++) {
      for (const field of node.item_fields) {
        if (field.required && !rows[i]?.[field.field]?.trim()) {
          setErrors(
            `Row ${String(i + 1)}: "${field.label}" is required.`,
          );
          return;
        }
      }
    }

    // Build typed output
    const deductions = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const field of node.item_fields) {
        if (field.type === 'currency') {
          const cleaned = (row[field.field] ?? '').replace(/[^0-9.]/g, '');
          obj[field.field] = cleaned ? parseFloat(cleaned) : 0;
        } else if (field.type === 'boolean') {
          obj[field.field] = row[field.field] === 'true';
        } else {
          obj[field.field] = row[field.field] ?? '';
        }
      }
      return obj;
    });

    onAnswer(deductions);
  }

  function handleSkip(): void {
    onAnswer([]);
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

      <div className="space-y-5">
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Deduction {String(rowIdx + 1)}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(rowIdx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {node.item_fields.map((field) => (
              <div key={field.field} className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-destructive">*</span>
                  )}
                </label>
                <FieldInput
                  field={field}
                  value={row[field.field] ?? ''}
                  onChange={(val) => updateField(rowIdx, field.field, val)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add another deduction
      </button>

      {errors && <p className="text-sm text-destructive">{errors}</p>}

      <div className="flex gap-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          className="gap-1.5 bg-accent text-accent-foreground border border-primary/20 hover:bg-accent/80 shadow-none"
        >
          Continue
        </Button>
        {node.skip_if_not_applicable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip — no deductions listed
          </Button>
        )}
      </div>
    </div>
  );
}
