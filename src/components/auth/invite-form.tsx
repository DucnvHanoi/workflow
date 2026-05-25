'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteUser } from '@/app/(app)/invite/actions'

export function InviteForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!email.trim()) return

    startTransition(async () => {
      const result = await inviteUser(email, role)
      if (result.success) {
        toast.success(`Invite sent to ${email}.`)
        setEmail('')
        setRole('user')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="colleague@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSubmit} disabled={isPending || !email.trim()}>
        {isPending ? 'Sending...' : 'Send invite'}
      </Button>
    </div>
  )
}
