'use client';

/**
 * File upload node — drag-and-drop zone with multi-file support.
 *
 * Allows the user to upload documents (PDF, JPEG, PNG, HEIC) during
 * the diagnostic flow. Files are uploaded to /api/documents/upload and
 * the resulting document IDs are passed to onAnswer on continue.
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ExtractionConfirmation from '@/features/diagnostic/components/extraction-confirmation';
import type { FileUploadNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.heic,.heif';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface FileEntry {
  id: string;
  file: File;
  status: 'uploading' | 'success' | 'error';
  documentId?: string;
  errorMessage?: string;
}

interface FileUploadNodeProps {
  node: FileUploadNode;
  onAnswer: (value: unknown) => void;
  caseId: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${String((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

function generateEntryId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function FileUploadNodeComponent({
  node,
  onAnswer,
  caseId,
}: FileUploadNodeProps): React.JSX.Element {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- Extraction phase (A9: upload → parse → confirm → merge) ---- */
  interface ExtractField { value: unknown; confidence: number }
  const [phase, setPhase] = useState<'upload' | 'parsing' | 'confirm'>('upload');
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ documentId: string; fields: Record<string, ExtractField> } | null>(null);
  // Merged confirmed fields across all documents, forwarded to the diagnostic.
  const [mergedFields, setMergedFields] = useState<Record<string, unknown>>({});

  const maxFiles = node.max_files ?? 5;
  const maxSizeMb = node.max_size_mb ?? 10;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  /* ---- Validation ---- */

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        return `"${file.name}" is not a supported file type. Please upload PDF, JPEG, PNG, or HEIC.`;
      }
      if (file.size > Math.min(maxSizeBytes, MAX_FILE_SIZE_BYTES)) {
        return `"${file.name}" exceeds the ${String(maxSizeMb)} MB size limit.`;
      }
      return null;
    },
    [maxSizeBytes, maxSizeMb],
  );

  /* ---- Upload a single file ---- */

  const uploadFile = useCallback(
    async (entry: FileEntry) => {
      const formData = new FormData();
      formData.append('file', entry.file);
      formData.append('caseId', caseId);

      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Upload failed (${String(res.status)})`);
        }

        const data = (await res.json()) as { document_id: string; file_path: string };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: 'success' as const, documentId: data.document_id }
              : f,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: 'error' as const, errorMessage: message }
              : f,
          ),
        );
      }
    },
    [caseId],
  );

  /* ---- Handle new files ---- */

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newFiles = Array.from(incoming);
      const currentCount = files.length;

      // Enforce max file count
      const allowed = newFiles.slice(0, maxFiles - currentCount);
      if (allowed.length === 0) return;

      const entries: FileEntry[] = [];
      const errors: string[] = [];

      for (const file of allowed) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
          continue;
        }
        entries.push({
          id: generateEntryId(),
          file,
          status: 'uploading',
        });
      }

      if (errors.length > 0) {
        // Show the first validation error as a failed entry
        for (const errMsg of errors) {
          entries.push({
            id: generateEntryId(),
            file: new File([], 'invalid'),
            status: 'error',
            errorMessage: errMsg,
          });
        }
      }

      setFiles((prev) => [...prev, ...entries]);

      // Upload valid files
      for (const entry of entries) {
        if (entry.status === 'uploading') {
          void uploadFile(entry);
        }
      }
    },
    [files.length, maxFiles, validateFile, uploadFile],
  );

  /* ---- Drag handlers ---- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  /* ---- Click to browse ---- */

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset the input so the same file can be re-selected
        e.target.value = '';
      }
    },
    [handleFiles],
  );

  /* ---- Continue ---- */

  const uploadedIds = files
    .filter((f) => f.status === 'success' && f.documentId)
    .map((f) => f.documentId!);

  const isUploading = files.some((f) => f.status === 'uploading');
  const isOptional = !node.required;

  /** Finish: hand the document ids AND any confirmed extracted fields to the
   *  diagnostic. The shell merges `extracted_fields` into the case answers. */
  const finish = useCallback(
    (extracted: Record<string, unknown>) => {
      onAnswer({
        document_ids: uploadedIds,
        extracted_fields: extracted,
      });
    },
    [onAnswer, uploadedIds],
  );

  /** Parse the next un-parsed uploaded document (GPT-4o Vision) → confirm UI. */
  const parseNext = useCallback(
    async (remaining: string[], mergedSoFar: Record<string, unknown>) => {
      if (remaining.length === 0) {
        finish(mergedSoFar);
        return;
      }
      const [docId, ...rest] = remaining;
      setPhase('parsing');
      setParseError(null);
      try {
        const res = await fetch(`/api/documents/${docId}/parse`, { method: 'POST' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Extraction failed (${String(res.status)})`);
        }
        const data = (await res.json()) as { fields?: Record<string, ExtractField> };
        const fields = data.fields ?? {};
        if (Object.keys(fields).length === 0) {
          // Nothing extracted — skip straight to the next document.
          void parseNext(rest, mergedSoFar);
          return;
        }
        // Stash the remaining queue on the pending object so confirm can continue.
        setPendingConfirm({ documentId: docId!, fields });
        setPhase('confirm');
        // remember what's left for after this confirm
        remainingRef.current = rest;
      } catch (err) {
        // Extraction is best-effort — on failure, skip parsing and continue.
        setParseError(err instanceof Error ? err.message : 'Extraction failed');
        void parseNext(rest, mergedSoFar);
      }
    },
    [finish],
  );

  const remainingRef = useRef<string[]>([]);

  const handleConfirmed = useCallback(
    (confirmedFields: Record<string, unknown>) => {
      const merged = { ...mergedFields, ...confirmedFields };
      setMergedFields(merged);
      setPendingConfirm(null);
      void parseNext(remainingRef.current, merged);
    },
    [mergedFields, parseNext],
  );

  const handleContinue = useCallback(() => {
    if (uploadedIds.length === 0) {
      onAnswer({ document_ids: [], extracted_fields: {} });
      return;
    }
    // Kick off parse → confirm across all uploaded documents.
    void parseNext(uploadedIds, {});
  }, [onAnswer, uploadedIds, parseNext]);

  /* ---- Render: parsing phase ---- */

  if (phase === 'parsing') {
    return (
      <div className="flex items-center gap-3 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Reading your document…
        </p>
      </div>
    );
  }

  /* ---- Render: confirmation phase ---- */

  if (phase === 'confirm' && pendingConfirm) {
    return (
      <div className="space-y-4">
        {parseError && (
          <p className="text-sm text-muted-foreground">
            One document couldn&apos;t be read automatically — you can enter those
            details by hand later.
          </p>
        )}
        <ExtractionConfirmation
          documentId={pendingConfirm.documentId}
          fields={pendingConfirm.fields}
          onConfirmed={handleConfirmed}
        />
      </div>
    );
  }

  /* ---- Render: upload phase ---- */

  return (
    <div className="space-y-4">
      {/* Question / label */}
      {(node.question ?? node.label) && (
        <h3 className="text-base font-medium text-foreground">
          {node.question ?? node.label}
        </h3>
      )}
      {node.help_text && (
        <p className="text-sm text-muted-foreground">{node.help_text}</p>
      )}

      {/* Drop zone */}
      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3',
          'rounded-lg border-2 border-dashed px-6 py-10',
          'bg-card transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-accent/50'
            : 'border-muted hover:border-muted-foreground/40',
        )}
      >
        <Upload
          className={cn(
            'h-8 w-8',
            isDragging ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, JPEG, PNG, or HEIC &mdash; up to {String(maxSizeMb)} MB per file, max{' '}
            {String(maxFiles)} files
          </p>
        </div>
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload documents"
      />

      {/* Uploaded file list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3.5 py-2.5',
                entry.status === 'error'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'bg-card',
              )}
            >
              {/* Status icon */}
              {entry.status === 'uploading' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              )}
              {entry.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              {entry.status === 'error' && (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}

              {/* File info */}
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {entry.file.name || 'Unknown file'}
                </p>
                {entry.errorMessage ? (
                  <p className="text-xs text-destructive">{entry.errorMessage}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(entry.file.size)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Continue / Skip buttons */}
      <div className="flex gap-3">
        {files.length > 0 && (
          <Button
            size="sm"
            onClick={handleContinue}
            disabled={isUploading || (uploadedIds.length === 0 && !isOptional)}
            className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-none"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        )}
        {isOptional && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleContinue}
            disabled={isUploading}
            className="text-muted-foreground"
          >
            {files.length === 0 ? 'Skip — no documents to upload' : 'Continue without more files'}
          </Button>
        )}
      </div>
    </div>
  );
}
