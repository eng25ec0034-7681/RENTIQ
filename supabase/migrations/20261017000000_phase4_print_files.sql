-- Phase 4 Batch B: Customer Print Order Files Storage & Cleanup Migration

-- 1. Create private storage bucket "print-files"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]::text[];

-- 2. Storage policies on storage.objects for bucket "print-files"
-- Authenticated users only where the first folder equals auth.uid()::text
-- No UPDATE or DELETE policies for clients
DROP POLICY IF EXISTS "print_files_insert" ON storage.objects;
CREATE POLICY "print_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'print-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "print_files_select" ON storage.objects;
CREATE POLICY "print_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'print-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Cleanup function for expired print files
-- The scheduled job (later, using the service role key and the Storage API) calls this function and then removes these paths with supabase.storage.from('print-files').remove(paths).
DROP FUNCTION IF EXISTS public.purge_expired_print_files();
CREATE OR REPLACE FUNCTION public.purge_expired_print_files()
RETURNS TABLE (file_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT po.file_path
  FROM public.print_orders po
  WHERE po.file_path IS NOT NULL
    AND po.status IN ('COMPLETED', 'CANCELLED')
    AND po.updated_at < (NOW() - INTERVAL '48 hours');
END;
$$;

-- Executable only by service_role
REVOKE EXECUTE ON FUNCTION public.purge_expired_print_files() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_print_files() TO service_role;

-- 4. Add file_path column to print_orders
ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS file_path text;
