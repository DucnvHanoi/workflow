'use client'

import { useState, useTransition, useRef } from 'react'
import { saveWebhookUrls, testWebhook } from '@/lib/settings/webhook-actions'

interface Props {
  initialSlackUrl: string | null
  initialTeamsUrl: string | null
}

export function WebhookSettingsCard({ initialSlackUrl, initialTeamsUrl }: Props) {
  const slackRef = useRef<HTMLInputElement>(null)
  const teamsRef = useRef<HTMLInputElement>(null)

  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testStatus, setTestStatus] = useState<
    Record<'slack' | 'teams', { ok: boolean; message: string } | null>
  >({
    slack: null,
    teams: null,
  })

  const [savePending, startSave] = useTransition()
  const [testSlackPending, startTestSlack] = useTransition()
  const [testTeamsPending, startTestTeams] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveStatus(null)
    startSave(async () => {
      const { error } = await saveWebhookUrls(
        slackRef.current?.value ?? '',
        teamsRef.current?.value ?? ''
      )
      setSaveStatus(
        error ? { ok: false, message: error } : { ok: true, message: 'Webhook URLs saved.' }
      )
    })
  }

  function handleTest(platform: 'slack' | 'teams') {
    const url = (platform === 'slack' ? slackRef.current?.value : teamsRef.current?.value) ?? ''
    if (!url.trim()) {
      setTestStatus((prev) => ({
        ...prev,
        [platform]: { ok: false, message: 'Enter a URL first.' },
      }))
      return
    }
    setTestStatus((prev) => ({ ...prev, [platform]: null }))
    const start = platform === 'slack' ? startTestSlack : startTestTeams
    start(async () => {
      const { error } = await testWebhook(url)
      setTestStatus((prev) => ({
        ...prev,
        [platform]: error
          ? { ok: false, message: error }
          : { ok: true, message: 'Test notification sent!' },
      }))
    })
  }

  const inputClass =
    'flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-mono'

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Slack */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Slack Incoming Webhook URL</label>
        <p className="text-xs text-muted-foreground">
          In your Slack app, go to <strong>Incoming Webhooks</strong> and copy the webhook URL
          (starts with <code>https://hooks.slack.com/services/…</code>).
        </p>
        <div className="flex gap-2">
          <input
            ref={slackRef}
            type="url"
            defaultValue={initialSlackUrl ?? ''}
            placeholder="https://hooks.slack.com/services/T…/B…/…"
            className={inputClass}
          />
          <button
            type="button"
            disabled={testSlackPending}
            onClick={() => handleTest('slack')}
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {testSlackPending ? 'Sending…' : 'Test'}
          </button>
        </div>
        {testStatus.slack && (
          <p className={`text-xs ${testStatus.slack.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testStatus.slack.message}
          </p>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Microsoft Teams Incoming Webhook URL
        </label>
        <p className="text-xs text-muted-foreground">
          In Teams, open a channel &rarr; <strong>Manage Channel</strong> &rarr;{' '}
          <strong>Connectors</strong> &rarr; <strong>Incoming Webhook</strong> &rarr; configure and
          copy the URL (contains <code>webhook.office.com</code>).
        </p>
        <div className="flex gap-2">
          <input
            ref={teamsRef}
            type="url"
            defaultValue={initialTeamsUrl ?? ''}
            placeholder="https://xxx.webhook.office.com/webhookb2/…"
            className={inputClass}
          />
          <button
            type="button"
            disabled={testTeamsPending}
            onClick={() => handleTest('teams')}
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {testTeamsPending ? 'Sending…' : 'Test'}
          </button>
        </div>
        {testStatus.teams && (
          <p className={`text-xs ${testStatus.teams.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testStatus.teams.message}
          </p>
        )}
      </div>

      {saveStatus && (
        <p className={`text-sm ${saveStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
          {saveStatus.message}
        </p>
      )}

      <button
        type="submit"
        disabled={savePending}
        className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {savePending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
