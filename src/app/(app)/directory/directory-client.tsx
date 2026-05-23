'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export type DirectoryUser = {
  id: string
  name: string | null
  email: string
  role: string
  department: string | null
  department_id: string | null
}

export type Department = {
  id: string
  name: string
}

interface Props {
  users: DirectoryUser[]
  departments: Department[]
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function DirectoryClient({ users, departments }: Props) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (deptFilter !== 'all' && u.department_id !== deptFilter) return false
      if (!q) return true
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name?.toLowerCase().includes(q) ?? false) ||
        (u.department?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [users, search, deptFilter])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm rounded-lg border border-dashed">
          No users match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm shrink-0 ${avatarColor(u.id)}`}
              >
                {getInitials(u.name, u.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-tight">{u.name ?? u.email}</p>
                {u.name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {u.department && (
                    <span className="text-xs text-muted-foreground truncate">{u.department}</span>
                  )}
                  <Badge
                    variant={u.role === 'admin' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {u.role}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
