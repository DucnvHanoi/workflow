'use client'

import { useState, useTransition, useRef } from 'react'
import { Key, Plus, Copy, Check, Trash2, ShieldOff, AlertTriangle } from 'lucide-react'
import { createApiKey, revokeApiKey, deleteApiKey } from '@/lib/api/key-actions'
import type { ApiKeyRow } from '@/lib/api/key-actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── New-key dialog (shows raw key once) ─────────────────────────────────────

function NewKeyDialog({
  rawKey,
  keyName,
  onClose,
}: {
  rawKey: string
  keyName: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCopy() {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            Copy your new key now — it will <strong>not</strong> be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <input
              ref={inputRef}
              readOnly
              value={rawKey}
              className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none select-all"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Copy key"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Store this key securely. It grants API access to your workspace as{' '}
              <strong>{keyName}</strong>. You cannot retrieve it after closing this dialog.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Use this key in the <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>{' '}
            header of your API requests.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Generate-key form ────────────────────────────────────────────────────────

function GenerateKeyForm({ onCreated }: { onCreated: (raw: string, name: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createApiKey(name)
      if ('error' in res) {
        setError(res.error)
      } else {
        onCreated(res.rawKey, name.trim())
        setName('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <label htmlFor="api-key-name" className="text-xs font-medium text-muted-foreground">
          Key name
        </label>
        <input
          id="api-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Zapier integration"
          maxLength={80}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        <Plus className="h-4 w-4" />
        {isPending ? 'Generating…' : 'Generate key'}
      </button>
    </form>
  )
}

// ─── Key row actions ──────────────────────────────────────────────────────────

function KeyActions({ keyId, isRevoked }: { keyId: string; isRevoked: boolean }) {
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      await revokeApiKey(keyId)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteApiKey(keyId)
    })
  }

  if (isRevoked) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            title="Delete key"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the key record. Any existing integrations using this key
              have already been blocked by revocation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600 transition-colors disabled:opacity-50"
          title="Revoke key"
        >
          <ShieldOff className="h-3.5 w-3.5" />
          Revoke
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
          <AlertDialogDescription>
            Any application using this key will immediately receive 401 responses. This cannot be
            undone — you&apos;ll need to generate a new key if you want API access again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRevoke}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            Revoke key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function ApiKeysCard({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys] = useState<ApiKeyRow[]>(initialKeys)
  const [newKey, setNewKey] = useState<{ raw: string; name: string } | null>(null)

  function handleCreated(raw: string, name: string) {
    setNewKey({ raw, name })
  }

  function handleDialogClose() {
    setNewKey(null)
    // Keys list refreshes via revalidatePath on server — component will re-render from parent
  }

  const activeKeys = keys.filter((k) => !k.revokedAt)
  const revokedKeys = keys.filter((k) => k.revokedAt)

  return (
    <div className="space-y-5">
      {newKey && (
        <NewKeyDialog rawKey={newKey.raw} keyName={newKey.name} onClose={handleDialogClose} />
      )}

      <GenerateKeyForm onCreated={handleCreated} />

      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Key className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate a key above to enable machine-to-machine flow triggering.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeKeys.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Last used</th>
                    <th className="px-4 py-3 text-right font-medium">API calls</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{k.name}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(k.lastUsedAt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {k.callCount30d.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(k.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <KeyActions keyId={k.id} isRevoked={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {revokedKeys.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Revoked keys
              </p>
              <div className="overflow-x-auto rounded-lg border border-border opacity-60">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {revokedKeys.map((k) => (
                      <tr key={k.id} className="bg-muted/10">
                        <td className="px-4 py-3 text-muted-foreground line-through">{k.name}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          Revoked {formatDate(k.revokedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <KeyActions keyId={k.id} isRevoked />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Use{' '}
        <code className="font-mono bg-muted rounded px-1 py-0.5">
          Authorization: Bearer &lt;key&gt;
        </code>{' '}
        to authenticate API requests. See the{' '}
        <a href="/help/rest-api-reference" className="underline hover:text-foreground">
          API reference
        </a>{' '}
        for available endpoints.
      </p>
    </div>
  )
}
