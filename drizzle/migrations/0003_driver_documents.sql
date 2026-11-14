CREATE TABLE public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  document_number text NOT NULL DEFAULT '',
  reference_date date,
  valid_until date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text NOT NULL DEFAULT '',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (user_id, doc_type)
);
GRANT SELECT ON public.driver_documents TO authenticated;
GRANT ALL ON public.driver_documents TO service_role;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_documents_read ON public.driver_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.driver_documents IS 'Mandatory French VTC documents, one current file per type; writes go through the server (status set by admins only).';

CREATE POLICY driver_documents_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY driver_documents_read_own_or_admin ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY driver_documents_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);