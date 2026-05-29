/**
 * PDF form filler — server-only.
 *
 * Fills interactive PDF forms with case data using pdf-lib.
 * Downloads the official court form PDF, fills the mapped fields,
 * and returns the filled PDF as a Buffer.
 *
 * Falls back to generating a plain-text cover page if the form
 * is not fillable or the download fails.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PacketForm, PacketCaseData } from './packet-assembler';
import { resolveFieldMappings } from './packet-assembler';

/* ------------------------------------------------------------------ */
/*  Form filling                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fills a PDF form with case data based on field mappings.
 *
 * @param form  The form template with field_mapping.
 * @param caseData  The case data to fill in.
 * @returns  Buffer of the filled PDF, or null if filling failed.
 */
export async function fillPdfForm(
  form: PacketForm,
  caseData: PacketCaseData,
): Promise<Buffer | null> {
  if (!form.fillable || !form.field_mapping) return null;

  try {
    // Download the official form PDF
    const response = await fetch(form.official_url);
    if (!response.ok) return null;

    const pdfBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the form fields
    const pdfForm = pdfDoc.getForm();
    const fieldMappings = resolveFieldMappings(form, caseData);

    // Fill each mapped field
    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      try {
        const field = pdfForm.getTextField(fieldName);
        field.setText(value);
      } catch {
        // Field not found in PDF — skip silently
        // This is expected when form templates don't match exactly
      }
    }

    // Flatten so filled fields are not editable
    pdfForm.flatten();

    const filledBytes = await pdfDoc.save();
    return Buffer.from(filledBytes);
  } catch {
    // PDF filling failed — return null, caller will use fallback
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Cover sheet generation                                            */
/* ------------------------------------------------------------------ */

/**
 * Generates a cover sheet PDF for the filing packet.
 */
export async function generateCoverSheet(
  title: string,
  courtName: string,
  plaintiff: string,
  defendant: string,
  claimAmount: string,
  contents: string[],
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let y = 720;
  const leftMargin = 72;
  const lineHeight = 16;

  // Title
  page.drawText(title.toUpperCase(), {
    x: leftMargin,
    y,
    size: 16,
    font: boldFont,
  });
  y -= lineHeight * 2;

  // Court
  page.drawText(courtName, {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
  });
  y -= lineHeight * 2;

  // Parties
  page.drawText(`Plaintiff: ${plaintiff}`, {
    x: leftMargin,
    y,
    size: 12,
    font,
  });
  y -= lineHeight;
  page.drawText(`Defendant: ${defendant}`, {
    x: leftMargin,
    y,
    size: 12,
    font,
  });
  y -= lineHeight;
  page.drawText(`Claim Amount: ${claimAmount}`, {
    x: leftMargin,
    y,
    size: 12,
    font,
  });
  y -= lineHeight;
  page.drawText(
    `Date Prepared: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    { x: leftMargin, y, size: 12, font },
  );
  y -= lineHeight * 2;

  // Divider
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: 540, y },
    thickness: 1,
  });
  y -= lineHeight * 1.5;

  // Contents
  page.drawText('CONTENTS', {
    x: leftMargin,
    y,
    size: 13,
    font: boldFont,
  });
  y -= lineHeight * 1.5;

  for (let i = 0; i < contents.length; i++) {
    const item = contents[i];
    if (!item) continue;
    page.drawText(`${i + 1}. ${item}`, {
      x: leftMargin + 12,
      y,
      size: 11,
      font,
    });
    y -= lineHeight;

    if (y < 72) break; // Don't overflow the page
  }

  // Footer disclaimer
  y = 60;
  page.drawText(
    'This packet was prepared with writing assistance. It is not legal advice. Verify all information before filing.',
    { x: leftMargin, y, size: 8, font },
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/* ------------------------------------------------------------------ */
/*  Filing instructions page                                          */
/* ------------------------------------------------------------------ */

/**
 * Generates a filing instructions PDF page.
 */
export async function generateFilingInstructionsPage(
  checklist: string[],
  courtName: string,
  courtAddress?: string,
  courtUrl?: string,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let y = 720;
  const leftMargin = 72;
  const lineHeight = 16;

  page.drawText('FILING INSTRUCTIONS', {
    x: leftMargin,
    y,
    size: 16,
    font: boldFont,
  });
  y -= lineHeight * 2;

  page.drawText(`Court: ${courtName}`, {
    x: leftMargin,
    y,
    size: 11,
    font: boldFont,
  });
  y -= lineHeight;

  if (courtAddress) {
    page.drawText(`Address: ${courtAddress}`, {
      x: leftMargin,
      y,
      size: 11,
      font,
    });
    y -= lineHeight;
  }

  if (courtUrl) {
    page.drawText(`Website: ${courtUrl}`, {
      x: leftMargin,
      y,
      size: 11,
      font,
    });
    y -= lineHeight;
  }

  y -= lineHeight;

  page.drawText('Checklist:', {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
  });
  y -= lineHeight * 1.5;

  for (const item of checklist) {
    // Wrap long lines
    const maxWidth = 440;
    const words = item.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, 10);

      if (width > maxWidth && line) {
        page.drawText(`[ ] ${line}`, {
          x: leftMargin + 12,
          y,
          size: 10,
          font,
        });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      page.drawText(`[ ] ${line}`, {
        x: leftMargin + 12,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    y -= 4; // Extra spacing between items

    if (y < 72) break;
  }

  // Footer
  y = 60;
  page.drawText(
    'Verify all filing requirements with the court before filing. Court procedures may change.',
    { x: leftMargin, y, size: 8, font },
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
