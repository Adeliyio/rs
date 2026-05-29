/**
 * Packet bundle generator — server-only.
 *
 * Takes an assembled packet and generates a ZIP file containing:
 * 1. Cover sheet (PDF)
 * 2. Pre-filled court forms (PDFs, where fillable)
 * 3. Demand letter (PDF, from case)
 * 4. Filing instructions (PDF)
 *
 * The ZIP is uploaded to Supabase Storage and the URL is stored
 * in the packets table.
 */

import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import {
  generateCoverSheet,
  generateFilingInstructionsPage,
  fillPdfForm,
} from './form-filler';
import type { AssembledPacket } from './packet-assembler';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BundleResult {
  buffer: Buffer;
  filename: string;
  file_count: number;
}

/* ------------------------------------------------------------------ */
/*  Stream-to-buffer helper                                           */
/* ------------------------------------------------------------------ */

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/*  Main bundler                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generates a ZIP bundle for a filing packet.
 *
 * @param packet  The assembled packet with template, case data, and cover sheet.
 * @param demandLetterPdf  Optional demand letter PDF buffer to include.
 * @returns  ZIP buffer, filename, and file count.
 */
export async function generatePacketBundle(
  packet: AssembledPacket,
  demandLetterPdf?: Buffer,
): Promise<BundleResult> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  let fileCount = 0;

  // 1. Cover sheet
  const coverPdf = await generateCoverSheet(
    packet.cover_sheet.title,
    packet.cover_sheet.court_name,
    packet.cover_sheet.plaintiff,
    packet.cover_sheet.defendant,
    packet.cover_sheet.claim_amount,
    packet.cover_sheet.contents,
  );
  archive.append(coverPdf, { name: '01-cover-sheet.pdf' });
  fileCount++;

  // 2. Court forms (pre-filled where possible)
  const requiredForms = packet.template.forms.filter((f) => f.required);
  for (let i = 0; i < requiredForms.length; i++) {
    const form = requiredForms[i]!;
    const num = String(i + 2).padStart(2, '0');

    if (form.fillable && form.field_mapping) {
      const filledPdf = await fillPdfForm(form, packet.case_data);
      if (filledPdf) {
        archive.append(filledPdf, {
          name: `${num}-${form.form_id}-filled.pdf`,
        });
        fileCount++;
        continue;
      }
    }

    // Non-fillable or fill failed — include instructions
    const instructions = [
      `Form: ${form.name} (${form.form_id})`,
      `Download from: ${form.official_url}`,
      form.copies_needed > 1
        ? `Copies needed: ${form.copies_needed}`
        : '',
      '',
      'Fill in the following information:',
      `  Plaintiff/Claimant: ${packet.case_data.tenant_name}`,
      `  Defendant: ${packet.case_data.landlord_name}`,
      `  Property Address: ${packet.case_data.property_address}`,
      `  Claim Amount: $${packet.case_data.demand_amount.toLocaleString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    archive.append(instructions, {
      name: `${num}-${form.form_id}-FILL-MANUALLY.txt`,
    });
    fileCount++;
  }

  // 3. Demand letter
  if (demandLetterPdf) {
    const formCount = requiredForms.length;
    const num = String(formCount + 2).padStart(2, '0');
    archive.append(demandLetterPdf, {
      name: `${num}-demand-letter.pdf`,
    });
    fileCount++;
  }

  // 4. Filing instructions
  const instructionsPdf = await generateFilingInstructionsPage(
    packet.filing_checklist,
    packet.template.venue_name,
    packet.template.venue_address,
    packet.template.venue_url,
  );
  const lastNum = String(fileCount + 1).padStart(2, '0');
  archive.append(instructionsPdf, {
    name: `${lastNum}-filing-instructions.pdf`,
  });
  fileCount++;

  // Finalize
  await archive.finalize();
  const buffer = await streamToBuffer(passthrough);

  // Generate filename
  const jurisdiction = packet.case_data.jurisdiction;
  const county = packet.case_data.county?.replace(/\s+/g, '-').toLowerCase() ?? 'state';
  const venueType = packet.template.venue_type.replace(/_/g, '-');
  const filename = `${venueType}-packet-${jurisdiction}-${county}.zip`;

  return { buffer, filename, file_count: fileCount };
}
