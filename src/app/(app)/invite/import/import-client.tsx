'use client'

import { useState, useRef } from 'react'
import { Upload, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { bulkImportUsers, type BulkImportRow, type BulkImportResult } from '../actions'

const TEMPLATE_CSV = `email,full_name,role\nalice@company.com,Alice Smith,user\nbob@company.com,Bob Jones,admin\n`

type Stage = 'idle' | 'preview' | 'results'

function parseCSV(text: string): { rows: BulkImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { rows: [], errors: ['File is empty.'] }

  const header = lines[0]
    .toLowerCase()
    .split(',')
    .map((h) => h.trim())
  const emailIdx = header.indexOf('email')
  const nameIdx = header.indexOf('full_name')
  const roleIdx = header.indexOf('role')

  if (emailIdx === -1) return { rows: [], errors: ['CSV must have an "email" column.'] }

  const rows: BulkImportRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const email = cols[emailIdx] ?? ''
    if (!email || !email.includes('@')) {
      errors.push(`Row ${i + 1}: invalid email "${email}"`)
      continue
    }
    const rawRole = roleIdx !== -1 ? cols[roleIdx]?.toLowerCase() : 'user'
    const role: 'admin' | 'user' = rawRole === 'admin' ? 'admin' : 'user'
    const full_name = nameIdx !== -1 ? cols[nameIdx] || undefined : undefined
    rows.push({ email, role, full_name })
  }

  return { rows, errors }
}

export function BulkImportClient() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<BulkImportRow[]>([])
  const [results, setResults] = useState<BulkImportResult[]>([])
  const [loading, setLoading] = useState(false)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const { rows, errors } = parseCSV(text)
      setParseErrors(errors)
      setPreview(rows)
      if (rows.length > 0) setStage('preview')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview.length) return
    setLoading(true)
    try {
      const res = await bulkImportUsers(preview)
      setResults(res)
      setStage('results')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStage('idle')
    setPreview([])
    setResults([])
    setParseErrors([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Upload a CSV to create multiple users at once. Users are added immediately — no
            invitation email is sent. They can set their password via &quot;Forgot password.&quot;
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1.5" />
          Template CSV
        </Button>
      </div>

      {/* Upload zone */}
      {stage === 'idle' && (
        <label
          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          htmlFor="csv-upload"
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            Click to upload or drag a CSV file here
          </span>
          <span className="text-xs text-muted-foreground/60 mt-1">
            Required column: email — Optional: full_name, role
          </span>
          <input
            id="csv-upload"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-1">
          {parseErrors.map((e, i) => (
            <p key={i} className="text-sm text-destructive">
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Preview stage */}
      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {preview.length} user{preview.length !== 1 ? 's' : ''} ready to import
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleImport} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Import {preview.length} user{preview.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{row.email}</TableCell>
                    <TableCell>
                      {row.full_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.role === 'admin' ? 'default' : 'secondary'}>
                        {row.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {preview.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      … and {preview.length - 50} more rows
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Results stage */}
      {stage === 'results' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <span className="text-sm text-green-600 font-medium">{successCount} imported</span>
              {failCount > 0 && (
                <span className="text-sm text-destructive font-medium">{failCount} failed</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Import another file
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{row.email}</TableCell>
                    <TableCell>
                      {row.success ? (
                        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Imported
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                          <XCircle className="h-4 w-4" /> Failed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.error ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
