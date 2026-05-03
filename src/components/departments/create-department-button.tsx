'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateDepartmentDialog } from './create-department-dialog'

interface Props {
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

export function CreateDepartmentButton({ allDepartments }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Department</Button>
      <CreateDepartmentDialog open={open} onOpenChange={setOpen} allDepartments={allDepartments} />
    </>
  )
}
