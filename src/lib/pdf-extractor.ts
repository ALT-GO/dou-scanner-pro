import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Exhaustive technical keyword list for Orion's scope of work.
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

const COMPETITORS = [
  'ORION', 'ORION ENGENHARIA', 'ORION ENGENHARIA E TECNOLOGIA',
  'GREEN4T', 'GLS ENGENHARIA', 'GLS', 'VIRTUAL ENGENHARIA', 'VIRTUAL',
  'GEMELO', 'CETEST', 'KOERICH', 'KOERICH ENGENHARIA',
  'MPE', 'MPE ENGENHARIA', 'EQS', 'EQS ENGENHARIA',
  'ACECO', 'ACECO TI', 'ATLÂNTICO ENGENHARIA', 'VIA ENGENHARIA',
];

const BLACKLIST_TERMS = [
  'EXTRATO DE CONTRATO', 'RESULTADO DE JULGAMENTO',
  'HOMOLOGAÇÃO', 'ADJUDICAÇÃO', 'TERMO ADITIVO',
  'EXTRATO DE ATA', 'RATIFICAÇÃO',
];

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
 * REGRA 0 — Summary/header blacklist terms (total discard before all other rules).
 */
const SUMMARY_BLACKLIST = [
  'SUMÁRIO', 'ISSN 1677-7069', 'ISSN', 'IMPRENSA NACIONAL',
  'DOCUMENTO ASSINADO DIGITALMENTE', 'REPÚBLICA FEDERATIVA DO BRASIL',
  'DIÁRIO OFICIAL DA UNIÃO', 'CASA CIVIL',
];

/**
 * REGRA 0: Check if a block is a DOU summary/index page or generic header.
 */
function isSummaryOrHeader(text: string): boolean {
  const upper = text.toUpperCase();
  if (SUMMARY_BLACKLIST.some(term => upper.includes(term))) return true;
  const ministryLines = (upper.match(/MINISTÉRIO/g) || []).length;
  if (ministryLines >= 3) return true;
  const pageRefs = (text.match(/\.{3,}\s*\d+/g) || []).length;
  if (pageRefs >= 3) return true;
  return false;
}

function buildCompetitorRegex(): RegExp {
  const patterns = COMPETITORS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

function buildTechnicalRegex(): RegExp {
  const sorted = [...TECHNICAL_KEYWORDS].sort((a, b) => b.length - a.length);
  const patterns = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

function containsBlacklist(text: string): boolean {
  const upper = text.toUpperCase();
  return BLACKLIST_TERMS.some(term => upper.includes(term));
}

function containsNoticeType(text: string): boolean {
  const upper = text.toUpperCase();
  return NOTICE_TYPES.some(term => upper.includes(term));
}

function matchesCompetitor(text: string): string | null {
  const regex = buildCompetitorRegex();
  const match = text.match(regex);
  return match ? match[0].toUpperCase() : null;
}

function matchesTechnicalScope(text: string): boolean {
  const regex = buildTechnicalRegex();
  return regex.test(text);
}

export interface PreFilteredBlock {
  text: string;
  competitorMatch: string | null;
  passedPreFilter: boolean;
  reason: 'competitor' | 'technical_match' | 'blacklisted' | 'no_notice' | 'no_scope' | 'summary_header';
}

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

function deduplicateBlocks(blocks: string[]): string[] {
  const seen = new Set<string>();
  return blocks.filter(block => {
    const fingerprint = block.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 200);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export function preFilterBlocks(text: string): { relevant: string[]; stats: { total: number; competitors: number; technical: number; discarded: number } } {
  const rawBlocks = splitIntoBlocks(text);
  const blocks = deduplicateBlocks(rawBlocks);
  const relevant: string[] = [];
  let competitors = 0;
  let technical = 0;
  let discarded = 0;

  for (const block of blocks) {
    // REGRA 0: Discard summary, index and header blocks immediately
    if (isSummaryOrHeader(block)) {
      discarded++;
      continue;
    }

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

export { TECHNICAL_KEYWORDS, COMPETITORS, BLACKLIST_TERMS, NOTICE_TYPES, SUMMARY_BLACKLIST, isSummaryOrHeader };
