'use client'

// FILE PATH: src/components/canvas/FileDownloadLink.tsx
//
// Displays a file attachment as a clickable download link.
// On click: calls getSignedUrl() server action, then opens the signed URL in a
// new tab. The URL is valid for 60 seconds — long enough to trigger a download.
//
// Props:
//   storagePath  — the full storage path stored in form_data, e.g.
//                  "tenantId/instanceId/stepNodeId/fieldId/1234567890_file.pdf"
//   filename     — display label. If omitted, the last path segment is used.
//
// Used in:
//   - instance-detail-client.tsx  (ActivityEvent expanded panel)
//   - TaskDetailModal.tsx          (PreviousStepCard fields + FieldRenderer read-only)
//   - tasks-client.tsx             (CompletedTaskCard "What you submitted")
//   - StepFormModal.tsx            (FieldRenderer read-only file display)

import { useState } from 'react'
import { DownloadIcon, Loader2Icon, AlertCircleIcon } from 'lucide-react'
import { getSignedUrl } from '@/lib/flows/actions'

interface FileDownloadLinkProps {
  storagePath: string
  filename?: string
  /** Extra Tailwind classes applied to the outer <span> wrapper */
  className?: string
}

export function FileDownloadLink({ storagePath, filename, className = '' }: FileDownloadLinkProps) {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Derive a human-readable filename from the path if not provided.
  // Path: tenantId/instanceId/stepNodeId/fieldId/1234567890_filename.pdf
  // Last segment: "1234567890_filename.pdf" → strip the timestamp prefix.
  const displayName = filename ?? deriveFilename(storagePath)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)
    try {
      const { url, error } = await getSignedUrl(storagePath)
      if (error || !url) {
        setErrorMsg(error ?? 'Download failed.')
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      setErrorMsg('Download failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        title={`Download ${displayName}`}
      >
        {loading ? (
          <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="max-w-[240px] truncate">{displayName}</span>
      </button>

      {errorMsg && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircleIcon className="h-3 w-3 shrink-0" />
          {errorMsg}
        </span>
      )}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a storage path like "tenantId/instanceId/nodeId/fieldId/1704067200000_report.pdf"
 * returns "report.pdf" (strips the timestamp_ prefix from the last segment).
 */
function deriveFilename(storagePath: string): string {
  const lastSegment = storagePath.split('/').pop() ?? storagePath
  // Remove leading timestamp prefix: digits followed by underscore
  return lastSegment.replace(/^\d+_/, '')
}

/**
 * Returns true when a form_data value looks like an array of storage paths.
 * Used to decide whether to render FileDownloadLink vs plain text.
 * Storage paths always contain at least 4 "/" separators (5 segments).
 */
export function isFilePaths(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((v) => typeof v === 'string' && v.split('/').length >= 5)
}
