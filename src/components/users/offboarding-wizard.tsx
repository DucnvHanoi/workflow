'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Users, Building2, ClipboardList, ShieldOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { bulkReassignTasks } from '@/lib/flows/actions'
import {
  clearManagerRelationships,
  removeDeptHeadRoles,
  deactivateUser,
} from '@/app/(app)/users/actions'

type ActiveUser = { id: string; full_name: string | null; email: string }
type DirectReport = { id: string; full_name: string | null; email: string }
type Dept = { id: string; name: string }

interface Props {
  user: { id: string; full_name: string | null; email: string; is_active: boolean }
  pendingCount: number
  activeUsers: ActiveUser[]
  directReports: DirectReport[]
  deptHeadOf: Dept[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type StepKey = 'overview' | 'tasks' | 'reports' | 'depthead' | 'deactivate' | 'done'

export function OffboardingWizard({
  user,
  pendingCount,
  activeUsers,
  directReports,
  deptHeadOf,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reassignTo, setReassignTo] = useState('')
  const [currentStepIdx, setCurrentStepIdx] = useState(0)

  const name = user.full_name ?? user.email

  // Build dynamic step list
  const steps: StepKey[] = ['overview']
  if (pendingCount > 0) steps.push('tasks')
  if (directReports.length > 0) steps.push('reports')
  if (deptHeadOf.length > 0) steps.push('depthead')
  steps.push('deactivate')

  const currentStep = steps[currentStepIdx] ?? 'done'
  const isLastStep = currentStepIdx === steps.length - 1
  const candidates = activeUsers.filter((u) => u.id !== user.id)

  function advance() {
    if (isLastStep) return
    setCurrentStepIdx((i) => i + 1)
  }

  function handleClose() {
    setCurrentStepIdx(0)
    setReassignTo('')
    onOpenChange(false)
    router.refresh()
  }

  function runStep(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn()
        if (isLastStep) {
          toast.success(`${name} has been offboarded.`)
          handleClose()
        } else {
          advance()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const stepNumber = currentStepIdx + 1
  const totalSteps = steps.length

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Offboard {name}</DialogTitle>
            <span className="text-xs text-muted-foreground">
              Step {stepNumber} of {totalSteps}
            </span>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 pt-1">
            {steps.map((s, idx) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  idx < currentStepIdx
                    ? 'bg-green-500'
                    : idx === currentStepIdx
                      ? 'bg-primary'
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* ── Overview ── */}
          {currentStep === 'overview' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This wizard will guide you through safely offboarding{' '}
                <span className="font-medium text-foreground">{name}</span>.
              </p>
              <ul className="space-y-2 text-sm">
                {pendingCount > 0 && (
                  <li className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                    Reassign <strong>{pendingCount}</strong> pending task
                    {pendingCount !== 1 ? 's' : ''}
                  </li>
                )}
                {directReports.length > 0 && (
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    Clear manager for <strong>{directReports.length}</strong> direct report
                    {directReports.length !== 1 ? 's' : ''}
                  </li>
                )}
                {deptHeadOf.length > 0 && (
                  <li className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    Remove as head of <strong>{deptHeadOf.map((d) => d.name).join(', ')}</strong>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  Deactivate account — user will be banned from logging in
                </li>
              </ul>
            </div>
          )}

          {/* ── Reassign tasks ── */}
          {currentStep === 'tasks' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>{pendingCount}</strong> pending task{pendingCount !== 1 ? 's are' : ' is'}{' '}
                assigned to {name}. Choose who should take them over.
              </p>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email}
                      {u.full_name && (
                        <span className="ml-1 text-muted-foreground text-xs">({u.email})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Clear reporting ── */}
          {currentStep === 'reports' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The following users currently report to {name}. Their manager will be cleared — you
                can reassign them later via the Org Chart.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {directReports.map((r) => (
                  <Badge key={r.id} variant="secondary">
                    {r.full_name ?? r.email}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ── Dept head ── */}
          {currentStep === 'depthead' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {name} is the designated head of the following department
                {deptHeadOf.length !== 1 ? 's' : ''}. The head role will be cleared.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {deptHeadOf.map((d) => (
                  <Badge key={d.id} variant="outline">
                    <Building2 className="h-3 w-3 mr-1" />
                    {d.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ── Deactivate ── */}
          {currentStep === 'deactivate' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Final step: deactivate <span className="font-medium text-foreground">{name}</span>.
                They will be immediately banned from logging in. Their history and audit trail are
                preserved. You can reactivate them at any time.
              </p>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                This action will prevent {name} from accessing the system.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>

          {currentStep === 'overview' && <Button onClick={advance}>Start offboarding</Button>}

          {currentStep === 'tasks' && (
            <Button
              disabled={!reassignTo || isPending}
              onClick={() =>
                runStep(async () => {
                  const { error } = await bulkReassignTasks(user.id, reassignTo)
                  if (error) throw new Error(error)
                })
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Reassign {pendingCount} task{pendingCount !== 1 ? 's' : ''}
            </Button>
          )}

          {currentStep === 'reports' && (
            <Button
              disabled={isPending}
              onClick={() => runStep(() => clearManagerRelationships(user.id))}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Clear {directReports.length} manager relationship
              {directReports.length !== 1 ? 's' : ''}
            </Button>
          )}

          {currentStep === 'depthead' && (
            <Button
              disabled={isPending}
              onClick={() => runStep(() => removeDeptHeadRoles(user.id))}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Remove dept head role{deptHeadOf.length !== 1 ? 's' : ''}
            </Button>
          )}

          {currentStep === 'deactivate' && (
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => runStep(() => deactivateUser(user.id))}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Deactivate {name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
