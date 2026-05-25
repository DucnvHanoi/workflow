'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { updateAvatarUrl } from '@/app/(app)/profiles/actions'

interface Props {
  userId: string
  currentAvatarUrl: string | null
  initials: string
}

export function AvatarUpload({ userId, currentAvatarUrl, initials }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG or WebP).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    startTransition(async () => {
      const supabase = createClient()
      const path = `${userId}/avatar`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        toast.error('Upload failed: ' + uploadError.message)
        setPreview(currentAvatarUrl)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust so the browser fetches the new image
      const publicUrl = data.publicUrl + '?t=' + Date.now()

      const result = await updateAvatarUrl(publicUrl)
      if (result.error) {
        toast.error(result.error)
        setPreview(currentAvatarUrl)
      } else {
        toast.success('Avatar updated.')
      }
    })
  }

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="group relative shrink-0 focus:outline-none"
        aria-label="Change avatar"
      >
        <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold text-xl select-none">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
          {isPending ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>

      <div className="space-y-1">
        <p className="text-sm font-medium">Profile photo</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 2 MB</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {isPending ? 'Uploading…' : 'Change photo'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
