import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Loader2, MapPin, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { buildHighlightRegex, COMPETITORS } from '@/lib/keywords';

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

const stateLabels: Record<string, string> = {
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  DF: 'Distrito Federal',
};

const stateBadgeColors: Record<string, string> = {
  SP: 'bg-primary/10 text-primary',
  MG: 'bg-success/10 text-success',
  DF: 'bg-accent/10 text-accent',
};

function HighlightedText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const regex = buildHighlightRegex();
    const result: { text: string; bold: boolean; isCompetitor: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), bold: false, isCompetitor: false });
      }
      const isComp = COMPETITORS.some(c => c.toLowerCase() === match![0].toLowerCase());
      result.push({ text: match[0], bold: true, isCompetitor: isComp });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), bold: false, isCompetitor: false });
    }
    return result;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.bold ? (
          <span
            key={i}
            className={`font-bold ${p.isCompetitor ? 'text-destructive' : 'text-primary'}`}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

function PublicationCard({ pub, index }: { pub: Publication; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-card border border-border/60 rounded-xl p-5 hover:border-border transition-colors space-y-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {pub.publication_type}
          </Badge>
          {pub.state && (
            <Badge className={`${stateBadgeColors[pub.state] || 'bg-muted text-muted-foreground'} border-0 text-xs`}>
              <MapPin className="h-3 w-3 mr-1" />
              {stateLabels[pub.state] || pub.state}
            </Badge>
          )}
        </div>
        {pub.competitor_match && (
          <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {pub.competitor_match}
          </Badge>
        )}
      </div>

      {pub.organ && (
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {pub.organ}
        </p>
      )}

      {pub.object_text && (
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground font-medium">Objeto: </span>
          <HighlightedText text={pub.object_text} />
        </p>
      )}

      <p className={`text-sm text-muted-foreground leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
        <HighlightedText text={pub.full_text} />
      </p>

      {pub.full_text.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver texto completo'}
        </button>
      )}
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground italic py-6 px-4 bg-muted/30 rounded-lg text-center">
      {message}
    </p>
  );
}

export function PublicationsView({
  readingDate,
  publications,
  onBack,
  onDownload,
  isDownloading,
}: PublicationsViewProps) {
  const priorityPubs = publications.filter(p => ['SP', 'MG', 'DF'].includes(p.section));
  const competitorPubs = publications.filter(p => p.section === 'CONCORRENTES');
  const diversePubs = publications.filter(p => p.section === 'AVISOS_DIVERSOS');

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

      <Tabs defaultValue="priority" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="priority" className="gap-2">
            <MapPin className="h-4 w-4" />
            Licitações
            <Badge className="bg-primary/10 text-primary border-0 text-xs ml-1">
              {priorityPubs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="competitors" className="gap-2">
            <Eye className="h-4 w-4" />
            Concorrência
            <Badge className="bg-destructive/10 text-destructive border-0 text-xs ml-1">
              {competitorPubs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="diverse" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Diversos
            <Badge className="bg-muted text-muted-foreground border-0 text-xs ml-1">
              {diversePubs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="priority" className="mt-4 space-y-8">
          {['SP', 'MG', 'DF'].map(state => {
            const statePubs = priorityPubs.filter(p => p.section === state);
            return (
              <div key={state} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {stateLabels[state]}
                  </h3>
                  <Badge className={`${stateBadgeColors[state]} border-0 text-xs`}>
                    {statePubs.length}
                  </Badge>
                </div>
                {statePubs.length === 0 ? (
                  <EmptyState message={`Nenhuma publicação em ${stateLabels[state]}.`} />
                ) : (
                  <div className="space-y-4">
                    {statePubs.map((pub, i) => (
                      <PublicationCard key={pub.id} pub={pub} index={i} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="competitors" className="mt-4">
          {competitorPubs.length === 0 ? (
            <EmptyState message="Nenhuma menção a concorrentes ou à Orion identificada." />
          ) : (
            <div className="space-y-4">
              {competitorPubs.map((pub, i) => (
                <PublicationCard key={pub.id} pub={pub} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="diverse" className="mt-4">
          {diversePubs.length === 0 ? (
            <EmptyState message="Nenhum aviso de outros estados identificado." />
          ) : (
            <div className="space-y-4">
              {diversePubs.map((pub, i) => (
                <PublicationCard key={pub.id} pub={pub} index={i} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
