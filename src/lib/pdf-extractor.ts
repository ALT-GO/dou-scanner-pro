import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Exhaustive technical keyword list for Orion's scope of work.
 */
const TECHNICAL_KEYWORDS = [
  // ENGENHARIA E OBRAS
  'engenharia', 'obra', 'obras', 'construção', 'reforma', 'reformas',
  'ampliação', 'adequação predial', 'retrofit', 'infraestrutura',
  'edificação', 'edificações', 'fundação', 'fundações',
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
  'cabeamento estruturado', 'cabeamento',
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
  'ORION ENGENHARIA E TECNOLOGIA', 'ORION ENGENHARIA', 'GRUPO ORION',
  'GREEN4T',
  'GLS ENGENHARIA',
  'VIRTUAL ENGENHARIA',
  'GEMELO', 'CETEST',
  'KOERICH ENGENHARIA', 'KOERICH',
  'MPE ENGENHARIA E SERVICOS', 'MPE ENGENHARIA',
  'EQS ENGENHARIA',
  'ACECO TI', 'ACECO',
  'ATLÂNTICO ENGENHARIA', 'VIA ENGENHARIA',
];

const BLACKLIST_TERMS = [
  'EXTRATO DE CONTRATO', 'RESULTADO DE JULGAMENTO',
  'HOMOLOGAÇÃO', 'ADJUDICAÇÃO', 'TERMO ADITIVO',
  'EXTRATO DE ATA', 'RATIFICAÇÃO',
  'AVISO DE REVOGAÇÃO',
  'PASSAGENS AÉREAS', 'PASSAGEM AÉREA',
  'VIATURAS', 'VEÍCULOS AUTOMOTORES',
  'PERMISSÃO ESPECIAL DE USO', 'MERENDA',
  'EXTRATO DE REGISTRO DE PREÇOS', 'EXTRATO DO REGISTRO DE PREÇOS',
  'EXTRATO DE TERMO ADITIVO', 'EXTRATO DO TERMO ADITIVO',
  'EXTRATO DE APOSTILAMENTO', 'EXTRATO DO APOSTILAMENTO',
  'EXTRATO DE RESCISÃO', 'EXTRATO DO RESCISÃO',
  'EXTRATO DE CONVÊNIO', 'EXTRATO DO CONVÊNIO',
  'EXTRATO DE ACORDO', 'EXTRATO DO ACORDO',
  'EXTRATO CONTRATO',
  'RESULTADO DE LICITAÇÃO', 'RESULTADO DE PREGÃO',
  'EXTRATO DE INEXIGIBILIDADE',
  'INSUMOS LABORATORIAIS', 'MATERIAL HOSPITALAR',
  'AQUISIÇÃO DE MEDICAMENTOS',
  'PAVIMENTAÇÃO', 'ASFALTO', 'ASFÁLTICA', 'INTERTRAVADA', 'PRAÇA',
  'MATERIAL DE CONSTRUÇÃO', 'MATERIAL ELÉTRICO', 'AQUISIÇÃO DE MATERIAL',
  'ALUGUEL DE MÁQUINAS', 'LOCAÇÃO DE MÁQUINAS', 'BARRAGINHA',
  'GESTÃO AMBIENTAL', 'TELEFONIA MÓVEL', 'LINK DE INTERNET',
];

const NOTICE_TYPES = [
  'AVISO DE LICITAÇÃO', 'AVISO DE PREGÃO', 'AVISO DE CONCORRÊNCIA',
  'AVISO DE DISPENSA', 'AVISO DE INEXIGIBILIDADE',
  'AVISO DE CHAMAMENTO PÚBLICO', 'AVISO DE CHAMAMENTO',
  'AVISO DE CREDENCIAMENTO', 'AVISO DE ATA DE REGISTRO DE PREÇOS',
  'AVISO DE REGISTRO DE PREÇOS', 'INTENÇÃO DE REGISTRO DE PREÇOS',
  'AVISO DE ALTERAÇÃO', 'AVISO DE RETIFICAÇÃO', 'AVISO DE REPUBLICAÇÃO',
  'AVISO DE SUSPENSÃO', 'AVISO DE REABERTURA DE PRAZO',
  'AVISO DE REABERTURA',
  'PREGÃO ELETRÔNICO', 'CONCORRÊNCIA ELETRÔNICA', 'CONCORRÊNCIA PÚBLICA',
];

const SUMMARY_BLACKLIST = [
  'SUMÁRIO', 'ISSN 1677-7069', 'ISSN', 'IMPRENSA NACIONAL',
  'DOCUMENTO ASSINADO DIGITALMENTE', 'REPÚBLICA FEDERATIVA DO BRASIL',
  'DIÁRIO OFICIAL DA UNIÃO', 'CASA CIVIL',
];

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
  const sorted = [...COMPETITORS].sort((a, b) => b.length - a.length);
  const patterns = sorted.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');
}

function buildTechnicalRegex(): RegExp {
  const sorted = [...TECHNICAL_KEYWORDS].sort((a, b) => b.length - a.length);
  const patterns = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsBlacklist(text: string): boolean {
  const normalized = normalizeText(text);
  return BLACKLIST_TERMS.some(term => normalized.includes(normalizeText(term)));
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

/**
 * Split DOU text into individual publication blocks.
 * Uses notice-type triggers as paragraph start markers.
 * Tolerant regex: matches \n OR 3+ whitespace chars (for column breaks in DOU PDFs).
 */
function splitIntoBlocks(text: string): string[] {
  const triggerTerms = [
    ...NOTICE_TYPES,
    ...BLACKLIST_TERMS,
    'EXTRATO DE DISPENSA',
  ].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const organHeaders = [
    'MINISTÉRIO', 'SECRETARIA', 'UNIVERSIDADE', 'INSTITUTO', 'AGÊNCIA',
    'EMPRESA', 'FUNDAÇÃO', 'SUPERINTENDÊNCIA', 'DEPARTAMENTO', 'DIRETORIA',
    'COMANDO', 'TRIBUNAL', 'CONSELHO', 'PRESIDÊNCIA', 'GABINETE',
    'PROCURADORIA', 'DEFENSORIA', 'COMPANHIA', 'BANCO', 'CAIXA',
  ].map(t => `${t}\\s`);

  const allTriggers = [...triggerTerms, ...organHeaders];
  const splitPattern = new RegExp(`(?:\\n|\\s{3,})(?=(?:${allTriggers.join('|')}))`, 'gi');
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
    if (isSummaryOrHeader(block)) { discarded++; continue; }

    // BLACKLIST SOBERANA — prioridade absoluta, antes de concorrentes
    if (containsBlacklist(block)) { discarded++; continue; }

    const competitor = matchesCompetitor(block);
    if (competitor) { relevant.push(block); competitors++; continue; }

    if (!containsNoticeType(block)) { discarded++; continue; }
    if (!matchesTechnicalScope(block)) { discarded++; continue; }

    relevant.push(block);
    technical++;
  }

  return { relevant, stats: { total: blocks.length, competitors, technical, discarded } };
}

/**
 * Extract text from PDF preserving line breaks using item.hasEOL.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let pageText = '';
    for (const item of textContent.items as any[]) {
      pageText += item.str;
      if (item.hasEOL) {
        pageText += '\n';
      } else {
        pageText += ' ';
      }
    }
    fullText += pageText + '\n';
  }

  return fullText;
}

export { TECHNICAL_KEYWORDS, COMPETITORS, BLACKLIST_TERMS, NOTICE_TYPES, SUMMARY_BLACKLIST, isSummaryOrHeader };
