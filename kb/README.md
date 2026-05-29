# Knowledge Base — Dispute Resolution Writing Tool

## Overview

This knowledge base is the core legal-operations asset of the product. It contains verified statutes, deadlines, penalties, escalation venues, filing packet templates, diagnostic flows, and compliance assets for the two launch wedges (security deposit recovery and subscription cancellation) across launch jurisdictions.

**This is not a build-once asset. It is a permanent, staffed maintenance obligation.**

## Structure

```
kb/
├── schema/                    # JSON schemas defining all KB entry types
├── deposit/                   # Security deposit wedge
│   ├── _deposit-base.json     # Shared wedge configuration
│   └── {STATE}/               # Per-state: CA, TX, NY, FL
│       ├── kb-entry.json      # Statutes, deadlines, penalties, escalation venues
│       ├── letter-template.md # State-specific demand letter template
│       ├── rebuttal-table.json # Deduction categories with statutory reasoning
│       └── packets/           # Filing packet templates
│           ├── _state-ag-complaint.json
│           └── small-claims/{county}.json
├── subscription/              # Subscription cancellation wedge
│   ├── _subscription-base.json
│   ├── federal/               # FTC, ROSCA, FCBA
│   ├── CA/                    # California ARL
│   ├── NY/                    # New York GBL §527-a
│   └── verticals/             # Per-industry templates
├── unsupported/               # Resources for non-covered states
│   ├── generic-demand-letter.md
│   └── state-resources/index.json
├── refusal/                   # Out-of-scope detection rules
├── compliance/                # Claims library, disclaimers, copy
├── diagnostics/               # Diagnostic question flow graphs
└── regression/                # Test cases for quality control
```

## Verification Workflow (PRD §8.2)

**This is the single most operationally dangerous dependency.** The product's entire liability and UPL posture rests on statute and deadline accuracy.

### Rules

1. **Named KB owner required.** No statute, deadline, or packet form goes live without a documented second-pass review against the primary official source.

2. **Every entry carries `last_verified` and `verified_by`.** Entries marked `NEEDS_SECOND_PASS_REVIEW` have been initially researched but NOT verified against primary sources by the named KB owner.

3. **Quarterly review cycle.** Automated staleness alert past 180 days.

4. **Reported-error workflow:** Triage within 72 hours; affected artifact corrected or temporarily withdrawn within 7 days.

### Verification Process

For each KB entry and packet template:

1. Open the `primary_sources_checked` URLs in the entry
2. Verify each statute citation against the actual text on the official source
3. Verify all deadlines (days), penalty formulas, and procedural requirements
4. Verify all form numbers, filing fees, and court addresses
5. Check for amendments since the entry was last verified
6. Update `last_verified`, `verified_by`, and `next_review_due`
7. Note any discrepancies in `verification_notes`

### Staging Validation

Every KB or packet change is validated on staging against the regression set before production promotion. The regression set is in `regression/` — it contains test cases spanning clean inputs, poor-quality inputs, no-document cases, and tagged out-of-scope cases that must be declined.

## Authoring Standards

### Adding a New Jurisdiction (Deposit)

1. Create `deposit/{STATE}/` directory
2. Write `kb-entry.json` following `schema/kb-entry.schema.json`
3. Write `letter-template.md` based on existing state templates
4. Write `rebuttal-table.json` with state-specific deduction categories
5. Add `packets/_state-ag-complaint.json`
6. Add `packets/small-claims/{county}.json` for top counties (demand-gated per PRD §12.1)
7. Add regression test cases to `regression/deposit/`
8. Second-pass verify all entries
9. Validate on staging against the regression set
10. Add state to the diagnostic graph's supported list

### Adding a New Vertical (Subscription)

1. Create `subscription/verticals/{vertical}.json`
2. Include: common companies, barriers, three-step sequence template, legal citations
3. Add any state-specific laws for the vertical (e.g., health club acts)
4. Add regression test cases
5. Validate on staging

### Content Rules

- **Never generate per-user for unsupported jurisdictions.** The unsupported flow serves a static generic letter plus official resource links.
- **All statute citations must trace to a curated KB entry or verified Tavily result.** No hallucinated citations.
- **All URLs must be to official .gov sources** where available. State bar and established legal aid sites are acceptable alternatives.
- **Third-person collective framing** in deposit letters: "Tenants in [State]...", never "you should" or "you are entitled to."
- **Direct consumer framing** in subscription emails: "I am requesting..." (consumer writes in first person).

## Compliance Notes

- Every entry in `compliance/approved-claims-library.json` is the ONLY set of claims permitted in marketing. Nothing outside the library is eligible.
- All disclaimers in `compliance/disclaimers.json` are UI primitives, not afterthoughts.
- The refusal rules in `refusal/` are load-bearing safety controls, not edge cases.

## File Count at Launch

~65-70 files total:
- 4 deposit KB entries (CA, TX, NY, FL)
- 3 subscription KB entries (federal, CA, NY)
- 5 vertical templates
- ~14 small claims packets
- 4 state AG complaint templates + 1 federal
- 4 letter templates + 4 rebuttal tables
- 1 unsupported state resource index (46 states + DC)
- 1 generic demand letter
- 3 refusal rule files
- 3 compliance files
- 2 diagnostic graphs
- 2 base configs
- ~20 regression test cases
- 3 schema files
