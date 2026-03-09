import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

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

interface PublicationsViewProps {
  readingDate: string;
  publications: Publication[];
  onBack: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

const sectionLabels: Record<string, string> = {
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  DF: 'Distrito Federal',
  CONCORRENTES: 'Concorrentes / Orion',
  AVISOS_DIVERSOS: 'Avisos Diversos',
};

const sectionColors: Record<string, string> = {
  SP: 'bg-primary/10 text-primary',
  MG: 'bg-success/10 text-success',
  DF: 'bg-accent/10 text-accent',
  CONCORRENTES: 'bg-destructive/10 text-destructive',
  AVISOS_DIVERSOS: 'bg-muted text-muted-foreground',
};

export function PublicationsView({
  readingDate,
  publications,
  onBack,
  onDownload,
  isDownloading,
}: PublicationsViewProps) {
  const sections = ['SP', 'MG', 'DF', 'CONCORRENTES', 'AVISOS_DIVERSOS'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Leitura de{' '}
              {new Date(readingDate).toLocaleDateString('pt-BR')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {publications.length} publicações identificadas
            </p>
          </div>
        </div>
        <Button onClick={onDownload} disabled={isDownloading}>
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Gerar Word
        </Button>
      </div>

      {sections.map((section) => {
        const sectionPubs = publications.filter((p) => p.section === section);
        return (
          <div key={section}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-lg font-semibold text-foreground">
                {sectionLabels[section]}
              </h3>
              <Badge className={sectionColors[section] + ' border-0'}>
                {sectionPubs.length}
              </Badge>
            </div>
            {sectionPubs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-3 px-4 bg-muted/50 rounded-lg">
                Nenhuma publicação nesta seção.
              </p>
            ) : (
              <div className="space-y-3">
                {sectionPubs.map((pub, i) => (
                  <motion.div
                    key={pub.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border/60 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {pub.publication_type}
                        </Badge>
                        {pub.organ && (
                          <span className="text-sm text-muted-foreground">{pub.organ}</span>
                        )}
                      </div>
                      {pub.competitor_match && (
                        <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                          {pub.competitor_match}
                        </Badge>
                      )}
                    </div>
                    {pub.object_text && (
                      <p className="text-sm font-medium text-foreground mb-2">
                        Objeto: {pub.object_text}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                      {pub.full_text}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
