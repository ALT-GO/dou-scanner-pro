import { FileText, Download, Eye, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface Reading {
  id: string;
  reading_date: string;
  pdf_filename: string;
  total_opportunities: number;
  total_competitor_mentions: number;
  status: string;
  created_at: string;
}

interface ReadingHistoryProps {
  readings: Reading[];
  onViewReport: (readingId: string) => void;
  onDownloadReport: (readingId: string) => void;
  onDeleteReading: (readingId: string) => void;
  downloadingId: string | null;
  deletingId: string | null;
}

export function ReadingHistory({ readings, onViewReport, onDownloadReport, onDeleteReading, downloadingId, deletingId }: ReadingHistoryProps) {
  if (readings.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Nenhuma leitura realizada</p>
        <p className="text-sm">Faça upload de um PDF do DOU para começar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {readings.map((reading, i) => (
        <motion.div
          key={reading.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center justify-between p-4 bg-card border border-border/60 rounded-xl hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {new Date(reading.reading_date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {reading.pdf_filename}
                <span className="ml-2 text-xs opacity-60">
                  {new Date(reading.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-success/10 text-success border-0">
              {reading.total_opportunities} oportunidades
            </Badge>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-0">
              {reading.total_competitor_mentions} concorrentes
            </Badge>
            {reading.status === 'processing' ? (
              <Badge variant="secondary" className="bg-muted">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Processando
              </Badge>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onViewReport(reading.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownloadReport(reading.id)}
                  disabled={downloadingId === reading.id}
                >
                  {downloadingId === reading.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteReading(reading.id)}
                  disabled={deletingId === reading.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {deletingId === reading.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
