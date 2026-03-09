
-- Create table for DOU readings (one per uploaded PDF)
CREATE TABLE public.dou_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_date DATE NOT NULL,
  pdf_filename TEXT NOT NULL,
  total_opportunities INTEGER NOT NULL DEFAULT 0,
  total_competitor_mentions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for individual publications found in each reading
CREATE TABLE public.dou_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_id UUID NOT NULL REFERENCES public.dou_readings(id) ON DELETE CASCADE,
  publication_type TEXT NOT NULL,
  section TEXT NOT NULL,
  organ TEXT,
  object_text TEXT,
  full_text TEXT NOT NULL,
  state TEXT,
  is_relevant BOOLEAN NOT NULL DEFAULT false,
  competitor_match TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dou_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dou_publications ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for this internal tool)
CREATE POLICY "Allow all access to dou_readings" ON public.dou_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to dou_publications" ON public.dou_publications FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_dou_readings_date ON public.dou_readings(reading_date DESC);
CREATE INDEX idx_dou_publications_reading ON public.dou_publications(reading_id);
CREATE INDEX idx_dou_publications_section ON public.dou_publications(section);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dou_readings_updated_at
  BEFORE UPDATE ON public.dou_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
