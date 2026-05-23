-- Migration: add_profile_fields
-- Adds job_title, phone, avatar_url to public.users
-- Creates the public 'avatars' storage bucket with per-user RLS

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS job_title  text,
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── Avatars storage bucket ────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (bucket is public, but explicit policy for clarity)
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload/replace their own avatar
-- Path convention: {userId}/avatar  (first path segment = user id)
CREATE POLICY "avatars_user_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
