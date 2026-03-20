import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FileUpload } from '@/components/FileUpload';
import { StatsCards } from '@/components/StatsCards';
import { ReadingHistory } from '@/components/ReadingHistory';
import { PublicationsView } from '@/components/PublicationsView';
import { ProcessingLog, LogEntry, LogLevel } from '@/components/ProcessingLog';
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
  created_at: string;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const addLog = useCallback((level: LogLevel, message: string, details?: string) => {
    const id = String(++logIdRef.current);
    setLogs(prev => [...prev, { id, timestamp: new Date(), level, message, details }]);
  }, []);

  const updateLastLog = useCallback((level: LogLevel, message: string, details?: string) => {
    setLogs(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], level, message, details };
      return updated;
    });
  }, []);

  const wait = useCallback((ms: number) => new Promise(resolve => setTimeout(resolve, ms)), []);

  const fetchReadings = useCallback(async () => {
    const { data, error } = await supabase
      .from('dou_readings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching readings:', error);
      return;
    }
    setReadings(data || []);
  }, []);

  const pollReadingCompletion = useCallback(async (readingId: string) => {
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 70;
    const startedAt = Date.now();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await wait(POLL_INTERVAL_MS);

      const { data, error } = await supabase
        .from('dou_readings')
        .select('*')
        .eq('id', readingId)
        .single();

      if (error || !data) continue;

      if (data.status === 'completed') {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        addLog('success', `Processamento concluído em ${elapsed}s`);
        addLog('info', `  ├─ Oportunidades: ${data.total_opportunities}`);
        addLog('info', `  └─ Menções a concorrentes: ${data.total_competitor_mentions}`);
        toast.success('Processamento concluído com sucesso!');
        await fetchReadings();
        return true;
      }

      if (data.status === 'error') {
        addLog('error', 'O processamento falhou no backend');
        toast.error('Erro no processamento com IA');
        await fetchReadings();
        return false;
      }
    }

    addLog('warning', 'O processamento continua em segundo plano; atualize o histórico em instantes');
    await fetchReadings();
    toast.warning('O processamento segue em segundo plano. Verifique o histórico em alguns instantes.');
    return false;
  }, [addLog, fetchReadings, wait]);

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
    setLogs([]);
    logIdRef.current = 0;

    try {
      addLog('processing', `Extraindo texto do PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);

      const text = await extractTextFromPDF(file);

      if (!text || text.trim().length < 100) {
        addLog('error', 'Falha na extração: texto insuficiente', `Caracteres extraídos: ${text?.length || 0}`);
        toast.error('Não foi possível extrair texto suficiente do PDF.');
        setIsProcessing(false);
        return;
      }

      updateLastLog('success', `Texto extraído: ${text.length.toLocaleString('pt-BR')} caracteres`);
      addLog('processing', 'Criando registro de leitura no banco de dados...');

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
        addLog('error', 'Falha ao criar registro de leitura', readingError?.message || 'Resposta vazia');
        toast.error('Erro ao criar registro de leitura');
        setIsProcessing(false);
        return;
      }

      updateLastLog('success', `Registro criado: ${reading.id.substring(0, 8)}...`);
      addLog('processing', `Enviando ${(text.length / 1024).toFixed(0)} KB para processamento em segundo plano...`);

      const startTime = Date.now();
      const { data: result, error: fnError } = await supabase.functions.invoke('process-dou', {
        body: { text, readingId: reading.id },
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (fnError) {
        const errorDetail = typeof fnError === 'object' ? JSON.stringify(fnError, null, 2) : String(fnError);
        addLog('error', `Edge Function falhou após ${elapsed}s`, errorDetail);

        if (fnError.message?.includes('429') || fnError.status === 429) {
          addLog('warning', 'Rate limit atingido — aguarde alguns minutos antes de tentar novamente');
        } else if (fnError.message?.includes('402') || fnError.status === 402) {
          addLog('warning', 'Créditos insuficientes — adicione créditos ao workspace');
        } else if (fnError.message?.includes('timeout') || fnError.message?.includes('FUNCTION_INVOCATION_TIMEOUT')) {
          addLog('warning', 'Timeout da função — o PDF pode ser grande demais para processar de uma vez');
        }

        toast.error('Erro no processamento com IA');
        await supabase.from('dou_readings').update({ status: 'error' }).eq('id', reading.id);
        setIsProcessing(false);
        return;
      }

      if (result?.error) {
        addLog('error', `Erro retornado pela IA após ${elapsed}s`, result.error);
        toast.error(result.error);
        await supabase.from('dou_readings').update({ status: 'error' }).eq('id', reading.id);
        setIsProcessing(false);
        return;
      }

      if (result?.accepted) {
        updateLastLog('success', `Processamento aceito em ${elapsed}s`);
        addLog('processing', 'A leitura segue em segundo plano; aguardando conclusão do backend...');
        await pollReadingCompletion(reading.id);
        return;
      }

      updateLastLog('success', `Edge Function concluída em ${elapsed}s`);

      // Log pre-filter stats
      if (result?.preFilterStats) {
        const s = result.preFilterStats;
        addLog('info', `Pré-filtro: ${s.total} blocos → ${s.competitors} concorrentes, ${s.technical} técnicos, ${s.discarded} descartados`);
      }

      addLog('success', `✔ ${result.totalPublications} publicações identificadas`);
      addLog('info', `  ├─ Oportunidades: ${result.opportunities}`);
      addLog('info', `  └─ Menções a concorrentes: ${result.competitorMentions}`);

      toast.success(`Processamento concluído! ${result.totalPublications} publicações identificadas.`);
      await fetchReadings();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      addLog('error', `Erro inesperado: ${errorMsg}`, errorStack);
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

  const handleDeleteReading = async (readingId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta leitura?')) return;
    setDeletingId(readingId);
    try {
      const { error } = await supabase.functions.invoke('delete-reading', {
        body: { readingId },
      });
      if (error) throw error;
      toast.success('Leitura excluída com sucesso');
      if (selectedReadingId === readingId) {
        setSelectedReadingId(null);
        setPublications([]);
      }
      await fetchReadings();
    } catch {
      toast.error('Erro ao excluir leitura');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja excluir TODAS as leituras? Esta ação não pode ser desfeita.')) return;
    setIsDeletingAll(true);
    try {
      const { error } = await supabase.functions.invoke('delete-reading', {
        body: { deleteAll: true },
      });
      if (error) throw error;
      toast.success('Todas as leituras foram excluídas');
      setSelectedReadingId(null);
      setPublications([]);
      await fetchReadings();
    } catch {
      toast.error('Erro ao excluir leituras');
    } finally {
      setIsDeletingAll(false);
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
                className="lg:col-span-1 space-y-4"
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

                <ProcessingLog logs={logs} visible={logs.length > 0} />
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
                    onDeleteReading={handleDeleteReading}
                    onDeleteAll={handleDeleteAll}
                    downloadingId={downloadingId}
                    deletingId={deletingId}
                    isDeletingAll={isDeletingAll}
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

