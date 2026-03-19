import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const COMPETITORS = [
  "ORION", "ORION ENGENHARIA", "ORION ENGENHARIA E TECNOLOGIA",
  "GREEN4T", "GLS ENGENHARIA", "GLS", "VIRTUAL ENGENHARIA", "VIRTUAL",
  "GEMELO", "CETEST", "KOERICH", "KOERICH ENGENHARIA",
  "MPE", "MPE ENGENHARIA", "EQS", "EQS ENGENHARIA",
  "ACECO", "ACECO TI", "ATLÂNTICO ENGENHARIA", "VIA ENGENHARIA",
];

const BLACKLIST_TERMS = [
  "EXTRATO DE CONTRATO", "RESULTADO DE JULGAMENTO",
  "HOMOLOGAÇÃO", "ADJUDICAÇÃO", "TERMO ADITIVO",
  "EXTRATO DE ATA", "RATIFICAÇÃO",
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
  "AVISO DE REABERTURA", "AVISO DE REVOGAÇÃO",
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
  const patterns = COMPETITORS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
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
    'EXTRATO DE DISPENSA', 'EXTRATO DE INEXIGIBILIDADE',
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

    // RULE 1: Competitor match — push to relevantBlocks (AI will extract organ/object)
    if (matchesCompetitor(block)) {
      relevantBlocks.push(block);
      competitors++;
      continue;
    }

    // RULE 2: Must not be blacklisted AND must contain a valid notice type
    if (containsBlacklist(block)) { discarded++; continue; }
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
  'Cruzeiro', 'Pindamonhangaba', 'Caraguatatuba', 'São Sebastião',
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
  'Além Paraíba', 'Leopoldina', 'Santos Dumont',
];

const DF_CITIES = [
  'Brasília', 'Brasilia', 'Taguatinga', 'Ceilândia', 'Ceilandia',
  'Gama', 'Samambaia', 'Planaltina', 'Sobradinho', 'Recanto das Emas',
  'Águas Claras', 'Aguas Claras', 'Guará', 'Guara', 'Cruzeiro',
  'Lago Sul', 'Lago Norte', 'Asa Sul', 'Asa Norte',
  'São Sebastião', 'Santa Maria', 'Riacho Fundo', 'Itapoã',
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

function detectState(text: string): string | null {
  const ufPattern = /(?:[A-Za-zÀ-ÿ\s]+)[\/\-–—]\s*(SP|MG|DF|RJ|BA|PR|RS|SC|GO|PE|CE|PA|MA|MT|MS|ES|PB|RN|AL|PI|SE|TO|RO|AC|AP|AM|RR)\b/gi;
  const ufMatches = [...text.matchAll(ufPattern)];
  for (const m of ufMatches) {
    const uf = m[1].toUpperCase();
    if (['SP', 'MG', 'DF'].includes(uf)) return uf;
  }

  for (const { pattern, state } of STATE_ORGANS) {
    if (pattern.test(text)) { pattern.lastIndex = 0; return state; }
    pattern.lastIndex = 0;
  }

  for (const [regex, state] of STATE_FULL_NAMES) {
    if (regex.test(text)) { regex.lastIndex = 0; return state; }
    regex.lastIndex = 0;
  }

  if (DF_REGEX.test(text)) { DF_REGEX.lastIndex = 0; return 'DF'; }
  DF_REGEX.lastIndex = 0;
  if (SP_REGEX.test(text)) { SP_REGEX.lastIndex = 0; return 'SP'; }
  SP_REGEX.lastIndex = 0;
  if (MG_REGEX.test(text)) { MG_REGEX.lastIndex = 0; return 'MG'; }
  MG_REGEX.lastIndex = 0;

  if (ufMatches.length > 0) return ufMatches[0][1].toUpperCase();
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
    const finalState = detectedState || pub.state || null;
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
CONTEXTO
════════════════════════════════════════
Você receberá um array JSON de blocos, cada um com um "id" numérico e um "text". Todos os blocos JÁ PASSARAM por um pré-filtro de palavras-chave.

Para CADA bloco, extraia:
- block_id: o "id" numérico do bloco original (OBRIGATÓRIO)
- publication_type: modalidade (Pregão Eletrônico, Concorrência, Dispensa, etc.)
- organ: nome do órgão publicador
- object_text: texto do campo "Objeto" da contratação
- city: cidade identificada
- state: UF (SP, MG, DF, PE, etc.)
- is_relevant: true se for uma publicação válida (ato administrativo), false se for sumário/lixo
- competitor_match: nome do concorrente encontrado ou null
- section: classificação ("SP", "MG", "DF", "CONCORRENTES", "AVISOS_DIVERSOS")

NÃO retorne o campo full_text. Use o block_id para referenciar o bloco original.

REGRAS DE CLASSIFICAÇÃO:
1. Se menciona um concorrente → section = "CONCORRENTES"
2. Se estado = SP → section = "SP"
3. Se estado = MG → section = "MG"
4. Se estado = DF → section = "DF"
5. Caso contrário → section = "AVISOS_DIVERSOS"

Concorrentes monitorados:
${COMPETITORS.map(c => `- ${c}`).join('\n')}

IMPORTANTE: Retorne TODAS as publicações válidas. Não omita nenhuma. Descarte sumários e índices.`;
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
    // All relevant blocks (including competitor matches) go into relevantBlocks
    const { relevantBlocks, stats } = preFilterText(text);
    console.log(`Pre-filter: ${stats.total} blocks → ${stats.competitors} competitors, ${stats.technical} technical, ${stats.discarded} discarded`);

    // ── STEP 2: Send ALL relevant blocks to AI for structured extraction ──
    let aiPublications: any[] = [];

    if (relevantBlocks.length > 0) {
      const relevantText = relevantBlocks.join('\n\n---BLOCO---\n\n');
      const maxChars = 100000;
      const chunks: string[] = [];

      if (relevantText.length <= maxChars) {
        chunks.push(relevantText);
      } else {
        let remaining = relevantText;
        while (remaining.length > 0) {
          if (remaining.length <= maxChars) { chunks.push(remaining); break; }
          let splitAt = remaining.lastIndexOf('---BLOCO---', maxChars);
          if (splitAt < maxChars * 0.3) splitAt = remaining.lastIndexOf('\n', maxChars);
          if (splitAt < maxChars * 0.3) splitAt = maxChars;
          chunks.push(remaining.substring(0, splitAt));
          remaining = remaining.substring(splitAt);
        }
      }

      console.log(`Sending ${relevantBlocks.length} relevant blocks in ${chunks.length} chunk(s) to AI`);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`AI chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

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
                content: `Extraia e estruture as publicações dos blocos abaixo (separados por ---BLOCO---). Cada bloco já foi pré-filtrado como relevante:\n\n${chunks[i]}`,
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
                          publication_type: { type: "string" },
                          organ: { type: "string" },
                          object_text: { type: "string" },
                          full_text: { type: "string" },
                          city: { type: "string" },
                          state: { type: "string" },
                          is_relevant: { type: "boolean" },
                          competitor_match: { type: "string" },
                          section: { type: "string", enum: ["SP", "MG", "DF", "CONCORRENTES", "AVISOS_DIVERSOS"] },
                        },
                        required: ["publication_type", "organ", "full_text", "section", "is_relevant"],
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

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const errorText = await response.text();
          console.error(`AI gateway error (chunk ${i + 1}):`, response.status, errorText);
          throw new Error(`AI gateway error: ${response.status}`);
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

        if (toolCall?.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            const chunkPubs = parsed.publications || [];
            console.log(`Chunk ${i + 1}: AI returned ${chunkPubs.length} publications`);
            aiPublications.push(...chunkPubs);
          } catch (parseErr) {
            console.error(`Failed to parse AI response for chunk ${i + 1}:`, parseErr);
          }
        }
      }
    }

    // ── STEP 3: Post-process (competitor regex override + state classification) ──
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
    console.error("process-dou error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
