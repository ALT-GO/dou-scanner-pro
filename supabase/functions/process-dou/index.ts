import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const COMPETITORS = [
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

const BLACKLIST_TERMS = [
  "EXTRATO DE CONTRATO", "EXTRATO DO CONTRATO", "RESULTADO DE JULGAMENTO",
  "HOMOLOGAÇÃO", "ADJUDICAÇÃO", "TERMO ADITIVO",
  "EXTRATO DE ATA", "RATIFICAÇÃO", "APOSTILAMENTO",
  "AVISO DE PENALIDADE", "EXTRATO DE DOAÇÃO", "CHAMADA PÚBLICA",
  "LEILÃO", "TERMO DE COMPROMISSO",
  "AVISO DE REVOGAÇÃO",
  "PASSAGENS AÉREAS", "PASSAGEM AÉREA",
  "VIATURAS", "VEÍCULOS AUTOMOTORES",
  "PERMISSÃO ESPECIAL DE USO", "MERENDA",
  "EXTRATO DE REGISTRO DE PREÇOS", "EXTRATO DO REGISTRO DE PREÇOS",
  "EXTRATO DE TERMO ADITIVO", "EXTRATO DO TERMO ADITIVO",
  "EXTRATO DE APOSTILAMENTO", "EXTRATO DO APOSTILAMENTO",
  "EXTRATO DE RESCISÃO", "EXTRATO DO RESCISÃO",
  "EXTRATO DE CONVÊNIO", "EXTRATO DO CONVÊNIO",
  "EXTRATO DE ACORDO", "EXTRATO DO ACORDO",
  "EXTRATO CONTRATO",
  "RESULTADO DE LICITAÇÃO", "RESULTADO DE PREGÃO",
  "EXTRATO DE INEXIGIBILIDADE",
  "INSUMOS LABORATORIAIS", "MATERIAL HOSPITALAR",
  "AQUISIÇÃO DE MEDICAMENTOS",
];

const SUMMARY_BLACKLIST = [
  "SUMÁRIO", "ISSN 1677-7069", "ISSN", "IMPRENSA NACIONAL",
  "DOCUMENTO ASSINADO DIGITALMENTE", "REPÚBLICA FEDERATIVA DO BRASIL",
  "DIÁRIO OFICIAL DA UNIÃO", "CASA CIVIL",
];

const NOTICE_TYPES = [
  "AVISO DE LICITAÇÃO", "AVISO DE PREGÃO", "AVISO DE CONCORRÊNCIA",
  "AVISO DE DISPENSA", "AVISO DE INEXIGIBILIDADE",
  "AVISO DE CHAMAMENTO PÚBLICO", "AVISO DE CHAMAMENTO",
  "AVISO DE CREDENCIAMENTO", "AVISO DE ATA DE REGISTRO DE PREÇOS",
  "AVISO DE REGISTRO DE PREÇOS", "INTENÇÃO DE REGISTRO DE PREÇOS",
  "AVISO DE ALTERAÇÃO", "AVISO DE RETIFICAÇÃO", "AVISO DE REPUBLICAÇÃO",
  "AVISO DE SUSPENSÃO", "AVISO DE REABERTURA DE PRAZO",
  "AVISO DE REABERTURA",
  "PREGÃO ELETRÔNICO", "CONCORRÊNCIA ELETRÔNICA", "CONCORRÊNCIA PÚBLICA",
];

const TECHNICAL_KEYWORDS = [
  "engenharia", "obra", "obras", "construção", "reforma", "reformas",
  "ampliação", "adequação predial", "retrofit", "infraestrutura",
  "edificação", "pavimentação", "fundação", "estrutura metálica",
  "alvenaria", "concreto", "projeto executivo", "projeto básico",
  "engenharia civil", "serviços de engenharia",
  "manutenção predial", "manutenção preventiva", "manutenção corretiva",
  "manutenção preditiva", "facilities", "gestão predial",
  "serviços de manutenção", "conservação predial",
  "instalações elétricas", "instalação elétrica", "rede elétrica",
  "subestação", "quadro elétrico", "grupo gerador", "gerador",
  "nobreak", "no-break", "ups", "transformador", "spda",
  "aterramento", "iluminação", "cabeamento estruturado", "cabeamento",
  "fibra óptica", "infraestrutura elétrica", "baixa tensão", "média tensão",
  "climatização", "ar condicionado", "ar-condicionado",
  "hvac", "chiller", "fancoil", "fan coil", "split", "vrf", "vrv",
  "ventilação", "exaustão", "refrigeração", "central de água gelada",
  "torre de resfriamento",
  "automação predial", "automação", "bms", "cftv",
  "controle de acesso", "catracas", "biometria",
  "detecção de incêndio", "combate a incêndio", "alarme de incêndio",
  "sprinkler", "hidrante", "sistema de incêndio",
  "sonorização", "segurança eletrônica",
  "data center", "datacenter", "data-center",
  "sala cofre", "sala-cofre", "missão crítica",
  "cpd", "centro de dados", "centro de processamento de dados",
  "infraestrutura de ti", "rack", "piso elevado",
  "containment", "tier iii", "tier iv", "tier 3", "tier 4",
  "energia solar", "fotovoltaico", "fotovoltaica",
  "painel solar", "módulo fotovoltaico", "usina solar",
  "geração solar", "geração distribuída", "sistema fotovoltaico",
  "elevador", "elevadores", "escada rolante",
  "impermeabilização", "cobertura metálica", "fachada",
  "drywall", "forro", "piso", "revestimento",
  "sistema predial", "sistemas prediais",
];

// ═══════════════════════════════════════════════════
// PRE-FILTER FUNCTIONS (Rule-based NLP)
// ═══════════════════════════════════════════════════

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

function matchesCompetitor(text: string): string | null {
  const regex = buildCompetitorRegex();
  const match = text.match(regex);
  return match ? match[0].toUpperCase() : null;
}

function containsBlacklist(text: string): boolean {
  const upper = text.toUpperCase();
  return BLACKLIST_TERMS.some(term => upper.includes(term));
}

function containsNoticeType(text: string): boolean {
  const upper = text.toUpperCase();
  return NOTICE_TYPES.some(term => upper.includes(term));
}

function matchesTechnicalScope(text: string): boolean {
  const regex = buildTechnicalRegex();
  return regex.test(text);
}

/**
 * Split raw DOU text into individual publication blocks.
 * Tolerant regex: matches \n OR 3+ whitespace chars (column breaks in DOU PDFs).
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

interface PreFilterResult {
  relevantBlocks: string[];
  stats: { total: number; competitors: number; technical: number; discarded: number };
}

/**
 * Apply pre-filter rules. Competitor blocks now go into relevantBlocks
 * so they are sent to AI for full structured extraction.
 */
function preFilterText(text: string): PreFilterResult {
  const rawBlocks = splitIntoBlocks(text);
  const blocks = deduplicateBlocks(rawBlocks);
  const relevantBlocks: string[] = [];
  let competitors = 0, technical = 0, discarded = 0;

  for (const block of blocks) {
    // REGRA 0: Discard summary, index and header blocks immediately
    if (isSummaryOrHeader(block)) { discarded++; continue; }

    // REGRA 0.5 (SOBERANA): Blacklist tem prioridade ABSOLUTA — antes de tudo
    if (containsBlacklist(block)) { discarded++; continue; }

    // RULE 1: Competitor match — push to relevantBlocks (AI will extract organ/object)
    if (matchesCompetitor(block)) {
      relevantBlocks.push(block);
      competitors++;
      continue;
    }

    // RULE 2: Must contain a valid notice type
    if (!containsNoticeType(block)) { discarded++; continue; }

    // RULE 3: Must match technical scope keywords
    if (!matchesTechnicalScope(block)) { discarded++; continue; }

    // Passed all pre-filters
    relevantBlocks.push(block);
    technical++;
  }

  return { relevantBlocks, stats: { total: blocks.length, competitors, technical, discarded } };
}

// ═══════════════════════════════════════════════════
// GEOLOCATION & REGIONAL CLASSIFICATION
// ═══════════════════════════════════════════════════

const SP_CITIES = [
  'São Paulo', 'Campinas', 'Santos', 'São José dos Campos', 'Ribeirão Preto',
  'Guarulhos', 'Sorocaba', 'São Bernardo do Campo', 'São Bernardo', 'Osasco',
  'Bauru', 'Piracicaba', 'São Carlos', 'Jundiaí', 'Mogi das Cruzes',
  'Santo André', 'São Caetano do Sul', 'Diadema', 'Mauá', 'Suzano',
  'Taubaté', 'Limeira', 'Americana', 'Marília', 'Presidente Prudente',
  'Araraquara', 'Franca', 'Itapetininga', 'Jacareí', 'Hortolândia',
  'Rio Claro', 'Indaiatuba', 'Cotia', 'Taboão da Serra', 'Sumaré',
  'Barueri', 'Embu das Artes', 'São Vicente', 'Praia Grande', 'Guarujá',
  'Cubatão', 'Itanhaém', 'Registro', 'Atibaia', 'Bragança Paulista',
  'Botucatu', 'Assis', 'Ourinhos', 'Catanduva', 'Araçatuba',
  'Birigui', 'Votuporanga', 'São José do Rio Preto', 'Fernandópolis',
  'Jaú', 'Lençóis Paulista', 'Itu', 'Salto', 'Votorantim',
  'Carapicuíba', 'Itapecerica da Serra', 'Franco da Rocha', 'Caieiras',
  'Itapevi', 'Santana de Parnaíba', 'Guaratinguetá', 'Lorena',
  'Pindamonhangaba', 'Caraguatatuba',
  'Ubatuba', 'Ilhabela', 'Mogi Guaçu', 'Mogi Mirim', 'Amparo',
  'Valinhos', 'Vinhedo', 'Itatiba', 'Campo Limpo Paulista',
  'Várzea Paulista', 'Lins', 'Tupã', 'Adamantina', 'Dracena',
  'Presidente Epitácio', 'Presidente Venceslau', 'Penápolis',
];

const MG_CITIES = [
  'Belo Horizonte', 'Uberlândia', 'Juiz de Fora', 'Montes Claros',
  'Contagem', 'Betim', 'Uberaba', 'Governador Valadares', 'Ipatinga',
  'Poços de Caldas', 'Campo Belo', 'São José da Lapa', 'Sete Lagoas',
  'Divinópolis', 'Pouso Alegre', 'Teófilo Otoni', 'Barbacena',
  'Sabará', 'Varginha', 'Conselheiro Lafaiete', 'Patos de Minas',
  'Araguari', 'Lavras', 'Itajubá', 'Passos', 'Muriaé',
  'Ituiutaba', 'Caratinga', 'Nova Lima', 'Santa Luzia',
  'Ribeirão das Neves', 'Itabira', 'Ouro Preto', 'Viçosa',
  'São João del-Rei', 'Araxá', 'Alfenas', 'Três Corações',
  'Manhuaçu', 'Januária', 'Paracatu', 'Patrocínio', 'Frutal',
  'Curvelo', 'Diamantina', 'Pedro Leopoldo', 'Lagoa Santa',
  'Coronel Fabriciano', 'Timóteo', 'João Monlevade',
  'Congonhas', 'Itaúna', 'Formiga', 'Ubá', 'Cataguases',
  'Além Paraíba', 'Leopoldina',
];

const DF_CITIES = [
  'Brasília', 'Brasilia', 'Taguatinga', 'Ceilândia', 'Ceilandia',
  'Gama', 'Samambaia', 'Planaltina', 'Sobradinho', 'Recanto das Emas',
  'Águas Claras', 'Aguas Claras', 'Guará', 'Guara',
  'Lago Sul', 'Lago Norte', 'Asa Sul', 'Asa Norte',
  'Riacho Fundo', 'Itapoã',
  'Paranoá', 'Núcleo Bandeirante', 'Candangolândia', 'Park Way',
  'Jardim Botânico', 'Vicente Pires', 'SIA', 'SAAN', 'Sudoeste', 'Noroeste',
];

const STATE_ORGANS = [
  { pattern: /\b(Governo do Distrito Federal|GDF|TCDF|CLDF|MPDFT|PGDF|SES[\-\/]DF|SEE[\-\/]DF|NOVACAP|CAESB|CEB|TERRACAP|METRÔ[\-\/]DF)\b/gi, state: 'DF' },
  { pattern: /\b(Governo do Estado de São Paulo|SABESP|CPTM|CDHU|DERSA|DER[\-\/]SP|ARTESP|IMESP|PRODESP|CPOS|FDE|IPT|UNICAMP|UNESP|USP)\b/gi, state: 'SP' },
  { pattern: /\b(Governo do Estado de Minas Gerais|CEMIG|COPASA|DER[\-\/]MG|DEOP[\-\/]MG|CODEMIG|UFMG|UFJF|UFU|UFLA|UFV)\b/gi, state: 'MG' },
];

const STATE_FULL_NAMES: [RegExp, string][] = [
  [/\bSão Paulo\b/gi, 'SP'],
  [/\bMinas Gerais\b/gi, 'MG'],
  [/\bDistrito Federal\b/gi, 'DF'],
];

function buildCityRegex(cities: string[]): RegExp {
  const escaped = cities.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

const SP_REGEX = buildCityRegex(SP_CITIES);
const MG_REGEX = buildCityRegex(MG_CITIES);
const DF_REGEX = buildCityRegex(DF_CITIES);

// All Brazilian UF codes for detecting non-target states
const ALL_UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TARGET_UFS = ['SP', 'MG', 'DF'];

function detectState(text: string): string | null {
  // ─── STEP 1: Explicit address lines (strongest signal) ───
  // Pattern: "Endereço: ... - CITY - UF" or "CITY/UF" or "CITY - UF"
  const addressPatterns = [
    /Endere[cç]o\s*:.*?[-–—]\s*([A-Z]{2})\b/gi,
    /[-–—]\s*([A-Z]{2})\s*(?:\.|,|\s*CEP|\s*\d{5})/gi,
    /\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+[a-zà-ú]+)*)\s*[-–—\/]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/gi,
  ];

  const foundUFs: { uf: string; priority: number }[] = [];

  for (const pattern of addressPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      // The UF is either group 1 or group 2 depending on pattern
      const candidate = (m[2] || m[1]).toUpperCase();
      if (ALL_UFS.includes(candidate)) {
        foundUFs.push({ uf: candidate, priority: 1 });
      }
    }
    pattern.lastIndex = 0;
  }

  // ─── STEP 2: Explicit "em Sergipe", "no Pará", etc. (state full names for non-target) ───
  const stateFullMap: [RegExp, string][] = [
    [/\bem\s+Sergipe\b/gi, 'SE'], [/\bem\s+Alagoas\b/gi, 'AL'],
    [/\bno\s+Rio\s+de\s+Janeiro\b/gi, 'RJ'], [/\bna\s+Bahia\b/gi, 'BA'],
    [/\bno\s+Paran[áa]\b/gi, 'PR'], [/\bno\s+Rio\s+Grande\s+do\s+Sul\b/gi, 'RS'],
    [/\bem\s+Santa\s+Catarina\b/gi, 'SC'], [/\bem\s+Goi[áa]s\b/gi, 'GO'],
    [/\bem\s+Pernambuco\b/gi, 'PE'], [/\bno\s+Cear[áa]\b/gi, 'CE'],
    [/\bno\s+Par[áa]\b/gi, 'PA'], [/\bno\s+Maranh[ãa]o\b/gi, 'MA'],
    [/\bno\s+Mato\s+Grosso\b/gi, 'MT'], [/\bno\s+Mato\s+Grosso\s+do\s+Sul\b/gi, 'MS'],
    [/\bno\s+Esp[ií]rito\s+Santo\b/gi, 'ES'], [/\bna\s+Para[ií]ba\b/gi, 'PB'],
    [/\bno\s+Rio\s+Grande\s+do\s+Norte\b/gi, 'RN'], [/\bno\s+Piau[ií]\b/gi, 'PI'],
    [/\bem\s+Tocantins\b/gi, 'TO'], [/\bem\s+Rond[ôo]nia\b/gi, 'RO'],
    [/\bno\s+Acre\b/gi, 'AC'], [/\bno\s+Amap[áa]\b/gi, 'AP'],
    [/\bno\s+Amazonas\b/gi, 'AM'], [/\bem\s+Roraima\b/gi, 'RR'],
    [/\bem\s+São\s+Paulo\b/gi, 'SP'], [/\bem\s+Minas\s+Gerais\b/gi, 'MG'],
    [/\bno\s+Distrito\s+Federal\b/gi, 'DF'],
  ];

  for (const [regex, uf] of stateFullMap) {
    if (regex.test(text)) { regex.lastIndex = 0; foundUFs.push({ uf, priority: 2 }); }
    regex.lastIndex = 0;
  }

  // ─── STEP 3: Generic UF pattern (CITY - UF or CITY/UF) ───
  const genericUf = /\b[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+\s*[-–—\/]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/g;
  let gm: RegExpExecArray | null;
  while ((gm = genericUf.exec(text)) !== null) {
    foundUFs.push({ uf: gm[1].toUpperCase(), priority: 3 });
  }

  // ─── STEP 4: If ANY non-target UF was found at high priority, that's the real location ───
  if (foundUFs.length > 0) {
    // Sort by priority (1 = strongest)
    foundUFs.sort((a, b) => a.priority - b.priority);
    const bestUf = foundUFs[0].uf;
    // If the best match is a non-target UF, return it (will become AVISOS_DIVERSOS)
    return bestUf;
  }

  // ─── STEP 5: State-specific organs (only if no explicit UF found) ───
  for (const { pattern, state } of STATE_ORGANS) {
    if (pattern.test(text)) { pattern.lastIndex = 0; return state; }
    pattern.lastIndex = 0;
  }

  // ─── STEP 6: Target state full names ───
  for (const [regex, state] of STATE_FULL_NAMES) {
    if (regex.test(text)) { regex.lastIndex = 0; return state; }
    regex.lastIndex = 0;
  }

  // ─── STEP 7: City name matching (lowest priority, only if nothing else matched) ───
  if (DF_REGEX.test(text)) { DF_REGEX.lastIndex = 0; return 'DF'; }
  DF_REGEX.lastIndex = 0;
  if (SP_REGEX.test(text)) { SP_REGEX.lastIndex = 0; return 'SP'; }
  SP_REGEX.lastIndex = 0;
  if (MG_REGEX.test(text)) { MG_REGEX.lastIndex = 0; return 'MG'; }
  MG_REGEX.lastIndex = 0;

  return null;
}

// ═══════════════════════════════════════════════════
// POST-PROCESSING
// ═══════════════════════════════════════════════════

function postProcessPublications(publications: any[]): any[] {
  const competitorRegex = buildCompetitorRegex();

  return publications.map((pub: any) => {
    const fullText = [pub.full_text, pub.object_text, pub.organ].filter(Boolean).join(' ');

    const compMatch = fullText.match(competitorRegex);
    competitorRegex.lastIndex = 0;
    if (compMatch) {
      return { ...pub, section: 'CONCORRENTES', competitor_match: compMatch[0].toUpperCase(), is_relevant: true };
    }

    const detectedState = detectState(fullText);
    const finalState = pub.state || detectedState || null;
    const finalSection = finalState && ['SP', 'MG', 'DF'].includes(finalState) ? finalState : 'AVISOS_DIVERSOS';
    return { ...pub, state: finalState, section: finalSection };
  }).filter((p: any) => p.is_relevant);
}

// ═══════════════════════════════════════════════════
// AI PROMPT
// ═══════════════════════════════════════════════════

function buildSystemPrompt(): string {
  return `Você é um especialista em análise de publicações do Diário Oficial da União (DOU) - Seção 3.

════════════════════════════════════════
REGRA 0 — IGNORAR SUMÁRIO, ÍNDICES E CABEÇALHOS (BLACKLIST TOTAL)
════════════════════════════════════════
Se o bloco de texto for o SUMÁRIO do Diário Oficial (listando ministérios, órgãos e números de página) ou apenas um cabeçalho genérico (ex: 'REPÚBLICA FEDERATIVA DO BRASIL', 'IMPRENSA NACIONAL', 'Sumário', 'ISSN'), IGNORE-O COMPLETAMENTE.
NUNCA classifique o Sumário como uma publicação válida, mesmo que contenha a palavra 'DF', 'Brasília', nomes de empresas ou palavras do escopo técnico.
Uma publicação válida SEMPRE descreve um ato administrativo (Aviso, Extrato, Edital) e possui um texto corrido com objeto, não uma lista de páginas.
Se o bloco parecer ser um sumário ou índice, retorne is_relevant = false.

════════════════════════════════════════
REGRA DE ESCOPO TÉCNICO — ELIMINATÓRIA
════════════════════════════════════════
Esta regra é ELIMINATÓRIA e tem prioridade sobre qualquer outra correspondência de palavras-chave.
Se o OBJETO PRINCIPAL do texto se referir a qualquer um dos itens abaixo, DESCARTE IMEDIATAMENTE (is_relevant = false):
- Alimentação, nutrição, merenda escolar, ração animal, gêneros alimentícios
- Saúde médica, medicamentos, equipamentos hospitalares, insumos médicos
- Educação (material didático, uniformes escolares, transporte escolar)
- Veículos, automóveis, caminhões, motocicletas, locação de veículos
- Passagens aéreas, hospedagem, agência de viagens
- Agricultura, pecuária, insumos agrícolas, defensivos
- Combustíveis, abastecimento de frota
- Limpeza e conservação (sem vínculo com manutenção predial técnica)
- Vigilância patrimonial desarmada (sem sistemas eletrônicos)
- Material de escritório, expediente, impressão gráfica

Mesmo que o texto contenha palavras como "engenharia", "manutenção" ou "infraestrutura" em contextos genéricos, se o OBJETO PRINCIPAL for um dos itens acima, DESCARTE.

════════════════════════════════════════
CONTEXTO
════════════════════════════════════════
Você receberá um array JSON de blocos, cada um com um "id" numérico e um "text". Todos os blocos JÁ PASSARAM por um pré-filtro de palavras-chave.

Para CADA bloco, extraia:
- block_id: o "id" numérico do bloco original (OBRIGATÓRIO)
- publication_type: modalidade (Pregão Eletrônico, Concorrência, Dispensa, etc.)
- organ: nome do órgão publicador
- object_text: texto do campo "Objeto" da contratação
- city: cidade identificada
- estado_execucao: UF de 2 letras onde o serviço/obra será EXECUTADO (ex: SP, BA, PR, MG, DF). Baseie-se UNICAMENTE no local de execução do serviço ou sede da prefeitura demandante. IGNORE siglas no nome do órgão (ex: "CESUP - SP" não significa que é SP).
- is_relevant: true SOMENTE se for uma publicação válida com escopo técnico compatível
- competitor_match: nome do concorrente encontrado ou null

NÃO retorne o campo full_text. Use o block_id para referenciar o bloco original.

REGRAS DE CLASSIFICAÇÃO GEOGRÁFICA (RIGOROSAS):
1. Se menciona um concorrente monitorado → section = "CONCORRENTES"
2. Se o endereço/local de execução está em SP → section = "SP"
3. Se o endereço/local de execução está em MG → section = "MG"
4. Se o endereço/local de execução está em DF → section = "DF"
5. QUALQUER OUTRO ESTADO → section = "AVISOS_DIVERSOS"
6. Se não foi possível identificar o estado → section = "AVISOS_DIVERSOS"

REGRA CRÍTICA DE CLASSIFICAÇÃO GEOGRÁFICA:
A classificação do Estado (UF) deve ser baseada ÚNICA E EXCLUSIVAMENTE na cidade/estado onde o serviço será executado ou na localização da Prefeitura/órgão demandante.
IGNORE COMPLETAMENTE siglas de UF isoladas que apareçam apenas no NOME do órgão licitante (ex: "CESUP - SP", "2ª Região - SP", "Gerência Regional/SP").
Exemplo: Se o órgão é "CESUP - SP" mas o serviço será executado em Salvador/BA, o state DEVE ser "BA" e section DEVE ser "AVISOS_DIVERSOS".
Se o órgão é "Superintendência Regional/SP" mas a cidade de execução é Andirá/PR, o state DEVE ser "PR" e section DEVE ser "AVISOS_DIVERSOS".

NUNCA faça fallback para SP, MG ou DF em caso de dúvida. Na dúvida, use "AVISOS_DIVERSOS".

Concorrentes monitorados:
${COMPETITORS.map(c => `- ${c}`).join('\n')}

IMPORTANTE: Retorne TODAS as publicações válidas com escopo técnico compatível. Descarte sumários, índices e publicações fora do escopo técnico.`;
}

// ═══════════════════════════════════════════════════
// EDGE FUNCTION HANDLER
// ═══════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, readingId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log(`Processing DOU text: ${text.length} chars for reading ${readingId}`);

    // ── STEP 1: Pre-filter with keyword-based NLP ──
    const { relevantBlocks, stats } = preFilterText(text);
    console.log(`Pre-filter: ${stats.total} blocks → ${stats.competitors} competitors, ${stats.technical} technical, ${stats.discarded} discarded`);

    // ── STEP 2: Assign IDs, batch by char limit, process in parallel ──
    let aiPublications: any[] = [];

    if (relevantBlocks.length > 0) {
      const blocksWithId = relevantBlocks.map((text, id) => ({ id, text }));

      // Group into batches of ~30000 chars
      const BATCH_CHAR_LIMIT = 30000;
      const batches: { id: number; text: string }[][] = [];
      let currentBatch: { id: number; text: string }[] = [];
      let currentSize = 0;

      for (const block of blocksWithId) {
        if (currentSize + block.text.length > BATCH_CHAR_LIMIT && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(block);
        currentSize += block.text.length;
      }
      if (currentBatch.length > 0) batches.push(currentBatch);

      console.log(`Sending ${blocksWithId.length} blocks in ${batches.length} parallel batch(es) to AI`);

      // Process all batches in parallel with retry and fault tolerance
      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 3000;

      async function processBatch(batch: { id: number; text: string }[], batchIndex: number): Promise<any[]> {
        const batchJson = JSON.stringify(batch.map(b => ({ id: b.id, text: b.text })));
        console.log(`AI batch ${batchIndex + 1}/${batches.length} (${batchJson.length} chars, ${batch.length} blocks)`);

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            console.log(`Retry ${attempt}/${MAX_RETRIES} for batch ${batchIndex + 1} after ${RETRY_DELAY_MS}ms`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          }

          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: buildSystemPrompt() },
                  {
                    role: "user",
                    content: `Analise este array JSON de blocos e extraia as publicações válidas:\n\n${batchJson}`,
                  },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "classify_publications",
                    description: "Retorna as publicações estruturadas do DOU Seção 3",
                    parameters: {
                      type: "object",
                      properties: {
                        publications: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              block_id: { type: "number", description: "ID numérico do bloco original" },
                              publication_type: { type: "string" },
                              organ: { type: "string" },
                              object_text: { type: "string" },
                              city: { type: "string" },
                              estado_execucao: { type: "string", description: "UF de 2 letras onde o serviço/obra será executado (ex: SP, BA, PR, MG, DF). Baseie-se APENAS no local de execução, NUNCA em siglas no nome do órgão." },
                              is_relevant: { type: "boolean" },
                              competitor_match: { type: "string" },
                            },
                            required: ["block_id", "publication_type", "organ", "estado_execucao", "is_relevant"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["publications"],
                      additionalProperties: false,
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "classify_publications" } },
              }),
            });

            if (response.status === 429) throw new Error("RATE_LIMIT");
            if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`AI gateway error (batch ${batchIndex + 1}, attempt ${attempt + 1}): ${response.status} ${errorText}`);
              if (attempt < MAX_RETRIES) continue; // retry on 503 etc.
              return []; // give up on this batch, don't kill others
            }

            const aiResult = await response.json();
            const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

            if (toolCall?.function?.arguments) {
              try {
                const parsed = JSON.parse(toolCall.function.arguments);
                const pubs = parsed.publications || [];
                console.log(`Batch ${batchIndex + 1}: AI returned ${pubs.length} publications`);
                return pubs;
              } catch (parseErr) {
                console.error(`Failed to parse AI response for batch ${batchIndex + 1}:`, parseErr);
                return [];
              }
            }
            return [];
          } catch (err: any) {
            if (err.message === "RATE_LIMIT" || err.message === "PAYMENT_REQUIRED") throw err;
            console.error(`Batch ${batchIndex + 1} attempt ${attempt + 1} error:`, err.message);
            if (attempt === MAX_RETRIES) return []; // exhausted retries
          }
        }
        return [];
      }

      const successfulResults: any[][] = [];
      let failedBatches = 0;
      const MAX_CONCURRENT = 3;

      for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
        const currentBatchSlice = batches.slice(i, i + MAX_CONCURRENT);
        const batchPromises = currentBatchSlice.map((batch, idx) => processBatch(batch, i + idx));
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            successfulResults.push(result.value);
          } else {
            failedBatches++;
            if (result.reason?.message === "RATE_LIMIT") throw new Error("RATE_LIMIT");
            if (result.reason?.message === "PAYMENT_REQUIRED") throw new Error("PAYMENT_REQUIRED");
            console.error("Batch failed permanently:", result.reason?.message);
          }
        }
      }
      if (failedBatches > 0) {
        console.log(`${failedBatches}/${batches.length} batches failed — proceeding with ${batches.length - failedBatches} successful`);
      }

      // Flatten, reconstruct full_text, and derive section from estado_execucao in CODE
      const rawAiPubs = successfulResults.flat();
      const blockMap = new Map(blocksWithId.map(b => [b.id, b.text]));
      aiPublications = rawAiPubs.map((pub: any) => {
        const uf = (pub.estado_execucao || '').toUpperCase().trim();
        let section = "AVISOS_DIVERSOS";
        if (uf === "SP" || uf === "MG" || uf === "DF") {
          section = uf;
        }
        return {
          ...pub,
          state: uf || null,
          section,
          full_text: blockMap.get(pub.block_id) || '',
        };
      });
      console.log(`Reconstructed full_text for ${aiPublications.length} publications from block IDs (section derived from estado_execucao in code)`);
    }

    // ── STEP 3: Post-process ──
    const publications = postProcessPublications(aiPublications);
    console.log(`Final: ${aiPublications.length} AI raw → ${publications.length} after post-processing`);

    // ── STEP 4: Insert into database ──
    if (publications.length > 0) {
      const pubRecords = publications.map((pub: any) => ({
        reading_id: readingId,
        publication_type: pub.publication_type || "Não identificado",
        section: pub.section || "AVISOS_DIVERSOS",
        organ: pub.organ || null,
        object_text: pub.object_text || null,
        full_text: pub.full_text || "",
        state: pub.state || null,
        is_relevant: pub.is_relevant ?? true,
        competitor_match: pub.competitor_match || null,
      }));

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/dou_publications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(pubRecords),
      });

      if (!insertRes.ok) {
        console.error("Insert publications error:", await insertRes.text());
      }
    }

    const opportunities = publications.filter((p: any) => ["SP", "MG", "DF", "AVISOS_DIVERSOS"].includes(p.section)).length;
    const competitorMentions = publications.filter((p: any) => p.section === "CONCORRENTES").length;

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/dou_readings?id=eq.${readingId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "completed",
        total_opportunities: opportunities,
        total_competitor_mentions: competitorMentions,
      }),
    });

    if (!updateRes.ok) {
      console.error("Update reading error:", await updateRes.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalPublications: publications.length,
        opportunities,
        competitorMentions,
        preFilterStats: stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("process-dou error:", msg);
    if (msg === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
