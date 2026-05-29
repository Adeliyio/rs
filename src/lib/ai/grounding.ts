/**
 * Grounding context assembly — server-only.
 *
 * Builds a structured grounding context string from KB entries
 * for use in the generation prompt. The grounding context is the
 * single source of truth for what statutes, deadlines, penalties,
 * and escalation venues the model may reference.
 */

import {
  loadKbEntry,
  loadVerticalTemplate,
  loadSubscriptionBase,
} from '@/lib/kb/loader';
import type { Wedge } from '@/types/enums';
import type {
  Statute,
  DeadlineRule,
  Penalty,
  EscalationVenue,
  VerticalTemplate,
  SubscriptionBase,
  KbEntry,
} from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Return type                                                       */
/* ------------------------------------------------------------------ */

export interface GroundingContext {
  context: string;
  statute_ids: string[];
  kb_entry_ids: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatStatutes(statutes: Statute[]): string {
  if (statutes.length === 0) return '(none)\n';

  return statutes
    .map((s) => {
      const provisions = s.key_provisions
        .map((p) => `    - ${p.subsection}: ${p.description}`)
        .join('\n');

      return [
        `  [${s.statute_id}] ${s.citation}`,
        `  Title: ${s.title}`,
        `  Summary: ${s.summary}`,
        `  Key Provisions:`,
        provisions,
        `  Effective: ${s.effective_date} | Last Amended: ${s.last_amended}`,
        `  URL: ${s.official_url}`,
      ].join('\n');
    })
    .join('\n\n');
}

function formatDeadlines(rules: DeadlineRule[]): string {
  if (rules.length === 0) return '(none)\n';

  return rules
    .map(
      (r) =>
        `  [${r.rule_id}] ${r.deadline_days} days from ${r.anchor_event}\n` +
        `  Statute: ${r.statute_id}\n` +
        `  Description: ${r.description}\n` +
        `  Action at expiry: ${r.action_at_expiry}\n` +
        `  Statutory: ${r.is_statutory ? 'Yes' : 'No (recommended)'}`,
    )
    .join('\n\n');
}

function formatPenalties(penalties: Penalty[]): string {
  if (penalties.length === 0) return '(none)\n';

  return penalties
    .map(
      (p) =>
        `  [${p.penalty_id}] ${p.type}\n` +
        `  Statute: ${p.statute_id}\n` +
        `  Description: ${p.description}\n` +
        `  Amount/Formula: ${p.amount_or_formula}\n` +
        `  Conditions: ${p.conditions}`,
    )
    .join('\n\n');
}

function formatVenues(venues: EscalationVenue[]): string {
  if (venues.length === 0) return '(none)\n';

  return venues
    .map(
      (v) =>
        `  [${v.venue_id}] ${v.name} (${v.type})\n` +
        `  Description: ${v.description}` +
        (v.filing_url ? `\n  Filing URL: ${v.filing_url}` : ''),
    )
    .join('\n\n');
}

function formatVerticalGuidance(
  template: VerticalTemplate,
  jurisdiction: string,
): string {
  const lines: string[] = [];

  lines.push(`  Vertical: ${template.display_name}`);
  lines.push(`  Description: ${template.description}`);
  lines.push(
    `  Common Companies: ${template.common_companies.join(', ')}`,
  );
  lines.push(
    `  Typical Barriers: ${template.typical_barriers.join('; ')}`,
  );

  // Add sequence template guidance
  const seq = template.sequence_template;
  lines.push('');
  lines.push('  Sequence Template Guidance:');

  for (const [key, step] of Object.entries(seq) as [string, typeof seq.email_1][]) {
    const emailNum = key.replace('email_', 'Email ');
    lines.push(`    ${emailNum}:`);
    lines.push(`      Subject Template: ${step.subject}`);
    lines.push(`      Tone: ${step.tone}`);
    lines.push(`      Key Points:`);
    step.key_points.forEach((kp) => {
      lines.push(`        - ${kp}`);
    });
    if (step.legal_citations) {
      lines.push(`      Legal Citations:`);
      for (const [citKey, citVal] of Object.entries(step.legal_citations)) {
        lines.push(`        ${citKey}: ${citVal}`);
      }
    }
    if (step.gym_specific_points && step.gym_specific_points.length > 0) {
      lines.push(`      Vertical-Specific Points:`);
      step.gym_specific_points.forEach((p) => {
        lines.push(`        - ${p}`);
      });
    }
    if (step.timing) {
      lines.push(`      Timing: ${step.timing}`);
    }
  }

  // State-specific health club laws
  const stateKey = jurisdiction.toUpperCase();
  if (
    template.state_specific_health_club_laws &&
    template.state_specific_health_club_laws[stateKey]
  ) {
    const law = template.state_specific_health_club_laws[stateKey];
    lines.push('');
    lines.push(`  State Health Club Law (${stateKey}):`);
    lines.push(`    Statute: ${law.statute}`);
    lines.push(`    Provisions:`);
    law.key_provisions.forEach((p) => {
      lines.push(`      - ${p}`);
    });
    lines.push(`    URL: ${law.official_url}`);
  }

  return lines.join('\n');
}

function formatEmailPrinciples(base: SubscriptionBase): string {
  const principles = base.email_principles;
  const lines: string[] = [];

  lines.push(`  Framing: ${principles.framing}`);
  if (principles.notes) {
    lines.push(`  Notes: ${principles.notes}`);
  }
  lines.push(`  Prohibited Phrases in Emails:`);
  principles.prohibited_phrases.forEach((p) => {
    lines.push(`    - "${p}"`);
  });
  lines.push(`  Permitted Escalation Language:`);
  principles.permitted_escalation_language.forEach((p) => {
    lines.push(`    - "${p}"`);
  });

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Safely load KB — returns null if not found                        */
/* ------------------------------------------------------------------ */

function safeLoadKbEntry(
  wedge: string,
  jurisdiction: string,
): KbEntry | null {
  try {
    return loadKbEntry(wedge, jurisdiction);
  } catch {
    return null;
  }
}

function safeLoadVerticalTemplate(
  vertical: string,
): VerticalTemplate | null {
  try {
    return loadVerticalTemplate(vertical);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Assembles the full grounding context for generation.
 *
 * For the subscription wedge:
 * - Always loads the federal KB entry
 * - Loads state-specific KB if the jurisdiction is not 'federal'
 * - Loads vertical template if a vertical is specified
 * - Merges all statutes, deadlines, penalties, venues
 * - Formats into a structured text block
 */
export function assembleGroundingContext(
  wedge: Wedge,
  jurisdiction: string,
  vertical?: string,
  answers?: Record<string, unknown>,
): GroundingContext {
  const allStatutes: Statute[] = [];
  const allDeadlines: DeadlineRule[] = [];
  const allPenalties: Penalty[] = [];
  const allVenues: EscalationVenue[] = [];
  const statuteIds: string[] = [];
  const kbEntryIds: string[] = [];

  /* ---- Federal KB (always loaded for subscription) ---- */
  const federalKb = safeLoadKbEntry(wedge, 'federal');
  if (federalKb) {
    kbEntryIds.push(federalKb.id);
    allStatutes.push(...federalKb.statutes);
    allDeadlines.push(...federalKb.deadline_rules);
    allPenalties.push(...federalKb.penalties);
    allVenues.push(...federalKb.escalation_venues);
  }

  /* ---- State-specific KB ---- */
  const normalizedJurisdiction = jurisdiction.toUpperCase();
  if (normalizedJurisdiction !== 'FEDERAL') {
    const stateKb = safeLoadKbEntry(wedge, normalizedJurisdiction);
    if (stateKb) {
      kbEntryIds.push(stateKb.id);
      allStatutes.push(...stateKb.statutes);
      allDeadlines.push(...stateKb.deadline_rules);
      allPenalties.push(...stateKb.penalties);
      allVenues.push(...stateKb.escalation_venues);
    }
  }

  /* ---- Collect statute IDs ---- */
  for (const s of allStatutes) {
    statuteIds.push(s.statute_id);
  }

  /* ---- Vertical template ---- */
  let verticalTemplate: VerticalTemplate | null = null;
  if (vertical) {
    verticalTemplate = safeLoadVerticalTemplate(vertical);
  }

  /* ---- Subscription base config ---- */
  let subscriptionBase: SubscriptionBase | null = null;
  if (wedge === 'subscription') {
    try {
      subscriptionBase = loadSubscriptionBase();
    } catch {
      // Non-critical — base config may not be available
    }
  }

  /* ---- Build context string ---- */
  const sections: string[] = [];

  sections.push('=== APPLICABLE STATUTES ===');
  sections.push(formatStatutes(allStatutes));

  sections.push('=== DEADLINE RULES ===');
  sections.push(formatDeadlines(allDeadlines));

  sections.push('=== PENALTIES ===');
  sections.push(formatPenalties(allPenalties));

  sections.push('=== ESCALATION VENUES ===');
  sections.push(formatVenues(allVenues));

  if (verticalTemplate) {
    sections.push('=== VERTICAL-SPECIFIC GUIDANCE ===');
    sections.push(
      formatVerticalGuidance(verticalTemplate, normalizedJurisdiction),
    );
  }

  if (subscriptionBase) {
    sections.push('=== EMAIL PRINCIPLES ===');
    sections.push(formatEmailPrinciples(subscriptionBase));
  }

  /* ---- User context from answers ---- */
  if (answers && Object.keys(answers).length > 0) {
    sections.push('=== USER SITUATION DETAILS ===');
    const answerLines: string[] = [];
    for (const [key, value] of Object.entries(answers)) {
      if (value !== undefined && value !== null && value !== '') {
        answerLines.push(`  ${key}: ${String(value)}`);
      }
    }
    sections.push(answerLines.join('\n'));
  }

  const context = sections.join('\n\n');

  return {
    context,
    statute_ids: statuteIds,
    kb_entry_ids: kbEntryIds,
  };
}
