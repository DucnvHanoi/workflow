import { getPlatformAIConfig, getPlatformAIUsageLogs } from '@/lib/platform/ai-config-actions'
import { PlatformAISettingsCard } from '@/components/platform/PlatformAISettingsCard'

export default async function PlatformAISettingsPage() {
  const [{ data: config }, { data: usageLogs }] = await Promise.all([
    getPlatformAIConfig(),
    getPlatformAIUsageLogs(50),
  ])

  const initial = config ?? {
    aiEnabled: false,
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
    hasAnthropicKey: false,
    hasOpenAIKey: false,
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure the AI model and API keys used to automatically respond to inbound support
          emails.
        </p>
      </div>

      <PlatformAISettingsCard initial={initial} usageLogs={usageLogs} />
    </div>
  )
}
