import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FileUpload } from '@/components/FileUpload';
import { StatsCards } from '@/components/StatsCards';
import { ReadingHistory } from '@/components/ReadingHistory';
import { PublicationsView } from '@/components/PublicationsView';
import { extractTextFromPDF } from '@/lib/pdf-extractor';
import { generateReport } from '@/lib/report-generator';
import { supabase } from '@/integrations/supabase/client';

interface Reading {
  id: string;
  reading_date: string;
  pdf_filename: string;
  total_opportunities: number;
  total_competitor_mentions: number;
  status: string;
}

interface Publication {
  id: string;
  publication_type: string;
  section: string;
  organ: string | null;
  object_text: string | null;
  full_text: string;
  state: string | null;
  is_relevant: boolean;
  competitor_match: string | null;
}

export default function Index() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    const { data, error } = await supabase
      .from('dou_readings')
      .select('*')
      .order('reading_date', { ascending: false });
    if (error) {
      console.error('Error fetching readings:', error);
      return;
    }
    setReadings(data || []);
  }, []);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const fetchPublications = async (readingId: string) => {
    const { data, error } = await supabase
      .from('dou_publications')
      .select('*')
      .eq('reading_id', readingId);
    if (error) {
      toast.error('Erro ao carregar publicações');
      return;
    }
    setPublications(data || []);
  };

  const handleFileSelected = async (file: File) => {
    setIsProcessing(true);
    try {
      toast.info('Extraindo texto do PDF...');
      const text = await extractTextFromPDF(file);

      if (!text || text.trim().length < 100) {
        toast.error('Não foi possível extrair texto suficiente do PDF.');
        setIsProcessing(false);
        return;
      }

      toast.info('Enviando para análise com IA...');

      // Create reading record first
      const today = new Date().toISOString().split('T')[0];
      const { data: reading, error: readingError } = await supabase
        .from('dou_readings')
        .insert({
          reading_date: today,
          pdf_filename: file.name,
          status: 'processing',
        })
        .select()
        .single();

      if (readingError || !reading) {
        toast.error('Erro ao criar registro de leitura');
        setIsProcessing(false);
        return;
      }

      // Send to edge function for AI processing
      const { data: result, error: fnError } = await supabase.functions.invoke('process-dou', {
        body: { text, readingId: reading.id },
      });

      if (fnError) {
        console.error('Edge function error:', fnError);
        toast.error('Erro no processamento com IA');
        await supabase.from('dou_readings').update({ status: 'error' }).eq('id', reading.id);
        setIsProcessing(false);
        return;
      }

      toast.success(`Processamento concluído! ${result.totalPublications} publicações identificadas.`);
      await fetchReadings();
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Erro ao processar o documento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewReport = async (readingId: string) => {
    setSelectedReadingId(readingId);
    await fetchPublications(readingId);
  };

  const handleDownloadReport = async (readingId: string) => {
    setDownloadingId(readingId);
    try {
      const reading = readings.find((r) => r.id === readingId);
      if (!reading) return;

      const { data } = await supabase
        .from('dou_publications')
        .select('*')
        .eq('reading_id', readingId);

      if (data) {
        await generateReport(reading.reading_date, data);
        toast.success('Relatório gerado com sucesso!');
      }
    } catch {
      toast.error('Erro ao gerar relatório');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalOpportunities = readings.reduce((sum, r) => sum + r.total_opportunities, 0);
  const totalCompetitorMentions = readings.reduce((sum, r) => sum + r.total_competitor_mentions, 0);
  const lastReadingDate = readings.length > 0 ? readings[0].reading_date : null;

  const selectedReading = readings.find((r) => r.id === selectedReadingId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              DOU Seção 3 — Leituras Automatizadas
            </h1>
            <p className="text-sm text-muted-foreground">
              Sistema de monitoramento de licitações
            </p>
          </div>
          <div className="px-3 py-1.5 bg-primary/10 rounded-lg">
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              Orion Engenharia
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {selectedReadingId && selectedReading ? (
          <PublicationsView
            readingDate={selectedReading.reading_date}
            publications={publications}
            onBack={() => {
              setSelectedReadingId(null);
              setPublications([]);
            }}
            onDownload={() => handleDownloadReport(selectedReadingId)}
            isDownloading={downloadingId === selectedReadingId}
          />
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <StatsCards
                totalReadings={readings.length}
                totalOpportunities={totalOpportunities}
                totalCompetitorMentions={totalCompetitorMentions}
                lastReadingDate={lastReadingDate}
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-1"
              >
                <div className="bg-card border border-border/60 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Nova Leitura
                  </h2>
                  <FileUpload
                    onFileSelected={handleFileSelected}
                    isProcessing={isProcessing}
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2"
              >
                <div className="bg-card border border-border/60 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Histórico de Leituras
                  </h2>
                  <ReadingHistory
                    readings={readings}
                    onViewReport={handleViewReport}
                    onDownloadReport={handleDownloadReport}
                    downloadingId={downloadingId}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
