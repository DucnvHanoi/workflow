'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateAISettings, saveAPIKey, removeAPIKey } from '@/lib/ai/ai-settings-actions'
import type { AISettingsData } from '@/lib/ai/ai-settings-actions'
import { MODELS_BY_PROVIDER, DEFAULT_MODEL } from '@/lib/ai/pricing'

interface Props {
  initial: AISettingsData
  plan: string
}

export function AISettingsCard({ initial, plan }: Props) {
  const isFreePlan = plan === 'free'
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled)
  const [provider, setProvider] = useState<'anthropic' | 'openai'>(initial.provider)
  const [model, setModel] = useState(initial.model)
  const [useOwnKey, setUseOwnKey] = useState(initial.useOwnKey)
  const [hasOwnKey, setHasOwnKey] = useState(initial.hasOwnKey)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(initial.useOwnKey && !initial.hasOwnKey)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const creditPct =
    initial.creditLimitUsd > 0
      ? Math.min((initial.creditUsedUsd / initial.creditLimitUsd) * 100, 100)
      : 0

  function flash(msg: string, type: 'success' | 'error') {
    if (type === 'success') {
      setSuccess(msg)
      setError(null)
    } else {
      setError(msg)
      setSuccess(null)
    }
    setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 4000)
  }

  function handleToggleAI(enabled: boolean) {
    setAiEnabled(enabled)
    startTransition(async () => {
      const { error: err } = await updateAISettings({ aiEnabled: enabled })
      if (err) {
        setAiEnabled(!enabled)
        flash(err, 'error')
      }
    })
  }

  function handleProviderChange(p: 'anthropic' | 'openai') {
    const prevProvider = provider
    const prevModel = model
    const newModel = DEFAULT_MODEL[p]
    setProvider(p)
    setModel(newModel)
    startTransition(async () => {
      const { error: err } = await updateAISettings({ provider: p, model: newModel })
      if (err) {
        setProvider(prevProvider)
        setModel(prevModel)
        flash(err, 'error')
      }
    })
  }

  function handleModelChange(m: string) {
    const prev = model
    setModel(m)
    startTransition(async () => {
      const { error: err } = await updateAISettings({ model: m })
      if (err) {
        setModel(prev)
        flash(err, 'error')
      }
    })
  }

  function handleKeySourceChange(own: boolean) {
    const prev = useOwnKey
    setUseOwnKey(own)
    if (own && !hasOwnKey) setShowKeyInput(true)
    if (!own) setShowKeyInput(false)
    startTransition(async () => {
      const { error: err } = await updateAISettings({ useOwnKey: own })
      if (err) {
        setUseOwnKey(prev)
        flash(err, 'error')
      }
    })
  }

  function handleSaveKey() {
    if (!apiKeyInput.trim()) return
    startTransition(async () => {
      const { error: err } = await saveAPIKey(apiKeyInput.trim())
      if (err) {
        flash(err, 'error')
      } else {
        setHasOwnKey(true)
        setShowKeyInput(false)
        setApiKeyInput('')
        flash('API key saved.', 'success')
      }
    })
  }

  function handleRemoveKey() {
    startTransition(async () => {
      const { error: err } = await removeAPIKey()
      if (err) {
        flash(err, 'error')
      } else {
        setHasOwnKey(false)
        setUseOwnKey(false)
        setShowKeyInput(false)
        flash('API key removed.', 'success')
      }
    })
  }

  const availableModels = MODELS_BY_PROVIDER[provider] ?? []

  return (
    <div className="space-y-5">
      {/* Free-plan upgrade notice */}
      {isFreePlan && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI features are not available on the Free plan.{' '}
          <Link
            href="?tab=billing"
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
          >
            Upgrade to Pro
          </Link>{' '}
          to enable them.
        </div>
      )}

      {/* Enable / disable AI */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Enable AI features</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allow your team to use AI-powered tools.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aiEnabled}
          disabled={isPending || isFreePlan}
          onClick={() => !isFreePlan && handleToggleAI(!aiEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            aiEnabled && !isFreePlan ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              aiEnabled && !isFreePlan ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {aiEnabled && (
        <>
          <hr className="border-border" />

          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'openai')}
              disabled={isPending}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Model</p>
            <div className="rounded-lg border border-input overflow-hidden divide-y divide-border">
              {availableModels.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    model === m.id ? 'bg-primary/5' : 'hover:bg-muted/40'
                  } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="ai-model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={() => handleModelChange(m.id)}
                    disabled={isPending}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap mt-0.5">
                    {m.pricing}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Key source */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">API Key Source</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="key-source"
                  checked={!useOwnKey}
                  onChange={() => handleKeySourceChange(false)}
                  disabled={isPending}
                  className="accent-primary"
                />
                Platform key
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="key-source"
                  checked={useOwnKey}
                  onChange={() => handleKeySourceChange(true)}
                  disabled={isPending}
                  className="accent-primary"
                />
                Your own key
              </label>
            </div>
            {!useOwnKey && (
              <p className="text-xs text-muted-foreground">
                Usage is billed against your organisation&apos;s credit quota.
              </p>
            )}
          </div>

          {/* Own key input */}
          {useOwnKey && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
              </label>
              {hasOwnKey && !showKeyInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value="••••••••••••••••••••••••"
                    readOnly
                    className="flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(true)}
                    disabled={isPending}
                    className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    disabled={isPending}
                    className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={`Paste your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                  {hasOwnKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowKeyInput(false)
                        setApiKeyInput('')
                      }}
                      disabled={isPending}
                      className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={isPending || !apiKeyInput.trim()}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Credit usage (platform key only) */}
          {!useOwnKey && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credit usage</span>
                <span className="font-medium tabular-nums">
                  ${initial.creditUsedUsd.toFixed(2)}{' '}
                  <span className="text-muted-foreground font-normal">
                    / ${initial.creditLimitUsd.toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditPct >= 90
                      ? 'bg-destructive'
                      : creditPct >= 70
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                  }`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Contact your platform administrator to increase the credit limit.
              </p>
            </div>
          )}
        </>
      )}

      {(error || success) && (
        <p className={`text-sm ${error ? 'text-destructive' : 'text-green-600'}`}>
          {error ?? success}
        </p>
      )}
    </div>
  )
}
