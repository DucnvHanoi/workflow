'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { markOnboardingStep } from '@/lib/onboarding/actions'
import type { AdminChecklistState } from '@/lib/onboarding/actions'

interface Step {
  key: keyof Omit<AdminChecklistState, 'dismissed'>
  label: string
  description: string
  href: string
  cta: string
}

const STEPS: Step[] = [
  {
    key: 'createdFlow',
    label: 'Create your first flow',
    description: 'Use the Flow Builder to design an approval workflow.',
    href: '/flows',
    cta: 'Go to Flow Builder',
  },
  {
    key: 'publishedFlow',
    label: 'Publish a flow',
    description: 'Activate a flow so your team can start submitting requests.',
    href: '/flows',
    cta: 'Open Flows',
  },
  {
    key: 'invitedUser',
    label: 'Invite a team member',
    description: 'Bring in colleagues so they can participate in workflows.',
    href: '/invite',
    cta: 'Invite someone',
  },
  {
    key: 'setupDepartment',
    label: 'Set up a department',
    description: 'Organise your team into departments for targeted assignments.',
    href: '/departments',
    cta: 'Manage departments',
  },
  {
    key: 'enabledAi',
    label: 'Enable AI features',
    description: 'Configure AI-assisted approvals and smart summaries.',
    href: '/settings',
    cta: 'Configure AI',
  },
]

interface Props {
  state: AdminChecklistState
}

export function AdminChecklist({ state }: Props) {
  const [dismissed, setDismissed] = useState(state.dismissed)
  const [collapsed, setCollapsed] = useState(false)
  const [, startTransition] = useTransition()

  const completed = STEPS.filter((s) => state[s.key]).length
  const allDone = completed === STEPS.length

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    startTransition(async () => {
      await markOnboardingStep('checklist_dismissed')
    })
  }

  return (
    <div className="mb-6 rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {completed}/{STEPS.length}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {allDone ? 'Workspace set up complete!' : 'Set up your workspace'}
            </p>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? 'You&apos;re all set. Dismiss this checklist whenever you&apos;re ready.'
                : `${STEPS.length - completed} step${STEPS.length - completed !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-5 mb-4 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(completed / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="divide-y border-t">
          {STEPS.map((step) => {
            const done = state[step.key]
            return (
              <div
                key={step.key}
                className={`flex items-start gap-4 px-5 py-3.5 ${done ? 'opacity-60' : ''}`}
              >
                <div className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {step.label}
                  </p>
                  {!done && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
                {!done && (
                  <Link
                    href={step.href}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {step.cta} →
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
