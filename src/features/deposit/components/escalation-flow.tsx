'use client';

/**
 * Escalation flow UI — post-deadline escalation for deposit cases.
 *
 * Triggered when the landlord hasn't responded after the demand letter
 * deadline expires. Guides the user through:
 * 1. Venue selection (small claims court or state AG complaint)
 * 2. County/venue selection (for small claims)
 * 3. Packet generation and download
 * 4. Filing walkthrough
 * 5. Mark as filed
 */

import { useState, useCallback } from 'react';
import { FileText, Scale, Building2, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface EscalationFlowProps {
  caseId: string;
  jurisdiction: string;
  availableCounties: string[];
  onMarkFiled: () => void;
}

type EscalationStep = 'venue_select' | 'county_select' | 'generating' | 'download' | 'filed';

interface VenueOption {
  type: 'small_claims' | 'state_ag';
  icon: typeof Scale;
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const VENUE_OPTIONS: VenueOption[] = [
  {
    type: 'small_claims',
    icon: Scale,
    title: 'Small Claims Court',
    description:
      'File a claim directly in your local court. People in this situation commonly recover the deposit plus statutory penalties. No attorney needed.',
  },
  {
    type: 'state_ag',
    icon: Building2,
    title: 'State Attorney General Complaint',
    description:
      'File a consumer protection complaint. The AG office investigates patterns of violations. This creates an official record and may prompt the landlord to respond.',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function EscalationFlow({
  caseId,
  jurisdiction,
  availableCounties,
  onMarkFiled,
}: EscalationFlowProps) {
  const [step, setStep] = useState<EscalationStep>('venue_select');
  const [selectedVenue, setSelectedVenue] = useState<'small_claims' | 'state_ag' | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [bundleUrl, setBundleUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, setIsGenerating] = useState(false);

  const handleVenueSelect = useCallback(
    (venueType: 'small_claims' | 'state_ag') => {
      setSelectedVenue(venueType);
      setError(null);

      if (venueType === 'state_ag') {
        // State AG doesn't need county selection — go straight to generation
        void generatePacket(venueType);
      } else {
        setStep('county_select');
      }
    },
    [],
  );

  const handleCountySelect = useCallback(
    (county: string) => {
      setSelectedCounty(county);
      void generatePacket('small_claims', county);
    },
    [],
  );

  const generatePacket = useCallback(
    async (venueType: string, county?: string) => {
      setStep('generating');
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch(`/api/cases/${caseId}/packet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venue_type: venueType,
            county,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? 'Failed to generate packet.');
          setStep('venue_select');
          return;
        }

        const data = (await response.json()) as {
          bundle_url: string;
          filename: string;
          filing_checklist: string[];
        };

        setBundleUrl(data.bundle_url);
        setFilename(data.filename);
        setChecklist(data.filing_checklist);
        setStep('download');
      } catch {
        setError('Failed to generate packet. Please try again.');
        setStep('venue_select');
      } finally {
        setIsGenerating(false);
      }
    },
    [caseId],
  );

  const handleMarkFiled = useCallback(async () => {
    try {
      await fetch(`/api/cases/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: 'escalation_drafted' }),
      });
      setStep('filed');
      onMarkFiled();
    } catch {
      setError('Failed to update case status.');
    }
  }, [caseId, onMarkFiled]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-1 text-lg font-semibold text-neutral-900">
          Time to Escalate
        </h3>
        <p className="text-sm text-neutral-700">
          Your landlord hasn&apos;t responded to your demand letter within the
          deadline. People in this situation in {jurisdiction} typically take the
          next step.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Venue selection */}
      {step === 'venue_select' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-neutral-600">
            Choose your next step:
          </h4>
          {VENUE_OPTIONS.map((venue) => (
            <button
              key={venue.type}
              type="button"
              onClick={() => handleVenueSelect(venue.type)}
              className="flex w-full items-start gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              <venue.icon className="mt-0.5 h-6 w-6 shrink-0 text-neutral-600" />
              <div>
                <p className="font-semibold text-neutral-900">{venue.title}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {venue.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: County selection (small claims only) */}
      {step === 'county_select' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-neutral-600">
            Select your county:
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableCounties.map((county) => (
              <button
                key={county}
                type="button"
                onClick={() => handleCountySelect(county)}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                {county}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep('venue_select')}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Back to venue selection
          </button>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="text-sm text-neutral-600">
            Generating your filing packet...
          </p>
        </div>
      )}

      {/* Step 4: Download + Filing walkthrough */}
      {step === 'download' && bundleUrl && (
        <div className="space-y-6">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">
                Your Filing Packet Is Ready
              </h4>
            </div>
            <p className="mt-1 text-sm text-green-800">
              {selectedVenue === 'small_claims'
                ? `Small Claims Court packet for ${selectedCounty}, ${jurisdiction}`
                : `State Attorney General complaint for ${jurisdiction}`}
            </p>
            <a
              href={bundleUrl}
              download={filename ?? 'filing-packet.zip'}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              <Download className="h-4 w-4" />
              Download Packet (ZIP)
            </a>
          </div>

          {/* Filing checklist */}
          {checklist.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-neutral-900">
                Filing Checklist
              </h4>
              <ol className="space-y-2">
                {checklist.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-neutral-700"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
            <Button onClick={handleMarkFiled}>
              I&apos;ve Filed — Mark as Filed
            </Button>
            <span className="text-xs text-neutral-500">
              You can mark this later from your case page
            </span>
          </div>
        </div>
      )}

      {/* Step 5: Filed confirmation */}
      {step === 'filed' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 py-8">
          <CheckCircle className="h-10 w-10 text-green-600" />
          <h4 className="text-lg font-semibold text-green-900">
            Filed Successfully
          </h4>
          <p className="text-sm text-green-700">
            Your case has been updated. We&apos;ll follow up to track the
            outcome.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-neutral-500">
        This tool generates writing assistance and filing information, not legal
        advice. Verify all filing requirements with the court before filing.
        Court procedures and fees may change.
      </p>
    </div>
  );
}
