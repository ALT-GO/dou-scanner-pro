// Shared keywords for highlighting in reports and preview

export const COMPETITORS = [
  "ORION ENGENHARIA E TECNOLOGIA", "ORION ENGENHARIA", "GRUPO ORION",
  "GREEN4T",
  "GLS ENGENHARIA",
  "VIRTUAL ENGENHARIA",
  "GEMELO", "CETEST",
  "KOERICH ENGENHARIA", "KOERICH",
  "MPE ENGENHARIA E SERVICOS", "MPE ENGENHARIA",
  "EQS ENGENHARIA",
  "ACECO TI", "ACECO",
  "ATLÂNTICO ENGENHARIA", "VIA ENGENHARIA",
];

export const TECHNICAL_KEYWORDS = [
  "engenharia", "obra", "obras", "construção", "reforma", "reformas",
  "ampliação", "adequação predial", "retrofit", "infraestrutura",
  "edificação", "fundação", "estrutura metálica",
  "alvenaria", "concreto", "projeto executivo", "projeto básico",
  "engenharia civil", "serviços de engenharia",
  "manutenção predial", "manutenção preventiva", "manutenção corretiva",
  "instalações elétricas", "instalações hidráulicas", "instalação elétrica",
  "ar condicionado", "climatização", "HVAC", "PMOC",
  "cabeamento estruturado", "rede lógica",
  "data center", "datacenter", "sala cofre", "nobreak", "UPS",
  "grupo gerador", "gerador", "subestação",
  "SPDA", "para-raios", "aterramento",
  "combate a incêndio", "detecção de incêndio", "sprinkler",
  "CFTV", "controle de acesso", "segurança eletrônica",
  "licitação", "pregão", "concorrência", "tomada de preços",
  "dispensa", "inexigibilidade", "chamamento público",
];

export function buildHighlightRegex(): RegExp {
  const allTerms = [...COMPETITORS, ...TECHNICAL_KEYWORDS]
    .sort((a, b) => b.length - a.length); // longer first to avoid partial matches
  const escaped = allTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}
