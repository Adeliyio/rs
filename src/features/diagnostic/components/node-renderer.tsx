'use client';

/**
 * Shared node renderer — maps a DiagnosticNode to its input component.
 *
 * Extracted from diagnostic-shell.tsx so both the authenticated shell and the
 * anonymous shell (SPEC.md M3) render the SAME node components with no
 * duplication. Every interactive node type is handled here; the terminal /
 * generation / delivery / tracking node types are never rendered interactively
 * (the shells intercept them), so they fall through to the default notice.
 */

import { Button } from '@/components/ui/button';
import type {
  DiagnosticNode,
  DiagnosticState,
  AddressNode,
  DeductionTableNode,
} from '@/types/diagnostic.types';

import SelectNodeComponent from './nodes/select-node';
import BooleanNodeComponent from './nodes/boolean-node';
import DateNodeComponent from './nodes/date-node';
import CurrencyNodeComponent from './nodes/currency-node';
import TextNodeComponent from './nodes/text-node';
import AddressNodeComponent from './nodes/address-node';
import GroupNodeComponent from './nodes/group-node';
import InfoNodeComponent from './nodes/info-node';
import DeductionTableNodeComponent from './nodes/deduction-table-node';
import SummaryNodeComponent from './nodes/summary-node';
import FileUploadNodeComponent from './nodes/file-upload-node';
import PreviewNodeComponent from './nodes/preview-node';
import PaymentNodeComponent from './nodes/payment-node';

export interface NodeRendererProps {
  node: DiagnosticNode;
  onAnswer: (value: unknown) => void;
  state: DiagnosticState;
  /** Active "Unlimited" subscriber — the deposit payment node is skipped. */
  hasActiveSubscription?: boolean;
}

export function NodeRenderer({
  node,
  onAnswer,
  state,
  hasActiveSubscription = false,
}: NodeRendererProps): React.JSX.Element {
  const prev = state.answers?.[node.id];

  switch (node.type) {
    case 'select':
      return <SelectNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'boolean':
      return <BooleanNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'date':
      return <DateNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'currency':
      return <CurrencyNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as number | undefined} />;
    case 'text':
      return <TextNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'textarea':
      return <TextNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'address':
      return <AddressNodeComponent node={node as AddressNode} onAnswer={onAnswer} previousAnswer={prev as string | undefined} />;
    case 'deduction_table':
      return <DeductionTableNodeComponent node={node as DeductionTableNode} onAnswer={onAnswer} previousAnswer={prev as Record<string, unknown>[] | undefined} />;
    case 'group':
      return <GroupNodeComponent node={node} onAnswer={onAnswer} previousAnswer={prev as Record<string, string> | undefined} />;
    case 'info':
      return <InfoNodeComponent node={node} onAnswer={onAnswer} />;
    case 'file_upload':
      return <FileUploadNodeComponent node={node} onAnswer={onAnswer} caseId={state.case_id} />;
    case 'summary':
      return <SummaryNodeComponent node={node} onAnswer={onAnswer} state={state} />;
    case 'computed':
      // Computed nodes are auto-advanced by the diagnostic hook.
      return (
        <div className="flex items-center gap-2 py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Processing...</p>
        </div>
      );
    case 'preview':
      return <PreviewNodeComponent node={node} onAnswer={onAnswer} caseId={state.case_id} />;
    case 'payment':
      return (
        <PaymentNodeComponent
          node={node}
          onAnswer={onAnswer}
          caseId={state.case_id}
          hasActiveSubscription={hasActiveSubscription}
        />
      );
    default:
      return (
        <div className="rounded-lg border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">
            This step ({node.type}) is not yet supported in the diagnostic flow.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => onAnswer('acknowledged')}
          >
            Continue
          </Button>
        </div>
      );
  }
}
