import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'processing';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: string;
}

interface ProcessingLogProps {
  logs: LogEntry[];
  visible: boolean;
}

const levelConfig: Record<LogLevel, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-400' },
  success: { icon: CheckCircle2, color: 'text-emerald-400' },
  error: { icon: XCircle, color: 'text-red-400' },
  warning: { icon: AlertTriangle, color: 'text-amber-400' },
  processing: { icon: Loader2, color: 'text-primary' },
};

export function ProcessingLog({ logs, visible }: ProcessingLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  if (!visible || logs.length === 0) return null;

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Log de Processamento
        </h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {logs.length} {logs.length === 1 ? 'entrada' : 'entradas'}
        </span>
      </div>
      <ScrollArea className="h-[280px]">
        <div className="p-3 space-y-1 font-mono text-xs">
          {logs.map((entry) => {
            const config = levelConfig[entry.level];
            const Icon = config.icon;
            const time = entry.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div key={entry.id} className="flex items-start gap-2 py-1">
                <span className="text-muted-foreground shrink-0 tabular-nums">{time}</span>
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 mt-0.5',
                    config.color,
                    entry.level === 'processing' && 'animate-spin'
                  )}
                />
                <div className="min-w-0">
                  <span className={cn('break-words', entry.level === 'error' ? 'text-red-300' : 'text-foreground')}>
                    {entry.message}
                  </span>
                  {entry.details && (
                    <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all bg-muted/50 rounded p-2">
                      {entry.details}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
