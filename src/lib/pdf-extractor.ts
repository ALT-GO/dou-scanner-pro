import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Exhaustive technical keyword list for Orion's scope of work.
 * Used for pre-filtering publication blocks before AI analysis.
 */
const TECHNICAL_KEYWORDS = [
  // ENGENHARIA E OBRAS
  'engenharia', 'obra', 'obras', 'construção', 'reforma', 'reformas',
  'ampliação', 'adequação predial', 'retrofit', 'infraestrutura',
  'edificação', 'edificações', 'pavimentação', 'fundação', 'fundações',
  'estrutura metálica', 'estruturas metálicas', 'alvenaria', 'concreto',
  'projeto executivo', 'projeto básico', 'projeto arquitetônico',
  'engenharia civil', 'serviços de engenharia',

  // MANUTENÇÃO PREDIAL
  'manutenção predial', 'manutenção preventiva', 'manutenção corretiva',
  'manutenção preditiva', 'facilities', 'gestão predial',
  'serviços de manutenção', 'manutenção de edifício', 'manutenção de edificação',
  'manutenção de instalações', 'conservação predial',

  // SISTEMAS PREDIAIS — ELÉTRICA
  'instalações elétricas', 'instalação elétrica', 'rede elétrica',
  'subestação', 'quadro elétrico', 'quadros elétricos',
  'grupo gerador', 'gerador', 'nobreak', 'no-break', 'ups',
  'transformador', 'barramento blindado', 'spda',
  'para-raios', 'aterramento', 'iluminação',
  'cabeamento estruturado', 'cabeamento', 'fibra óptica',
  'infraestrutura elétrica', 'baixa tensão', 'média tensão', 'alta tensão',

  // SISTEMAS PREDIAIS — CLIMATIZAÇÃO
  'climatização', 'ar condicionado', 'ar-condicionado',
  'hvac', 'chiller', 'fancoil', 'fan coil', 'split', 'vrf', 'vrv',
  'duto de ar', 'ventilação', 'exaustão', 'refrigeração',
  'sistema de climatização', 'central de água gelada',
  'torre de resfriamento', 'condensadora', 'evaporadora',

  // SISTEMAS PREDIAIS — AUTOMAÇÃO E SEGURANÇA ELETRÔNICA
  'automação predial', 'automação', 'bms', 'sistema de supervisão',
  'cftv', 'câmera', 'câmeras', 'monitoramento eletrônico',
  'controle de acesso', 'catracas', 'biometria',
  'detecção de incêndio', 'combate a incêndio', 'alarme de incêndio',
  'sprinkler', 'hidrante', 'sistema de incêndio', 'brigada',
  'sonorização', 'interfone', 'porteiro eletrônico',
  'sistema de segurança eletrônica', 'segurança eletrônica',

  // AMBIENTES DE MISSÃO CRÍTICA
  'data center', 'datacenter', 'data-center',
  'sala cofre', 'sala-cofre', 'missão crítica',
  'cpd', 'centro de dados', 'centro de processamento de dados',
  'infraestrutura de ti', 'rack', 'piso elevado',
  'containment', 'hot aisle', 'cold aisle',
  'ambiente de missão crítica', 'tier iii', 'tier iv', 'tier 3', 'tier 4',
  'uptime institute',

  // ENERGIA SOLAR / FOTOVOLTAICA
  'energia solar', 'fotovoltaico', 'fotovoltaica',
  'painel solar', 'painéis solares', 'módulo fotovoltaico',
  'usina solar', 'geração solar', 'geração distribuída',
  'inversor solar', 'microgeração', 'minigeração',
  'sistema fotovoltaico', 'planta solar',

  // TERMOS COMPLEMENTARES FREQUENTES EM LICITAÇÕES
  'projeto de instalação', 'execução de serviços de engenharia',
  'contratação de empresa de engenharia', 'lote único',
  'sistema predial', 'sistemas prediais',
  'elevador', 'elevadores', 'escada rolante',
  'impermeabilização', 'cobertura metálica', 'fachada',
  'drywall', 'forro', 'piso', 'revestimento',
];

/**
 * Competitors + Orion (own company) — all trigger "Concorrência / Orion" capture.
 */
const COMPETITORS = [
  'ORION', 'ORION ENGENHARIA', 'ORION ENGENHARIA E TECNOLOGIA',
  'GREEN4T', 'GLS ENGENHARIA', 'GLS', 'VIRTUAL ENGENHARIA', 'VIRTUAL',
  'GEMELO', 'CETEST', 'KOERICH', 'KOERICH ENGENHARIA',
  'MPE', 'MPE ENGENHARIA', 'EQS', 'EQS ENGENHARIA',
  'ACECO', 'ACECO TI', 'ATLÂNTICO ENGENHARIA', 'VIA ENGENHARIA',
];

/**
 * Blacklisted terms indicating finalized processes — discard immediately.
 */
const BLACKLIST_TERMS = [
  'EXTRATO DE CONTRATO', 'RESULTADO DE JULGAMENTO',
  'HOMOLOGAÇÃO', 'ADJUDICAÇÃO', 'TERMO ADITIVO',
  'EXTRATO DE ATA', 'RATIFICAÇÃO',
];

/**
 * Valid procurement notice types.
 */
const NOTICE_TYPES = [
  'AVISO DE LICITAÇÃO', 'AVISO DE PREGÃO', 'AVISO DE CONCORRÊNCIA',
  'AVISO DE DISPENSA', 'AVISO DE INEXIGIBILIDADE',
  'AVISO DE CHAMAMENTO PÚBLICO', 'AVISO DE CHAMAMENTO',
  'AVISO DE CREDENCIAMENTO', 'AVISO DE ATA DE REGISTRO DE PREÇOS',
  'AVISO DE REGISTRO DE PREÇOS', 'INTENÇÃO DE REGISTRO DE PREÇOS',
  'AVISO DE ALTERAÇÃO', 'AVISO DE RETIFICAÇÃO', 'AVISO DE REPUBLICAÇÃO',
  'AVISO DE SUSPENSÃO', 'AVISO DE REABERTURA DE PRAZO',
  'AVISO DE REABERTURA', 'AVISO DE REVOGAÇÃO',
  'PREGÃO ELETRÔNICO', 'CONCORRÊNCIA ELETRÔNICA', 'CONCORRÊNCIA PÚBLICA',
];

/**
 * Build a regex that matches any competitor name (case-insensitive).
 */
function buildCompetitorRegex(): RegExp {
  const patterns = COMPETITORS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

/**
 * Build a regex that matches any technical keyword (case-insensitive, word boundary).
 */
function buildTechnicalRegex(): RegExp {
  // Sort by length descending so longer phrases match first
  const sorted = [...TECHNICAL_KEYWORDS].sort((a, b) => b.length - a.length);
  const patterns = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

/**
 * Check if a text block contains any blacklisted term.
 */
function containsBlacklist(text: string): boolean {
  const upper = text.toUpperCase();
  return BLACKLIST_TERMS.some(term => upper.includes(term));
}

/**
 * Check if a text block contains any valid notice type.
 */
function containsNoticeType(text: string): boolean {
  const upper = text.toUpperCase();
  return NOTICE_TYPES.some(term => upper.includes(term));
}

/**
 * Check if a text block contains any competitor name.
 */
function matchesCompetitor(text: string): string | null {
  const regex = buildCompetitorRegex();
  const match = text.match(regex);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Check if a text block contains any technical keyword.
 */
function matchesTechnicalScope(text: string): boolean {
  const regex = buildTechnicalRegex();
  return regex.test(text);
}

export interface PreFilteredBlock {
  text: string;
  competitorMatch: string | null;
  passedPreFilter: boolean;
  reason: 'competitor' | 'technical_match' | 'blacklisted' | 'no_notice' | 'no_scope';
}

/**
 * Split DOU text into individual publication blocks.
 * Uses notice-type triggers as paragraph start markers, capturing from
 * the notice header until the next notice or organ header.
 */
function splitIntoBlocks(text: string): string[] {
  const triggerTerms = [
    ...NOTICE_TYPES,
    ...BLACKLIST_TERMS,
    'EXTRATO DE DISPENSA', 'EXTRATO DE INEXIGIBILIDADE',
  ].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const organHeaders = [
    'MINISTÉRIO', 'SECRETARIA', 'UNIVERSIDADE', 'INSTITUTO', 'AGÊNCIA',
    'EMPRESA', 'FUNDAÇÃO', 'SUPERINTENDÊNCIA', 'DEPARTAMENTO', 'DIRETORIA',
    'COMANDO', 'TRIBUNAL', 'CONSELHO', 'PRESIDÊNCIA', 'GABINETE',
    'PROCURADORIA', 'DEFENSORIA', 'COMPANHIA', 'BANCO', 'CAIXA',
  ].map(t => `${t}\\s`);

  const allTriggers = [...triggerTerms, ...organHeaders];
  const splitPattern = new RegExp(`\\n(?=(${allTriggers.join('|')}))`, 'gi');
  const blocks = text.split(splitPattern).filter(b => b && b.trim().length > 50);

  if (blocks.length <= 1) {
    return text.split(/\n{2,}/).filter(b => b.trim().length > 50);
  }
  return blocks;
}

/**
 * Remove duplicate blocks based on normalized text fingerprint.
 */
function deduplicateBlocks(blocks: string[]): string[] {
  const seen = new Set<string>();
  return blocks.filter(block => {
    const fingerprint = block.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 200);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

/**
 * Apply the 4-rule pre-filter to each block before sending to AI.
 */
export function preFilterBlocks(text: string): { relevant: string[]; stats: { total: number; competitors: number; technical: number; discarded: number } } {
  const rawBlocks = splitIntoBlocks(text);
  const blocks = deduplicateBlocks(rawBlocks);
  const relevant: string[] = [];
  let competitors = 0;
  let technical = 0;
  let discarded = 0;

  for (const block of blocks) {
    // RULE 1: Competitor monitoring (highest priority — bypasses all filters)
    const competitor = matchesCompetitor(block);
    if (competitor) {
      relevant.push(block);
      competitors++;
      continue;
    }

    // RULE 2: Must contain a valid notice type
    if (containsBlacklist(block) || !containsNoticeType(block)) {
      discarded++;
      continue;
    }

    // RULE 3: Must match technical scope
    if (!matchesTechnicalScope(block)) {
      discarded++;
      continue;
    }

    // Passed all filters
    relevant.push(block);
    technical++;
  }

  return {
    relevant,
    stats: { total: blocks.length, competitors, technical, discarded },
  };
}

/**
 * Extract text from PDF and return both raw text and pre-filtered blocks.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

export { TECHNICAL_KEYWORDS, COMPETITORS, BLACKLIST_TERMS, NOTICE_TYPES };
