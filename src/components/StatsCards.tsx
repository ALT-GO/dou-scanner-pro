import { FileText, Users, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardsProps {
  totalReadings: number;
  totalOpportunities: number;
  totalCompetitorMentions: number;
  lastReadingDate: string | null;
}

export function StatsCards({
  totalReadings,
  totalOpportunities,
  totalCompetitorMentions,
  lastReadingDate,
}: StatsCardsProps) {
  const stats = [
    {
      label: 'Leituras Realizadas',
      value: totalReadings,
      icon: Calendar,
      color: 'text-primary',
    },
    {
      label: 'Oportunidades Identificadas',
      value: totalOpportunities,
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      label: 'Menções de Concorrentes',
      value: totalCompetitorMentions,
      icon: Users,
      color: 'text-accent',
    },
    {
      label: 'Última Leitura',
      value: lastReadingDate
        ? new Date(lastReadingDate).toLocaleDateString('pt-BR')
        : '—',
      icon: FileText,
      color: 'text-muted-foreground',
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
          <p className={`text-2xl font-bold text-foreground ${stat.isText ? 'text-lg' : ''}`}>
            {stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
