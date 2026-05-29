'use client';

/**
 * Group node — renders a form with multiple sub-fields.
 *
 * Each sub-field is typed (text, date, currency, select, boolean) and
 * rendered inline. The group collects all values into an object and
 * submits them together when all required fields are filled.
 */

import { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { GroupNode, GroupSubField, DiagnosticOption } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface GroupNodeProps {
  node: GroupNode;
  onAnswer: (value: unknown) => void;
  previousAnswer?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Sub-field components                                              */
/* ------------------------------------------------------------------ */

function SubTextField({
  field,
  value,
  onChange,
}: {
  field: GroupSubField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
      className={cn(
        'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
      )}
    />
  );
}

function SubDateField({
  value,
  onChange,
}: {
  field: GroupSubField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
      )}
    />
  );
}

function SubCurrencyField({
  value,
  onChange,
}: {
  field: GroupSubField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className={cn(
          'w-full rounded-lg border bg-card pl-7 pr-3.5 py-2.5 text-sm text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
        )}
      />
    </div>
  );
}

function SubSelectField({
  field,
  value,
  onChange,
}: {
  field: GroupSubField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  // Options can be string[] or DiagnosticOption[]
  const options: DiagnosticOption[] = (field.options ?? []).map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        !value && 'text-muted-foreground',
      )}
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SubBooleanField({
  value,
  onChange,
}: {
  field: GroupSubField;
  value: string;
  onChange: (val: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex gap-3">
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

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function GroupNodeComponent({
  node,
  onAnswer,
  previousAnswer,
}: GroupNodeProps): React.JSX.Element {
  // Restore previous values: convert any non-string values to strings for form inputs
  const initialValues: Record<string, string> = {};
  if (previousAnswer) {
    for (const [k, v] of Object.entries(previousAnswer)) {
      initialValues[k] = v != null ? String(v) : '';
    }
  }
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((fieldKey: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldKey]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  function handleSubmit(): void {
    const newErrors: Record<string, string> = {};

    for (const field of node.fields) {
      if (field.required && !values[field.field]?.trim()) {
        newErrors[field.field] = 'Required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build answer object — convert currency strings to numbers
    const answer: Record<string, unknown> = {};
    for (const field of node.fields) {
      const raw = values[field.field] ?? '';
      if (field.type === 'currency') {
        const cleaned = raw.replace(/[^0-9.]/g, '');
        answer[field.field] = cleaned ? parseFloat(cleaned) : 0;
      } else if (field.type === 'boolean') {
        answer[field.field] = raw;
      } else {
        answer[field.field] = raw;
      }
    }

    onAnswer(answer);
  }

  function renderField(field: GroupSubField): React.JSX.Element {
    const val = values[field.field] ?? '';
    const onChange = (v: string) => updateField(field.field, v);

    switch (field.type) {
      case 'date':
        return <SubDateField field={field} value={val} onChange={onChange} />;
      case 'currency':
        return <SubCurrencyField field={field} value={val} onChange={onChange} />;
      case 'select':
        return <SubSelectField field={field} value={val} onChange={onChange} />;
      case 'boolean':
        return <SubBooleanField field={field} value={val} onChange={onChange} />;
      default:
        return <SubTextField field={field} value={val} onChange={onChange} />;
    }
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

      <div className="space-y-4">
        {node.fields.map((field) => (
          <div key={field.field} className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {field.label}
              {field.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
            </label>
            {renderField(field)}
            {errors[field.field] && (
              <p className="text-sm text-destructive">
                {errors[field.field]}
              </p>
            )}
          </div>
        ))}
      </div>

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
