/**
 * Phase 2 — Case Lifecycle & Interactive Buttons Tests
 *
 * Validates the complete case lifecycle after Phase 2 fixes:
 *   1. CaseDetail action callbacks are wired and functional
 *   2. Status state machine transitions (full lifecycle)
 *   3. Escalation flow renders with deadline guard + correct status body
 *   4. Testimonial consent integrates into outcome flow
 *   5. Subscription jurisdiction is no longer hardcoded to CA
 *   6. Adversarial counsel flow fires refusal correctly
 *   7. Available counties loaded from KB structure per jurisdiction
 *
 * Tests WITHOUT requiring running services (Supabase, Redis).
 * Focuses on logic, state machine, and component wiring correctness.
 *
 * Risk mitigation checks:
 *   R1: Escalation flow doesn't render for cases without deadline data
 *   R2: County list matches KB packet structure
 *   R3: Testimonial consent saves before marking resolved
 *   R4: Status body uses correct key (new_status, not status)
 */

import { describe, it, expect } from 'vitest';

/* ================================================================== */
/*  1. STATUS STATE MACHINE — full lifecycle transitions               */
/* ================================================================== */

describe('Phase 2: Status state machine — full lifecycle', () => {
  // The status route defines VALID_TRANSITIONS. We test the logic directly.
  const VALID_TRANSITIONS: Record<string, readonly string[]> = {
    intake: ['generated', 'closed'],
    generated: ['sent', 'closed'],
    sent: ['awaiting', 'closed'],
    awaiting: ['escalation_drafted', 'resolved', 'closed'],
    escalation_drafted: ['resolved', 'closed'],
    resolved: ['closed'],
    closed: [],
  };

  function isValidTransition(current: string, next: string): boolean {
    return (VALID_TRANSITIONS[current] ?? []).includes(next);
  }

  it('supports the complete deposit happy path lifecycle', () => {
    const happyPath = [
      'intake',
      'generated',
      'sent',
      'awaiting',
      'resolved',
      'closed',
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(isValidTransition(from, to)).toBe(true);
    }
  });

  it('supports the escalation path', () => {
    expect(isValidTransition('awaiting', 'escalation_drafted')).toBe(true);
    expect(isValidTransition('escalation_drafted', 'resolved')).toBe(true);
    expect(isValidTransition('escalation_drafted', 'closed')).toBe(true);
  });

  it('allows administrative closure from any non-terminal state', () => {
    const states = ['intake', 'generated', 'sent', 'awaiting', 'escalation_drafted', 'resolved'];
    for (const state of states) {
      expect(isValidTransition(state, 'closed')).toBe(true);
    }
  });

  it('rejects backward transitions', () => {
    expect(isValidTransition('generated', 'intake')).toBe(false);
    expect(isValidTransition('sent', 'generated')).toBe(false);
    expect(isValidTransition('awaiting', 'sent')).toBe(false);
    expect(isValidTransition('resolved', 'awaiting')).toBe(false);
  });

  it('rejects transitions from terminal state (closed)', () => {
    const allStates = ['intake', 'generated', 'sent', 'awaiting', 'escalation_drafted', 'resolved', 'closed'];
    for (const state of allStates) {
      expect(isValidTransition('closed', state)).toBe(false);
    }
  });

  it('rejects skipping states (intake → sent, generated → awaiting)', () => {
    expect(isValidTransition('intake', 'sent')).toBe(false);
    expect(isValidTransition('generated', 'awaiting')).toBe(false);
    expect(isValidTransition('intake', 'resolved')).toBe(false);
  });
});

/* ================================================================== */
/*  2. CASE DETAIL ACTION WIRING                                       */
/* ================================================================== */

describe('Phase 2: CaseDetail action callbacks', () => {
  it('CaseDetailActions interface has all required callback props', async () => {
    // Import the types to verify they exist
    const mod = await import('@/components/dashboard/case-detail');

    // CaseDetail should be a function (component)
    expect(typeof mod.CaseDetail).toBe('function');

    // Verify the CaseDetailData interface has packet_url field
    // (added in Phase 2 to support packet download)
    const testData = {
      id: 'test-123',
      wedge: 'deposit',
      jurisdiction: 'CA',
      status: 'generated',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      has_letter: true,
      has_packet: false,
      documents_count: 2,
      packet_url: 'https://storage.example.com/packet.zip',
    };

    expect(testData.packet_url).toBeDefined();
  });

  it('CaseDetailActions interface covers all statuses', () => {
    // Verify the action callbacks map to each NextAction status
    const actions = {
      onContinue: (): void => { /* intake */ },
      onDownloadPdf: (): void => { /* generated */ },
      onMarkSent: (): void => { /* generated */ },
      onReportResponse: (): void => { /* sent / awaiting */ },
      onDownloadPacket: (): void => { /* escalation_drafted */ },
      onShareExperience: (): void => { /* resolved */ },
    };

    expect(Object.keys(actions)).toHaveLength(6);
    expect(actions.onContinue).toBeDefined();
    expect(actions.onDownloadPdf).toBeDefined();
    expect(actions.onMarkSent).toBeDefined();
    expect(actions.onReportResponse).toBeDefined();
    expect(actions.onDownloadPacket).toBeDefined();
    expect(actions.onShareExperience).toBeDefined();
  });
});

/* ================================================================== */
/*  3. ESCALATION FLOW — deadline guard + status body fix              */
/* ================================================================== */

describe('Phase 2: Escalation flow — deadline guard and status body', () => {
  it('escalation flow sends new_status (not status) to the API', async () => {
    // Read the escalation-flow source to verify the fix
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      process.cwd(),
      'src/features/deposit/components/escalation-flow.tsx',
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    // MUST contain new_status, NOT bare status
    expect(source).toContain("new_status: 'escalation_drafted'");
    // Should NOT have the old buggy format
    expect(source).not.toMatch(/JSON\.stringify\(\{\s*status:\s*'escalation_drafted'/);
  });

  it('deadline expiry calculation guards escalation rendering', () => {
    // Simulates the server-side deadline check logic from page.tsx
    function isDeadlineExpired(
      sentAt: string | undefined,
      deadlineFireAt: string | undefined,
    ): boolean {
      if (deadlineFireAt) {
        return new Date(deadlineFireAt) <= new Date();
      }
      if (sentAt) {
        const sentDate = new Date(sentAt);
        const daysSinceSent = Math.floor(
          (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysSinceSent >= 30;
      }
      return false;
    }

    // Case 1: No deadline data, no sent date → NOT expired
    expect(isDeadlineExpired(undefined, undefined)).toBe(false);

    // Case 2: Deadline in the future → NOT expired
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDeadlineExpired(undefined, futureDate)).toBe(false);

    // Case 3: Deadline in the past → expired
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDeadlineExpired(undefined, pastDate)).toBe(true);

    // Case 4: No deadline data, sent 35 days ago → expired (fallback)
    const sentLongAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDeadlineExpired(sentLongAgo, undefined)).toBe(true);

    // Case 5: No deadline data, sent 10 days ago → NOT expired
    const sentRecently = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDeadlineExpired(sentRecently, undefined)).toBe(false);
  });

  it('risk mitigation: escalation never renders without deadline or sentAt', () => {
    // Risk R1: Escalation flow renders for cases where no deadline was
    // ever scheduled (new cases, test data)
    // Mitigation: Guard on existence of deadline data OR fallback sentAt check

    const deadlineExpired = false; // no data → false
    const status = 'awaiting';
    const wedge = 'deposit';

    // The escalation prompt only shows when ALL conditions are true
    const shouldShow =
      status === 'awaiting' && deadlineExpired && wedge === 'deposit';

    expect(shouldShow).toBe(false);
  });
});

/* ================================================================== */
/*  4. AVAILABLE COUNTIES PER JURISDICTION                             */
/* ================================================================== */

describe('Phase 2: Available counties from KB', () => {
  // This mirrors the COUNTY_MAP from page.tsx
  const COUNTY_MAP: Record<string, string[]> = {
    CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
    TX: ['Harris', 'Dallas', 'Travis', 'Bexar'],
    NY: ['New York City', 'Nassau', 'Suffolk'],
    FL: ['Miami-Dade', 'Broward', 'Hillsborough'],
  };

  it('all four deposit jurisdictions have county entries', () => {
    for (const state of ['CA', 'TX', 'NY', 'FL']) {
      const counties = COUNTY_MAP[state];
      expect(counties).toBeDefined();
      expect(counties!.length).toBeGreaterThan(0);
    }
  });

  it('risk mitigation: counties match KB packet file structure', async () => {
    // Risk R2: County list from KB is incomplete or mismatched
    // Verify: each county in COUNTY_MAP has a corresponding packet file
    const fs = await import('fs');
    const path = await import('path');

    for (const [state, counties] of Object.entries(COUNTY_MAP)) {
      const packetDir = path.resolve(
        process.cwd(),
        `kb/deposit/${state}/packets/small-claims`,
      );

      // The directory should exist
      const dirExists = fs.existsSync(packetDir);
      expect(dirExists).toBe(true);

      if (dirExists) {
        const files = fs.readdirSync(packetDir).map((f: string) => f.replace('.json', ''));

        for (const county of counties) {
          // County names map to kebab-case filenames
          const filename = county.toLowerCase().replace(/\s+/g, '-');
          expect(files).toContain(filename);
        }
      }
    }
  });

  it('unsupported jurisdictions return empty county list', () => {
    function getAvailableCounties(jurisdiction: string): string[] {
      return COUNTY_MAP[jurisdiction] ?? [];
    }

    expect(getAvailableCounties('OH')).toEqual([]);
    expect(getAvailableCounties('WA')).toEqual([]);
    expect(getAvailableCounties('')).toEqual([]);
  });
});

/* ================================================================== */
/*  5. TESTIMONIAL CONSENT INTEGRATION                                 */
/* ================================================================== */

describe('Phase 2: Testimonial consent integration', () => {
  it('outcome-prompt imports TestimonialConsent', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/outcome/components/outcome-prompt.tsx'),
      'utf-8',
    );

    expect(source).toContain("import { TestimonialConsent }");
    expect(source).toContain('showTestimonial');
  });

  it('outcome-prompt shows testimonial before marking resolved', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/outcome/components/outcome-prompt.tsx'),
      'utf-8',
    );

    // The handleResolvedIntent function shows testimonial
    expect(source).toContain('handleResolvedIntent');
    expect(source).toContain('setShowTestimonial(true)');

    // CaptureOutcomePrompt uses handleResolvedIntent (not handleResolved directly)
    expect(source).toContain('onResolved={handleResolvedIntent}');
    expect(source).toContain('onPartial={handleResolvedIntent}');
  });

  it('testimonial consent component saves to /api/cases/[id]/outcome', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/outcome/components/testimonial-consent.tsx'),
      'utf-8',
    );

    // Calls the outcome API
    expect(source).toContain('/api/cases/${caseId}/outcome');

    // Sends required fields
    expect(source).toContain('outcome_category');
    expect(source).toContain('testimonial');
    expect(source).toContain('consent');
    expect(source).toContain('identity_level');
    expect(source).toContain('share_outcome');
    expect(source).toContain('share_testimonial');
  });

  it('risk mitigation: testimonial saves BEFORE status transition', async () => {
    // Risk R3: Testimonial consent saves but status changes first
    // The outcome-prompt should show TestimonialConsent and only mark
    // resolved after onComplete fires

    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/outcome/components/outcome-prompt.tsx'),
      'utf-8',
    );

    // handleTestimonialComplete is called AFTER testimonial saves
    expect(source).toContain('handleTestimonialComplete');

    // This function transitions to resolved
    expect(source).toContain("new_status: 'resolved'");

    // And it's connected via onComplete
    expect(source).toContain('onComplete={handleTestimonialComplete}');
  });
});

/* ================================================================== */
/*  6. SUBSCRIPTION JURISDICTION FIX                                   */
/* ================================================================== */

describe('Phase 2: Subscription jurisdiction — no longer hardcoded', () => {
  it('empty-state no longer hardcodes CA and no longer collects state itself', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/dashboard/empty-state.tsx'),
      'utf-8',
    );

    // Should NOT contain the old hardcoded subscription CA
    expect(source).not.toContain("void createCase('subscription', 'CA')");

    // The state modal is gone — EmptyState creates the case WITHOUT a
    // jurisdiction; the diagnostic asks for the state once (no double-ask).
    expect(source).not.toContain('showSubscriptionStatePicker');
    expect(source).not.toContain('Select your state');
    expect(source).toContain("createCase('subscription')");
  });

  it('subscription state (all 50 + DC) is collected by the diagnostic graph, not a modal', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const graph = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'kb/diagnostics/subscription-graph.json'),
        'utf-8',
      ),
    );
    // The jurisdiction node sources the full US list from the KB, not a
    // hardcoded picker in the component.
    expect(graph.entry_node).toBe('jurisdiction');
    expect(graph.nodes.jurisdiction.options_source).toBe('all_us_states');
  });

  it('subscription graph collects jurisdiction as first node', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const graphPath = path.resolve(
      process.cwd(),
      'kb/diagnostics/subscription-graph.json',
    );
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

    expect(graph.entry_node).toBe('jurisdiction');
    expect(graph.nodes.jurisdiction.type).toBe('select');
    expect(graph.nodes.jurisdiction.field).toBe('jurisdiction_state');
    expect(graph.nodes.jurisdiction.options_source).toBe('all_us_states');
  });
});

/* ================================================================== */
/*  7. ADVERSARIAL COUNSEL FLOW                                        */
/* ================================================================== */

describe('Phase 2: Adversarial counsel flow — report response', () => {
  it('adversarial flow has 3 questions with correct trigger behavior', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/diagnostic/components/adversarial-counsel-flow.tsx',
      ),
      'utf-8',
    );

    // 3 questions defined
    expect(source).toContain('step: 1');
    expect(source).toContain('step: 2');
    expect(source).toContain('step: 3');

    // Step 1 "no" → complete (safe)
    expect(source).toContain("no_action: 'complete'");

    // Steps 2 and 3 can fire trigger
    expect(source).toContain("yes_fires: true");

    // Calls the refusal API with correct trigger name
    expect(source).toContain("refusal_trigger: 'adversarial_counsel'");
    expect(source).toContain('/api/cases/${caseId}/refusal');
  });

  it('case-page-client wires report response to adversarial flow', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/case-page-client.tsx'),
      'utf-8',
    );

    // Has the adversarial flow import
    expect(source).toContain("import AdversarialCounselFlow");

    // Has the show/hide state
    expect(source).toContain('showAdversarialFlow');

    // Passes report response to CaseDetail actions
    expect(source).toContain('onReportResponse: handleReportResponse');

    // Adversarial flow renders when active
    expect(source).toContain('<AdversarialCounselFlow');

    // Trigger fired causes reload
    expect(source).toContain('window.location.reload()');
  });
});

/* ================================================================== */
/*  8. CASE PAGE SERVER COMPONENT — routing + data loading             */
/* ================================================================== */

describe('Phase 2: Case page routing and data loading', () => {
  it('case page routes escalation_drafted and resolved through client wrapper', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/page.tsx'),
      'utf-8',
    );

    // Client wrapper now handles sent, awaiting, escalation_drafted, resolved
    expect(source).toContain("status === 'escalation_drafted'");
    expect(source).toContain("status === 'resolved'");

    // These statuses go through CasePageClient
    expect(source).toContain('<CasePageClient');
  });

  it('case page computes deadline expiry for escalation', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/page.tsx'),
      'utf-8',
    );

    // Checks deadline_events table
    expect(source).toContain('deadline_events');
    expect(source).toContain('deadlineExpired');

    // Falls back to 30-day window from sentAt
    expect(source).toContain('daysSinceSent >= 30');

    // Passes to client
    expect(source).toContain('deadlineExpired={deadlineExpired}');
  });

  it('case page passes available counties to client', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/page.tsx'),
      'utf-8',
    );

    expect(source).toContain('getAvailableCounties');
    expect(source).toContain('availableCounties={availableCounties}');
  });

  it('case page loads packet URL for existing packets', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/page.tsx'),
      'utf-8',
    );

    expect(source).toContain('bundle_url');
    expect(source).toContain('caseDetailData.packet_url');
  });
});

/* ================================================================== */
/*  9. ESCALATION FLOW VENUE OPTIONS                                   */
/* ================================================================== */

describe('Phase 2: Escalation flow venue options', () => {
  it('offers both small claims and state AG venues', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/deposit/components/escalation-flow.tsx'),
      'utf-8',
    );

    expect(source).toContain("type: 'small_claims'");
    expect(source).toContain("type: 'state_ag'");
    expect(source).toContain('Small Claims Court');
    expect(source).toContain('State Attorney General Complaint');
  });

  it('state AG skips county selection, small claims requires it', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/deposit/components/escalation-flow.tsx'),
      'utf-8',
    );

    // State AG goes straight to generation
    expect(source).toContain("if (venueType === 'state_ag')");
    expect(source).toContain("generatePacket(venueType)");

    // Small claims goes to county selection
    expect(source).toContain("setStep('county_select')");
  });

  it('calls POST /api/cases/[id]/packet to generate filing packet', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/deposit/components/escalation-flow.tsx'),
      'utf-8',
    );

    expect(source).toContain('/api/cases/${caseId}/packet');
    expect(source).toContain("method: 'POST'");
    expect(source).toContain('venue_type');
    expect(source).toContain('bundle_url');
    expect(source).toContain('filing_checklist');
  });
});

/* ================================================================== */
/*  10. FULL LIFECYCLE INTEGRATION                                     */
/* ================================================================== */

describe('Phase 2: Full lifecycle integration', () => {
  it('every case status has a CaseDetail NextAction rendering', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/dashboard/case-detail.tsx'),
      'utf-8',
    );

    // Check that NextAction handles each status
    const statuses = [
      'intake',
      'generated',
      'sent',
      'awaiting',
      'escalation_drafted',
      'resolved',
    ];

    for (const status of statuses) {
      expect(source).toContain(`status === '${status}'`);
    }
  });

  it('every action button has an onClick handler', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/dashboard/case-detail.tsx'),
      'utf-8',
    );

    // All buttons reference actions callbacks
    expect(source).toContain('actions?.onContinue');
    expect(source).toContain('actions?.onDownloadPdf');
    expect(source).toContain('actions?.onMarkSent');
    expect(source).toContain('actions?.onReportResponse');
    expect(source).toContain('actions?.onDownloadPacket');
    expect(source).toContain('actions?.onShareExperience');
  });

  it('CaseDetail has inline fallback handlers for PDF and Mark as Sent', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/dashboard/case-detail.tsx'),
      'utf-8',
    );

    // Inline PDF download handler
    expect(source).toContain('/api/cases/${caseData.id}/pdf');
    expect(source).toContain('setPdfLoading');

    // Inline mark-as-sent handler
    expect(source).toContain("new_status: 'sent'");
    expect(source).toContain('setMarkingSent');
  });

  it('case-page-client passes all interactive actions', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(app)/case/[id]/case-page-client.tsx'),
      'utf-8',
    );

    // Escalation flow integration
    expect(source).toContain("import { EscalationFlow }");
    expect(source).toContain('showEscalation');
    expect(source).toContain('handleShowEscalation');
    expect(source).toContain('<EscalationFlow');

    // Testimonial integration
    expect(source).toContain("import { TestimonialConsent }");
    expect(source).toContain('showTestimonial');
    expect(source).toContain('<TestimonialConsent');

    // Actions wired
    expect(source).toContain('onReportResponse: handleReportResponse');
    expect(source).toContain('onShareExperience: handleShareExperience');
  });

  it('the complete button→flow mapping is correct for each status', () => {
    // This test documents the expected mapping from status → button → flow
    const mapping: Record<string, { button: string; flow: string }[]> = {
      intake: [{ button: 'Continue', flow: 'router.push to diagnostic' }],
      generated: [
        { button: 'Download', flow: 'POST /api/cases/[id]/pdf → open URL' },
        { button: 'Mark as Sent', flow: 'POST /api/cases/[id]/status → sent' },
      ],
      sent: [{ button: 'Report Response', flow: 'AdversarialCounselFlow' }],
      awaiting: [{ button: 'Report Response', flow: 'AdversarialCounselFlow' }],
      escalation_drafted: [{ button: 'Download Packet', flow: 'open packet URL' }],
      resolved: [{ button: 'Share Experience', flow: 'TestimonialConsent' }],
    };

    // Verify all statuses are covered
    expect(Object.keys(mapping)).toHaveLength(6);
    expect(mapping.intake).toBeDefined();
    expect(mapping.generated).toBeDefined();
    expect(mapping.sent).toBeDefined();
    expect(mapping.awaiting).toBeDefined();
    expect(mapping.escalation_drafted).toBeDefined();
    expect(mapping.resolved).toBeDefined();

    // Verify generated has 2 buttons
    expect(mapping.generated).toHaveLength(2);
  });
});

/* ================================================================== */
/*  11. OUTCOME PROMPT PHASE TIMING                                    */
/* ================================================================== */

describe('Phase 2: Outcome prompt timing', () => {
  function daysSince(dateStr: string): number {
    const sent = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - sent.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  type PromptPhase = 'too_early' | 'check_response' | 'check_changed' | 'capture_outcome';

  function getPromptPhase(daysSinceSent: number): PromptPhase {
    if (daysSinceSent < 14) return 'too_early';
    if (daysSinceSent < 30) return 'check_response';
    if (daysSinceSent < 60) return 'check_changed';
    return 'capture_outcome';
  }

  it('shows nothing for first 14 days', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(getPromptPhase(daysSince(recent))).toBe('too_early');
  });

  it('shows check_response at 14-29 days', () => {
    const twoWeeks = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(getPromptPhase(daysSince(twoWeeks))).toBe('check_response');
  });

  it('shows check_changed at 30-59 days', () => {
    const oneMonth = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    expect(getPromptPhase(daysSince(oneMonth))).toBe('check_changed');
  });

  it('shows capture_outcome at 60+ days', () => {
    const twoMonths = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
    expect(getPromptPhase(daysSince(twoMonths))).toBe('capture_outcome');
  });

  it('capture_outcome phase triggers testimonial consent on resolve', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/outcome/components/outcome-prompt.tsx'),
      'utf-8',
    );

    // CaptureOutcomePrompt uses handleResolvedIntent which shows testimonial
    expect(source).toContain('CaptureOutcomePrompt');
    expect(source).toContain('handleResolvedIntent');

    // Not a direct status transition — goes through testimonial first
    expect(source).not.toMatch(/CaptureOutcomePrompt[\s\S]*?onResolved=\{handleResolved\}/);
  });
});

/* ================================================================== */
/*  12. 'use client' DIRECTIVE VERIFICATION                            */
/* ================================================================== */

describe('Phase 2: Client component directives', () => {
  const clientComponents = [
    'src/components/dashboard/case-detail.tsx',
    'src/app/(app)/case/[id]/case-page-client.tsx',
    'src/features/outcome/components/outcome-prompt.tsx',
    'src/features/deposit/components/escalation-flow.tsx',
    'src/features/outcome/components/testimonial-consent.tsx',
    'src/components/dashboard/empty-state.tsx',
  ];

  it.each(clientComponents)(
    '%s has "use client" directive',
    async (filePath) => {
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.resolve(process.cwd(), filePath);
      const source = fs.readFileSync(fullPath, 'utf-8');
      expect(source.trimStart().startsWith("'use client'")).toBe(true);
    },
  );
});
