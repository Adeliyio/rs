/* ------------------------------------------------------------------ */
/*  Citation types                                                    */
/* ------------------------------------------------------------------ */

export interface Citation {
  statute_id: string;
  citation_text: string;
  source_kb_id?: string;
  is_grounded: boolean;
}

export interface CitationValidationResult {
  valid: Citation[];
  stripped: Citation[];
  pass: boolean;
}

/* ------------------------------------------------------------------ */
/*  Sequence generation (subscription wedge)                          */
/* ------------------------------------------------------------------ */

export interface SequenceStep {
  step_number: number;
  name: string;
  subject: string;
  body: string;
  timing_description: string;
  citations: Citation[];
}

export interface GeneratedSequence {
  case_id: string;
  vertical: string;
  jurisdiction: string;
  steps: SequenceStep[];
  grounding_context_ids: string[];
  citation_validation: CitationValidationResult;
  compliance_scan_pass: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Letter generation (deposit wedge)                                 */
/* ------------------------------------------------------------------ */

export interface GeneratedLetter {
  case_id: string;
  jurisdiction: string;
  content: string;
  rebuttal_table?: string;
  citations: Citation[];
  grounding_context_ids: string[];
  citation_validation: CitationValidationResult;
  compliance_scan_pass: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Compliance scanning                                               */
/* ------------------------------------------------------------------ */

export interface ComplianceViolation {
  phrase: string;
  position: number;
  suggested_replacement?: string;
}

export interface ComplianceScanResult {
  violations: ComplianceViolation[];
  pass: boolean;
}
