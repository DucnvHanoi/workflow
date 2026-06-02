'use client'

import { useState, useTransition } from 'react'
import {
  updatePlatformAIConfig,
  savePlatformAPIKey,
  removePlatformAPIKey,
} from '@/lib/platform/ai-config-actions'
import type { PlatformAIConfigData, PlatformAIUsageEntry } from '@/lib/platform/ai-config-actions'
import { MODELS_BY_PROVIDER, DEFAULT_MODEL } from '@/lib/ai/pricing'

interface Props {
  initial: PlatformAIConfigData
  usageLogs: PlatformAIUsageEntry[]
}

export function PlatformAISettingsCard({ initial, usageLogs }: Props) {
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled)
  const [provider, setProvider] = useState<'anthropic' | 'openai'>(initial.provider)
  const [model, setModel] = useState(initial.model)

  // Key state per provider — track independently
  const [hasAnthropicKey, setHasAnthropicKey] = useState(initial.hasAnthropicKey)
  const [hasOpenAIKey, setHasOpenAIKey] = useState(initial.hasOpenAIKey)
  const [anthropicInput, setAnthropicInput] = useState('')
  const [openaiInput, setOpenaiInput] = useState('')
  const [showAnthropicInput, setShowAnthropicInput] = useState(false)
  const [showOpenAIInput, setShowOpenAIInput] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      const { error: err } = await updatePlatformAIConfig({ aiEnabled: enabled })
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
      const { error: err } = await updatePlatformAIConfig({ provider: p, model: newModel })
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
      const { error: err } = await updatePlatformAIConfig({ model: m })
      if (err) {
        setModel(prev)
        flash(err, 'error')
      }
    })
  }

  function handleSaveKey(p: 'anthropic' | 'openai') {
    const input = p === 'anthropic' ? anthropicInput : openaiInput
    if (!input.trim()) return
    startTransition(async () => {
      const { error: err } = await savePlatformAPIKey(p, input.trim())
      if (err) {
        flash(err, 'error')
      } else {
        if (p === 'anthropic') {
          setHasAnthropicKey(true)
          setAnthropicInput('')
          setShowAnthropicInput(false)
        } else {
          setHasOpenAIKey(true)
          setOpenaiInput('')
          setShowOpenAIInput(false)
        }
        flash(`${p === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key saved.`, 'success')
      }
    })
  }

  function handleRemoveKey(p: 'anthropic' | 'openai') {
    startTransition(async () => {
      const { error: err } = await removePlatformAPIKey(p)
      if (err) {
        flash(err, 'error')
      } else {
        if (p === 'anthropic') {
          setHasAnthropicKey(false)
          setShowAnthropicInput(false)
        } else {
          setHasOpenAIKey(false)
          setShowOpenAIInput(false)
        }
        flash(`${p === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key removed.`, 'success')
      }
    })
  }

  const availableModels = MODELS_BY_PROVIDER[provider] ?? []

  const totalCost = usageLogs.reduce((sum, r) => sum + r.costUsd, 0)
  const totalCalls = usageLogs.length

  return (
    <div className="space-y-8">
      {/* ── Enable / disable ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI Email Responder
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            When enabled, inbound support emails are automatically answered by the configured AI
            model. Billing and sensitive queries are always escalated to a human.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">Enable AI auto-responses</p>
          <button
            type="button"
            role="switch"
            aria-checked={aiEnabled}
            disabled={isPending}
            onClick={() => handleToggleAI(!aiEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              aiEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                aiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {aiEnabled && (
          <>
            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'openai')}
                disabled={isPending}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Model</p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {availableModels.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      model === m.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name="ai-model"
                      value={m.id}
                      checked={model === m.id}
                      onChange={() => handleModelChange(m.id)}
                      disabled={isPending}
                      className="mt-0.5 accent-indigo-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {m.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap mt-0.5">
                      {m.pricing}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {(error || success) && (
          <p className={`text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
            {error ?? success}
          </p>
        )}
      </section>

      {/* ── API Keys ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">API Keys</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Both keys are stored encrypted. The active provider above determines which key is used.
            Pre-enter both to switch providers without re-entering keys.
          </p>
        </div>

        {/* Anthropic key */}
        <KeyRow
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          hasKey={hasAnthropicKey}
          showInput={showAnthropicInput}
          inputValue={anthropicInput}
          isPending={isPending}
          isActive={provider === 'anthropic' && aiEnabled}
          onShowInput={() => setShowAnthropicInput(true)}
          onCancelInput={() => {
            setShowAnthropicInput(false)
            setAnthropicInput('')
          }}
          onInputChange={setAnthropicInput}
          onSave={() => handleSaveKey('anthropic')}
          onRemove={() => handleRemoveKey('anthropic')}
        />

        {/* OpenAI key */}
        <KeyRow
          label="OpenAI API Key"
          placeholder="sk-..."
          hasKey={hasOpenAIKey}
          showInput={showOpenAIInput}
          inputValue={openaiInput}
          isPending={isPending}
          isActive={provider === 'openai' && aiEnabled}
          onShowInput={() => setShowOpenAIInput(true)}
          onCancelInput={() => {
            setShowOpenAIInput(false)
            setOpenaiInput('')
          }}
          onInputChange={setOpenaiInput}
          onSave={() => handleSaveKey('openai')}
          onRemove={() => handleRemoveKey('openai')}
        />
      </section>

      {/* ── Usage log ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Usage
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 50 support email AI calls</p>
          </div>
          {totalCalls > 0 && (
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                ${totalCost.toFixed(4)}
              </p>
              <p className="text-xs text-slate-400">{totalCalls} calls shown</p>
            </div>
          )}
        </div>

        {usageLogs.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">No AI calls yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Provider / Model</th>
                  <th className="px-4 py-3 text-right font-medium">Input</th>
                  <th className="px-4 py-3 text-right font-medium">Output</th>
                  <th className="px-4 py-3 text-right font-medium">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usageLogs.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {row.provider}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {row.model}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {row.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {row.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                      ${row.costUsd.toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── KeyRow sub-component ─────────────────────────────────────────────────────

interface KeyRowProps {
  label: string
  placeholder: string
  hasKey: boolean
  showInput: boolean
  inputValue: string
  isPending: boolean
  isActive: boolean
  onShowInput: () => void
  onCancelInput: () => void
  onInputChange: (v: string) => void
  onSave: () => void
  onRemove: () => void
}

function KeyRow({
  label,
  placeholder,
  hasKey,
  showInput,
  inputValue,
  isPending,
  isActive,
  onShowInput,
  onCancelInput,
  onInputChange,
  onSave,
  onRemove,
}: KeyRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        {isActive && (
          <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            Active
          </span>
        )}
      </div>

      {hasKey && !showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value="••••••••••••••••••••••••"
            readOnly
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
          <button
            type="button"
            onClick={onShowInput}
            disabled={isPending}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={isPending}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {hasKey && (
            <button
              type="button"
              onClick={onCancelInput}
              disabled={isPending}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={isPending || !inputValue.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}
