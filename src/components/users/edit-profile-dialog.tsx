'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { updateUserProfile } from '@/app/(app)/users/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; full_name: string | null; email: string } | undefined
}

export function EditProfileDialog({ open, onOpenChange, user }: Props) {
  // _open is unused parameter
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  // Sync form values when dialog opens with a new user
  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name ?? '')
      setEmail(user.email)
    }
  }, [open, user])

  if (!user) return null

  const isUnchanged = fullName.trim() === (user.full_name ?? '') && email.trim() === user.email

  function handleSave() {
    if (!user) return
    startTransition(async () => {
      try {
        await updateUserProfile(user.id, { full_name: fullName, email })
        toast.success('Profile updated.')
        router.refresh()
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update profile.')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update the name and email for <strong>{user.full_name ?? user.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Changing email updates both their profile and login credentials.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || isUnchanged}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
