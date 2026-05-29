/**
 * GET /api/cases/[id]/letter
 *
 * Returns the most recent generated letter for a case.
 * Used by the letter-view component to display the generated content.
 * Requires authentication; RLS enforces ownership.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify case belongs to user via RLS
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Fetch the most recent letter for this case
    const { data: letterData, error: letterError } = await supabase
      .from('letters')
      .select('id, content, pdf_url, grounding_context_ids, citation_validation, created_at')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (letterError || !letterData) {
      return NextResponse.json(
        { error: 'No letter found for this case.' },
        { status: 404 },
      );
    }

    const letter = letterData as unknown as {
      id: string;
      content: string;
      pdf_url: string | null;
      grounding_context_ids: string[] | null;
      citation_validation: Record<string, unknown> | null;
      created_at: string;
    };

    // Check if there's a rebuttal table stored in the letter content
    // The rebuttal table is stored separately from content in the generation pipeline
    // but may be concatenated in the content field. Check for markdown table markers.
    let rebuttalTable: string | undefined;
    const tableMatch = letter.content.match(
      /\|.*Landlord.*Deduction.*\|[\s\S]*?\|.*\|/,
    );
    if (tableMatch) {
      rebuttalTable = tableMatch[0];
    }

    return NextResponse.json({
      id: letter.id,
      content: letter.content,
      pdf_url: letter.pdf_url,
      rebuttal_table: rebuttalTable,
      created_at: letter.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/cases/[id]/letter error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
