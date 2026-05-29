import type { Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Node type discriminant                                            */
/* ------------------------------------------------------------------ */

export type DiagnosticNodeType =
  | 'select'
  | 'boolean'
  | 'date'
  | 'currency'
  | 'text'
  | 'group'
  | 'address'
  | 'textarea'
  | 'deduction_table'
  | 'file_upload'
  | 'computed'
  | 'summary'
  | 'preview'
  | 'payment'
  | 'generation'
  | 'delivery'
  | 'tracking'
  | 'terminal'
  | 'info';

export type TerminalType =
  | 'generation'
  | 'unsupported_jurisdiction'
  | 'out_of_scope'
  | 'soft_warning'
  | 'no_dispute';

/* ------------------------------------------------------------------ */
/*  Shared field types used in options and group sub-fields           */
/* ------------------------------------------------------------------ */

export interface DiagnosticOption {
  value: string;
  label: string;
  next?: string;
}

export interface GroupSubField {
  field: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[] | DiagnosticOption[];
  document_extractable?: boolean;
  extract_from?: string;
}

export interface DeductionItemField {
  field: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface CurrencyValidation {
  min?: number;
  max?: number;
  high_amount_threshold?: number;
  high_amount_refusal?: string;
}

export interface TrackingCheckpoint {
  trigger: string;
  question: string;
}

export interface ConditionalOnState {
  [stateCode: string]: { help_text: string };
}

/* ------------------------------------------------------------------ */
/*  Base node fields (shared by all types)                            */
/* ------------------------------------------------------------------ */

interface DiagnosticNodeBase {
  id: string;
  label?: string;
  question?: string;
  field?: string;
  help_text?: string;
  required?: boolean;
  conditional_on_state?: ConditionalOnState;
  document_extractable?: boolean;
  extract_from?: string;
  next?: string;
}

/* ------------------------------------------------------------------ */
/*  Per-type node definitions                                         */
/* ------------------------------------------------------------------ */

export interface SelectNode extends DiagnosticNodeBase {
  type: 'select';
  options?: DiagnosticOption[];
  options_source?: string;
}

export interface BooleanNode extends DiagnosticNodeBase {
  type: 'boolean';
  branches: { true: string; false: string };
}

export interface DateNode extends DiagnosticNodeBase {
  type: 'date';
}

export interface CurrencyNode extends DiagnosticNodeBase {
  type: 'currency';
  validation?: CurrencyValidation;
}

export interface TextNode extends DiagnosticNodeBase {
  type: 'text';
}

export interface GroupNode extends DiagnosticNodeBase {
  type: 'group';
  fields: GroupSubField[];
}

export interface AddressNode extends DiagnosticNodeBase {
  type: 'address';
}

export interface TextareaNode extends DiagnosticNodeBase {
  type: 'textarea';
  max_length?: number;
}

export interface DeductionTableNode extends DiagnosticNodeBase {
  type: 'deduction_table';
  item_fields: DeductionItemField[];
  conditional?: string;
  skip_if_not_applicable?: boolean;
}

export interface FileUploadNode extends DiagnosticNodeBase {
  type: 'file_upload';
  accepted_types: string[];
  max_files: number;
  max_size_mb: number;
}

export interface ComputedNode extends DiagnosticNodeBase {
  type: 'computed';
  computation: string;
}

export interface SummaryNode extends DiagnosticNodeBase {
  type: 'summary';
  summary_type?: string;
  disclaimer_required?: boolean;
}

export interface PreviewNode extends DiagnosticNodeBase {
  type: 'preview';
  preview_type: string;
  description?: string;
}

export interface PaymentNode extends DiagnosticNodeBase {
  type: 'payment';
  payment_type: string;
}

export interface GenerationNode extends DiagnosticNodeBase {
  type: 'generation';
  generation_type: string;
  outputs: string[];
  notes?: string;
}

export interface DeliveryNode extends DiagnosticNodeBase {
  type: 'delivery';
  delivery_options: string[];
  send_on_behalf_note?: string;
}

export interface TrackingNode extends DiagnosticNodeBase {
  type: 'tracking';
  checkpoints: TrackingCheckpoint[];
}

export interface TerminalNode extends DiagnosticNodeBase {
  type: 'terminal';
  terminal_type: TerminalType;
  refusal_rule?: string;
  message?: string;
}

export interface InfoNode extends DiagnosticNodeBase {
  type: 'info';
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Discriminated union                                               */
/* ------------------------------------------------------------------ */

export type DiagnosticNode =
  | SelectNode
  | BooleanNode
  | DateNode
  | CurrencyNode
  | TextNode
  | GroupNode
  | AddressNode
  | TextareaNode
  | DeductionTableNode
  | FileUploadNode
  | ComputedNode
  | SummaryNode
  | PreviewNode
  | PaymentNode
  | GenerationNode
  | DeliveryNode
  | TrackingNode
  | TerminalNode
  | InfoNode;

/* ------------------------------------------------------------------ */
/*  Diagnostic graph                                                  */
/* ------------------------------------------------------------------ */

export interface DiagnosticGraph {
  version: string;
  wedge: Wedge;
  description?: string;
  entry_node: string;
  nodes: Record<string, DiagnosticNode>;
}

/* ------------------------------------------------------------------ */
/*  Runtime diagnostic state                                          */
/* ------------------------------------------------------------------ */

export interface ExtractedField {
  value: unknown;
  confidence: number;
}

export interface DiagnosticState {
  case_id: string;
  graph_version: string;
  current_node: string;
  answers: Record<string, unknown>;
  completed_nodes: string[];
  extracted_fields: Record<string, ExtractedField>;
  refusal_trigger?: string;
  is_completed: boolean;
  started_at: string;
  updated_at: string;
}
