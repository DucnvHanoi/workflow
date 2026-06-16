'use client'

import { useState, useTransition } from 'react'
import {
  getCustomWebhooks,
  createCustomWebhook,
  toggleCustomWebhook,
  deleteCustomWebhook,
  testCustomWebhook,
  type CustomWebhookRow,
} from '@/lib/settings/webhook-actions'
import { WEBHOOK_EVENT_LABELS, type OutboundWebhookEventType } from '@/lib/webhooks/events'

const ALL_EVENTS: OutboundWebhookEventType[] = [
  'flow_triggered',
  'step_completed',
  'flow_completed',
  'flow_cancelled',
  'step_overdue',
]

interface Props {
  initialWebhooks: CustomWebhookRow[]
}

export function CustomWebhooksCard({ initialWebhooks }: Props) {
  const [webhooks, setWebhooks] = useState<CustomWebhookRow[]>(initialWebhooks)
  const [showForm, setShowForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<OutboundWebhookEventType[]>([
    'flow_completed',
    'flow_cancelled',
  ])
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<{ id: string; message: string } | null>(null)

  const [createPending, startCreate] = useTransition()
  const [togglePending, startToggle] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [testPending, startTest] = useTransition()

  async function reload() {
    const { data } = await getCustomWebhooks()
    setWebhooks(data)
  }

  function handleEventToggle(event: OutboundWebhookEventType) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  function handleCreate() {
    setFormError(null)
    setRevealedSecret(null)
    startCreate(async () => {
      const { data, error } = await createCustomWebhook(newUrl, newEvents)
      if (error) {
        setFormError(error)
        return
      }
      setRevealedSecret(data!.secret)
      setNewUrl('')
      setNewEvents(['flow_completed', 'flow_cancelled'])
      setShowForm(false)
      await reload()
    })
  }

  function handleToggle(id: string, current: boolean) {
    startToggle(async () => {
      await toggleCustomWebhook(id, !current)
      await reload()
    })
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      await deleteCustomWebhook(id)
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
      if (actionStatus?.id === id) setActionStatus(null)
    })
  }

  function handleTest(id: string) {
    setActionStatus(null)
    startTest(async () => {
      const { error } = await testCustomWebhook(id)
      setActionStatus({
        id,
        message: error ? `Test failed: ${error}` : 'Test payload sent.',
      })
    })
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono'

  return (
    <div className="space-y-4">
      {/* Secret reveal (shown once after creation) */}
      {revealedSecret && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Copy your signing secret — it won&apos;t be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 rounded bg-background border px-2 py-1.5 text-xs font-mono break-all">
              {revealedSecret}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(revealedSecret)
              }}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use this secret to verify the{' '}
            <code className="text-xs">X-Webhook-Signature: sha256=…</code> header on incoming
            requests.
          </p>
          <button
            type="button"
            onClick={() => setRevealedSecret(null)}
            className="text-xs text-muted-foreground underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Webhook list */}
      {webhooks.length > 0 && (
        <div className="divide-y divide-border rounded-lg border">
          {webhooks.map((wh) => (
            <div key={wh.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono truncate text-foreground">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(wh.events as OutboundWebhookEventType[]).map((ev) => (
                      <span
                        key={ev}
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {WEBHOOK_EVENT_LABELS[ev]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTest(wh.id)}
                    disabled={testPending}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(wh.id, wh.is_active)}
                    disabled={togglePending}
                    className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                      wh.is_active
                        ? 'text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {wh.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(wh.id)}
                    disabled={deletePending}
                    className="text-xs px-2 py-1 rounded border text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {actionStatus?.id === wh.id && (
                <p
                  className={`text-xs ${actionStatus.message.startsWith('Test failed') ? 'text-red-600' : 'text-green-600'}`}
                >
                  {actionStatus.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {webhooks.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-2">No custom webhooks configured.</p>
      )}

      {/* Add webhook form */}
      {showForm ? (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Endpoint URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Events to send</label>
            <div className="flex flex-wrap gap-3">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(ev)}
                    onChange={() => handleEventToggle(ev)}
                    className="rounded"
                  />
                  {WEBHOOK_EVENT_LABELS[ev]}
                </label>
              ))}
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createPending}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createPending ? 'Adding…' : 'Add webhook'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setFormError(null)
              }}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          + Add webhook
        </button>
      )}
    </div>
  )
}
