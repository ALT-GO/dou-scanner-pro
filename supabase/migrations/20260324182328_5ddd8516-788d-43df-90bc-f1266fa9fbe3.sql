
-- Create documents table for storing extracted text
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url TEXT,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_details TEXT,
  reading_id UUID REFERENCES public.dou_readings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow all access (same as other tables in this project)
CREATE POLICY "Allow all access to documents" ON public.documents
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('dou-pdfs', 'dou-pdfs', true);

-- Storage RLS: allow public uploads and reads
CREATE POLICY "Allow public upload to dou-pdfs" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'dou-pdfs');

CREATE POLICY "Allow public read from dou-pdfs" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'dou-pdfs');
