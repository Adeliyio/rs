'use client';

/**
 * Decline screen — shown when a refusal rule fires during the diagnostic.
 *
 * This is a compassionate moment, not an error screen.  The design uses
 * muted/card colors (no red/warning), calm typography, and empathetic
 * copy sourced from kb/refusal/decline-copy.json.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import type {
  DeclineCopyMessage,
  DeclineCopyFooter,
  DeclineCopyFooterResource,
  RefusalResourceTemplate,
  RefusalResource,
} from '@/types/kb.types';

// These KB files are small, static, and needed on the client (this is a
// 'use client' component). Import them normally so webpack BUNDLES them —
// a previous `import(/* webpackIgnore: true */ '../../../../kb/...json')` tried
// to fetch them from the browser at runtime, but kb/ isn't a served asset in
// production, so the browser got a 404 HTML page ("Expected a
// JavaScript-or-Wasm module script but got text/html") and the refusal screen
// failed to load.
import declineCopyData from '../../../../kb/refusal/decline-copy.json';
import tangledCaseRulesData from '../../../../kb/refusal/tangled-case-rules.json';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DeclineScreenProps {
  /** The rule_id from the matched refusal rule (key into decline_messages). */
  ruleId: string;
  /** Optional: resource_type from the rule to show contextual resources. */
  resourceType?: 'legal_representation' | 'general_info';
  /** Pre-loaded decline message — avoids a network call when available. */
  declineMessage?: DeclineCopyMessage;
  /** Pre-loaded footer — avoids a network call when available. */
  footer?: DeclineCopyFooter;
  /** Pre-loaded resource template. */
  resourceTemplate?: RefusalResourceTemplate;
  /** Called when the user clicks "Return to home". */
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Resource link component                                           */
/* ------------------------------------------------------------------ */

function ResourceLink({
  resource,
}: {
  resource: RefusalResource | DeclineCopyFooterResource;
}): React.JSX.Element {
  const url =
    ('url' in resource ? resource.url : undefined) ?? undefined;

  return (
    <li className="flex items-start gap-2">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group inline-flex items-start gap-1.5 text-sm font-medium',
            'text-primary underline-offset-4 hover:underline',
          )}
        >
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          <span>
            <span className="block">{resource.name}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {resource.description}
            </span>
          </span>
        </a>
      ) : (
        <span className="text-sm">
          <span className="block font-medium text-foreground">
            {resource.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {resource.description}
          </span>
        </span>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function DeclineScreen({
  ruleId,
  resourceType,
  declineMessage: externalMessage,
  footer: externalFooter,
  resourceTemplate: externalResourceTemplate,
  onClose,
}: DeclineScreenProps): React.JSX.Element {
  /* -------------------------------------------------------------- */
  /*  State: loaded KB data                                         */
  /* -------------------------------------------------------------- */

  const [declineMessage, setDeclineMessage] = useState<
    DeclineCopyMessage | undefined
  >(externalMessage);
  const [footer, setFooter] = useState<DeclineCopyFooter | undefined>(
    externalFooter,
  );
  const [resourceTemplate, setResourceTemplate] = useState<
    RefusalResourceTemplate | undefined
  >(externalResourceTemplate);
  const [loadError, setLoadError] = useState(false);

  /* -------------------------------------------------------------- */
  /*  Load KB data on the client if not provided via props          */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (declineMessage && footer) return;

    // Read from the statically-imported (bundled) KB data — no runtime fetch,
    // so this works in production where kb/ is not a served asset.
    function loadCopy() {
      try {
        const data = declineCopyData as unknown as {
          decline_messages: Record<string, DeclineCopyMessage>;
          common_footer: DeclineCopyFooter;
        };

        const msg = data.decline_messages[ruleId];
        if (msg) setDeclineMessage(msg);
        setFooter(data.common_footer);
      } catch {
        setLoadError(true);
      }
    }

    function loadResources() {
      if (resourceTemplate || !resourceType) return;
      try {
        const data = tangledCaseRulesData as unknown as {
          resource_templates: Record<string, RefusalResourceTemplate>;
        };

        const tpl = data.resource_templates[resourceType];
        if (tpl) setResourceTemplate(tpl);
      } catch {
        // Non-critical — we still show the decline copy
      }
    }

    loadCopy();
    loadResources();
  }, [ruleId, resourceType, declineMessage, footer, resourceTemplate]);

  /* -------------------------------------------------------------- */
  /*  Loading / error states                                        */
  /* -------------------------------------------------------------- */

  if (loadError || !declineMessage) {
    if (loadError) {
      return (
        <div className="page-enter mx-auto max-w-lg px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            We were unable to load the information for this screen.
            Please try refreshing the page.
          </p>
          {onClose && (
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Return to home
            </Button>
          )}
        </div>
      );
    }

    // Still loading
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-4 px-4 py-12">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted" />
        <div className="h-5 w-3/4 mx-auto rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Render                                                        */
  /* -------------------------------------------------------------- */

  return (
    <div className="page-enter mx-auto max-w-lg px-4 py-8">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-6 p-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full',
                'bg-muted text-muted-foreground',
              )}
            >
              <ShieldAlert className="h-7 w-7" />
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-center text-xl font-medium text-foreground">
            {declineMessage.headline}
          </h2>

          {/* Explanation */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {declineMessage.explanation}
          </p>

          {/* Empathy line */}
          <p className="text-sm italic text-muted-foreground/80">
            {declineMessage.empathy_line}
          </p>

          {/* What we recommend */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              What we recommend
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {declineMessage.what_we_recommend}
            </p>
          </div>

          {/* Resource links */}
          {resourceTemplate && (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <h4 className="text-sm font-medium text-foreground">
                {resourceTemplate.heading}
              </h4>
              <p className="text-xs text-muted-foreground">
                {resourceTemplate.body}
              </p>
              <ul className="space-y-3">
                {resourceTemplate.resources.map((resource) => (
                  <ResourceLink
                    key={resource.name}
                    resource={resource}
                  />
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        {footer && (
          <CardFooter className="flex-col items-start gap-4 border-t bg-muted/30 p-6">
            {/* Disclaimer */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {footer.disclaimer}
            </p>

            {/* General resources */}
            {footer.general_resources.length > 0 && (
              <ul className="space-y-2">
                {footer.general_resources.map((resource) => (
                  <ResourceLink key={resource.name} resource={resource} />
                ))}
              </ul>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Return to home */}
      {onClose ? (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={onClose}>
            Return to home
          </Button>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <Button variant="outline" asChild>
            <Link href="/">Return to home</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
