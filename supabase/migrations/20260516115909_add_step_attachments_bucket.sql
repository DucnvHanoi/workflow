-- Migration: add_step_attachments_bucket
-- Creates the Supabase Storage bucket for step file uploads.
-- Path convention: {tenant_id}/{instance_id}/{step_id}/{field_id}/{filename}
--
-- Run after applying this migration:
--   npx supabase storage create step-attachments --public=false
-- OR create it via the Supabase Dashboard → Storage → New bucket
--   Name: step-attachments
--   Public: NO (private — signed URLs used for downloads)
--   File size limit: 10485760 (10 MB)

-- ── Storage RLS policies ─────────────────────────────────────────────────────
-- These control who can upload/download from the bucket via the JS client.
-- All writes in server actions use the service role key which bypasses RLS.

-- Allow authenticated users to READ files in their own tenant's folder.
-- The path starts with their tenant_id, so we match on that prefix.
CREATE POLICY "tenant_users_can_read_own_attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'step-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

-- Allow authenticated users to INSERT (upload) into their tenant's folder.
CREATE POLICY "tenant_users_can_upload_attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'step-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

-- Allow authenticated users to DELETE their own uploads.
CREATE POLICY "tenant_users_can_delete_own_attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'step-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );
