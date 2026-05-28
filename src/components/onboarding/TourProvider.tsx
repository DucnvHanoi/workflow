'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { X, ChevronRight } from 'lucide-react'
import { markOnboardingStep } from '@/lib/onboarding/actions'

// ─── Tour step definitions ────────────────────────────────────────────────────

interface TourStep {
  target: string // data-tour attribute value
  title: string
  body: string
  placement: 'right' | 'bottom'
}

const USER_STEPS: TourStep[] = [
  {
    target: 'task-list',
    title: 'Your Tasks',
    body: 'Steps assigned to you appear here. Click "Open" on any task to take action and keep workflows moving.',
    placement: 'bottom',
  },
  {
    target: 'nav-start-flow',
    title: 'Start a Flow',
    body: 'Browse published flows and kick off approval requests on behalf of yourself or your team.',
    placement: 'right',
  },
  {
    target: 'my-flows-tab',
    title: 'Track Your Flows',
    body: 'See every flow you&apos;ve started, its current status, and where it is in the approval chain.',
    placement: 'bottom',
  },
]

const ADMIN_STEPS: TourStep[] = [
  {
    target: 'task-list',
    title: 'Your Tasks',
    body: 'Steps assigned to you appear here. Click "Open" to take action and keep workflows moving.',
    placement: 'bottom',
  },
  {
    target: 'nav-flow-builder',
    title: 'Flow Builder',
    body: 'Design and publish multi-step approval workflows for your team using the drag-and-drop builder.',
    placement: 'right',
  },
  {
    target: 'nav-invite',
    title: 'Invite Your Team',
    body: 'Bring colleagues on board so they can participate in your workflows as approvers or requesters.',
    placement: 'right',
  },
]

// ─── Context ──────────────────────────────────────────────────────────────────

interface TourContextValue {
  startTour: () => void
  active: boolean
}

const TourContext = createContext<TourContextValue>({ startTour: () => {}, active: false })

export function useTour() {
  return useContext(TourContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
  role: string
  completedStepKeys: string[]
}

export function TourProvider({ children, role, completedStepKeys }: Props) {
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)
  const autoStarted = useRef(false)

  const steps = role === 'admin' ? ADMIN_STEPS : USER_STEPS
  const active = stepIndex !== null
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
  }, [])

  // Auto-start for non-admins who haven't completed the tour.
  // Only fires when the user is on /tasks so data-tour elements exist in the DOM.
  useEffect(() => {
    if (autoStarted.current) return
    if (role === 'admin') return
    if (completedStepKeys.includes('tour_completed')) return
    if (pathname !== '/tasks') return
    autoStarted.current = true
    const t = setTimeout(() => setStepIndex(0), 800)
    return () => clearTimeout(t)
  }, [role, completedStepKeys, pathname])

  // Update rect when stepIndex changes
  useEffect(() => {
    if (stepIndex === null) {
      setRect(null)
      return
    }
    const target = steps[stepIndex]?.target
    if (!target) return
    const el = document.querySelector(`[data-tour="${target}"]`)
    if (el) {
      setRect(el.getBoundingClientRect())
    }
  }, [stepIndex, steps])

  // Update rect on scroll/resize
  useEffect(() => {
    if (stepIndex === null) return
    function update() {
      const target = steps[stepIndex!]?.target
      if (!target) return
      const el = document.querySelector(`[data-tour="${target}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [stepIndex, steps])

  const closeTour = useCallback(async (completed: boolean) => {
    setStepIndex(null)
    setRect(null)
    if (completed) {
      await markOnboardingStep('tour_completed')
    }
  }, [])

  const next = useCallback(() => {
    if (stepIndex === null) return
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1)
    } else {
      closeTour(true)
    }
  }, [stepIndex, steps.length, closeTour])

  const skip = useCallback(() => {
    closeTour(false)
  }, [closeTour])

  return (
    <TourContext.Provider value={{ startTour, active }}>
      {children}
      {mounted &&
        active &&
        rect &&
        createPortal(
          <TourOverlay
            rect={rect}
            step={steps[stepIndex!]}
            stepIndex={stepIndex!}
            totalSteps={steps.length}
            onNext={next}
            onSkip={skip}
          />,
          document.body
        )}
    </TourContext.Provider>
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

const PAD = 6

interface OverlayProps {
  rect: DOMRect
  step: TourStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
}

function TourOverlay({ rect, step, stepIndex, totalSteps, onNext, onSkip }: OverlayProps) {
  const isLast = stepIndex === totalSteps - 1

  // Spotlight box (slightly padded around target)
  const spotlight = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  }

  // Position tooltip
  const TOOLTIP_W = 280
  let tooltipStyle: React.CSSProperties = {}
  if (step.placement === 'right') {
    tooltipStyle = {
      top: spotlight.top,
      left: spotlight.left + spotlight.width + 16,
      width: TOOLTIP_W,
    }
  } else {
    // bottom
    tooltipStyle = {
      top: spotlight.top + spotlight.height + 16,
      left: Math.max(8, spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2),
      width: TOOLTIP_W,
    }
  }

  return (
    <>
      {/* Semi-transparent backdrop with spotlight cutout */}
      <div
        className="fixed inset-0 z-[9997] pointer-events-none"
        style={{
          background: 'transparent',
        }}
      />
      {/* Spotlight element */}
      <div
        className="fixed z-[9998] rounded-lg pointer-events-none"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          borderRadius: 8,
        }}
      />
      {/* Tooltip */}
      <div
        className="fixed z-[9999] rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        style={tooltipStyle}
      >
        <div className="p-4">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug">{step.title}</p>
            <button
              onClick={onSkip}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Close tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p
            className="mb-4 text-xs text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: step.body }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {stepIndex + 1} / {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
              <button
                onClick={onNext}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ChevronRight className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
