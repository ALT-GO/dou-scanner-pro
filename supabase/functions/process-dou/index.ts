import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Competitor names — short forms for broader matching
const COMPETITORS = [
  "ORION ENGENHARIA",
  "EQS",
  "GREEN4T",
  "GLS",
  "GEMELO",
  "CETEST",
  "ACECO",
  "KOERICH",
  "MPE",
  "ATLÂNTICO ENGENHARIA",
  "VIRTUAL",
  "VIA ENGENHARIA",
];

const BLACKLIST_TERMS = [
  "EXTRATO DE CONTRATO",
  "RESULTADO DE JULGAMENTO",
  "HOMOLOGAÇÃO",
  "ADJUDICAÇÃO",
  "TERMO ADITIVO",
  "EXTRATO DE ATA",
  "RATIFICAÇÃO",
];

const NOTICE_TYPES = [
  "AVISO DE LICITAÇÃO",
  "AVISO DE PREGÃO",
  "AVISO DE CONCORRÊNCIA",
  "AVISO DE DISPENSA",
  "AVISO DE INEXIGIBILIDADE",
  "AVISO DE CHAMAMENTO PÚBLICO",
  "AVISO DE CHAMAMENTO",
  "AVISO DE CREDENCIAMENTO",
  "AVISO DE ATA DE REGISTRO DE PREÇOS",
  "AVISO DE REGISTRO DE PREÇOS",
  "INTENÇÃO DE REGISTRO DE PREÇOS",
  "AVISO DE ALTERAÇÃO",
  "AVISO DE RETIFICAÇÃO",
  "AVISO DE REPUBLICAÇÃO",
  "AVISO DE SUSPENSÃO",
  "AVISO DE REABERTURA DE PRAZO",
  "AVISO DE REABERTURA",
  "AVISO DE REVOGAÇÃO",
  "PREGÃO ELETRÔNICO",
  "CONCORRÊNCIA ELETRÔNICA",
  "CONCORRÊNCIA PÚBLICA",
];

function buildSystemPrompt(): string {
  return `Você é um especialista em análise de publicações do Diário Oficial da União (DOU) - Seção 3.

TAREFA: Analise o texto do DOU Seção 3. Primeiro, divida o texto em blocos individuais de publicação (cada publicação no DOU é separada por mudança de órgão ou título). Depois, para CADA bloco, aplique as regras abaixo NA ORDEM EXATA.

════════════════════════════════════════
REGRA 1 — MONITORAMENTO DE CONCORRENTES (PRIORIDADE MÁXIMA)
════════════════════════════════════════
Se o bloco mencionar QUALQUER uma das empresas abaixo, CAPTURE IMEDIATAMENTE com section = "CONCORRENTES".
NÃO aplique nenhum outro filtro. Capture independentemente do tipo de publicação, estado ou escopo técnico.

Empresas monitoradas:
${COMPETITORS.map(c => `- ${c}`).join('\n')}

IMPORTANTE: Busque variações como "ORION ENGENHARIA E TECNOLOGIA", "CETEST MINAS ENGENHARIA", "EQS ENGENHARIA", "MPE ENGENHARIA", "KOERICH ENGENHARIA", "VIRTUAL ENGENHARIA" etc. Se o nome da empresa aparecer mesmo parcialmente (ex: apenas "CETEST" ou "GREEN4T"), capture.

════════════════════════════════════════
REGRA 2 — IDENTIFICAR AVISOS DE LICITAÇÃO
════════════════════════════════════════
Se nenhum concorrente foi detectado na Regra 1, verifique se o bloco contém um aviso de contratação pública.

Se o bloco contiver QUALQUER um destes termos no início ou título, é um aviso válido:
${NOTICE_TYPES.map(t => `- ${t}`).join('\n')}

Se o bloco contiver termos como EXTRATO DE CONTRATO, RESULTADO DE JULGAMENTO, HOMOLOGAÇÃO, ADJUDICAÇÃO, TERMO ADITIVO, EXTRATO DE ATA ou RATIFICAÇÃO — IGNORE o bloco (processo já finalizado).

Se o bloco NÃO contém nenhum tipo de aviso válido, IGNORE.

════════════════════════════════════════
REGRA 3 — FILTRO DE ESCOPO TÉCNICO
════════════════════════════════════════
Para blocos que passaram pela Regra 2, analise o OBJETO da contratação semanticamente. Capture APENAS se relacionado a:

ENGENHARIA E OBRAS: engenharia, obras, construção, reforma, ampliação, adequação predial, retrofit, infraestrutura

MANUTENÇÃO PREDIAL: manutenção predial, manutenção preventiva, manutenção corretiva, facilities técnico, serviços de manutenção

SISTEMAS PREDIAIS: instalações elétricas, climatização, ar condicionado, HVAC, automação predial, CFTV, controle de acesso, detecção de incêndio, combate a incêndio, sistema de alarme

AMBIENTES DE MISSÃO CRÍTICA: data center, datacenter, sala cofre, ambientes de missão crítica, CPD, centro de dados, infraestrutura de TI crítica

ENERGIA: energia solar, sistema fotovoltaico, geração solar, usina solar

Se o objeto trata de: segurança patrimonial, vigilância armada/desarmada, limpeza, alimentação, mobiliário, material de escritório, medicamentos, uniformes, transporte, combustível, software/TI genérico — IGNORE.

A análise deve ser SEMÂNTICA — considere sinônimos, siglas e variações.

════════════════════════════════════════
REGRA 4 — CLASSIFICAÇÃO POR ESTADO
════════════════════════════════════════
Identifique o estado analisando: padrões "Cidade/UF", "Cidade-UF", nome do estado por extenso, cidades conhecidas.

Estados prioritários:
- SP → section = "SP"
- MG → section = "MG"  
- DF → section = "DF"
- Qualquer outro estado → section = "AVISOS_DIVERSOS"

Para cada publicação capturada, extraia:
- publication_type: modalidade da licitação (ex: "Pregão Eletrônico", "Concorrência Eletrônica", "Dispensa de Licitação")
- organ: nome do órgão publicador
- object_text: texto do campo "Objeto" da contratação
- full_text: texto completo do bloco de publicação
- city: cidade identificada
- state: UF identificada (ex: "SP", "MG", "DF", "PE")
- is_relevant: true
- competitor_match: nome do concorrente encontrado (ou null)
- section: classificação final ("SP", "MG", "DF", "CONCORRENTES", "AVISOS_DIVERSOS")

IMPORTANTE: Retorne TODAS as publicações relevantes. Não omita nenhuma. Se houver 10 publicações relevantes, retorne 10.`;
}

function buildCompetitorRegex(): RegExp {
  const patterns = COMPETITORS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

function detectState(text: string): string | null {
  // Pattern: Cidade/UF or Cidade-UF
  const ufPattern = /(?:[A-Za-zÀ-ÿ\s]+)[\/\-–—]\s*(SP|MG|DF|RJ|BA|PR|RS|SC|GO|PE|CE|PA|MA|MT|MS|ES|PB|RN|AL|PI|SE|TO|RO|AC|AP|AM|RR)\b/gi;
  const matches = [...text.matchAll(ufPattern)];
  
  // Prioritize SP/MG/DF
  for (const m of matches) {
    const uf = m[1].toUpperCase();
    if (['SP', 'MG', 'DF'].includes(uf)) return uf;
  }
  
  // City-based detection
  const cityMap: [RegExp, string][] = [
    [/\b(Bras[íi]lia|Taguatinga|Ceil[âa]ndia|Gama|Samambaia|Planaltina|Governo do Distrito Federal|GDF)\b/gi, 'DF'],
    [/\b(Campinas|Santos|São José dos Campos|Ribeirão Preto|Guarulhos|Sorocaba|São Bernardo|Osasco|Bauru|Piracicaba|São Carlos|Jundiaí|Mogi das Cruzes|São Paulo)\b/gi, 'SP'],
    [/\b(Belo Horizonte|Uberlândia|Juiz de Fora|Montes Claros|Contagem|Betim|Uberaba|Governador Valadares|Ipatinga|Poços de Caldas|Campo Belo|São José da Lapa)\b/gi, 'MG'],
  ];
  
  for (const [regex, state] of cityMap) {
    if (regex.test(text)) {
      regex.lastIndex = 0;
      return state;
    }
    regex.lastIndex = 0;
  }
  
  // Return any other UF found
  if (matches.length > 0) return matches[0][1].toUpperCase();
  
  return null;
}

function postProcessPublications(publications: any[]): any[] {
  const competitorRegex = buildCompetitorRegex();
  
  return publications.map((pub: any) => {
    const fullText = [pub.full_text, pub.object_text, pub.organ].filter(Boolean).join(' ');
    
    // RULE 1: Competitor override
    const compMatch = fullText.match(competitorRegex);
    competitorRegex.lastIndex = 0;
    if (compMatch) {
      return {
        ...pub,
        section: 'CONCORRENTES',
        competitor_match: compMatch[0].toUpperCase(),
        is_relevant: true,
      };
    }
    
    // RULE 4: State classification refinement
    const detectedState = detectState(fullText);
    const finalState = detectedState || pub.state || null;
    const finalSection = finalState && ['SP', 'MG', 'DF'].includes(finalState) 
      ? finalState 
      : 'AVISOS_DIVERSOS';
    
    return { ...pub, state: finalState, section: finalSection };
  }).filter((p: any) => p.is_relevant);
}

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

    // Split into chunks if text is very large
    const maxChars = 100000;
    const chunks: string[] = [];
    if (text.length <= maxChars) {
      chunks.push(text);
    } else {
      // Split at paragraph boundaries
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
          chunks.push(remaining);
          break;
        }
        // Find a good split point (double newline near the limit)
        let splitAt = remaining.lastIndexOf('\n\n', maxChars);
        if (splitAt < maxChars * 0.5) splitAt = remaining.lastIndexOf('\n', maxChars);
        if (splitAt < maxChars * 0.5) splitAt = maxChars;
        chunks.push(remaining.substring(0, splitAt));
        remaining = remaining.substring(splitAt);
      }
    }

    console.log(`Split into ${chunks.length} chunk(s)`);

    let allPublications: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

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
              content: `Analise o seguinte texto extraído do DOU Seção 3. Divida em blocos de publicação individuais e aplique as 4 regras para cada bloco. Retorne TODAS as publicações relevantes:\n\n${chunks[i]}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_publications",
                description: "Retorna as publicações relevantes identificadas no DOU Seção 3",
                parameters: {
                  type: "object",
                  properties: {
                    publications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          publication_type: { type: "string", description: "Modalidade: Pregão Eletrônico, Concorrência, Dispensa, etc." },
                          organ: { type: "string", description: "Órgão publicador" },
                          object_text: { type: "string", description: "Texto do campo Objeto" },
                          full_text: { type: "string", description: "Texto completo do bloco de publicação" },
                          city: { type: "string", description: "Cidade identificada" },
                          state: { type: "string", description: "UF identificada (SP, MG, DF, PE, etc.)" },
                          is_relevant: { type: "boolean" },
                          competitor_match: { type: "string", description: "Nome do concorrente encontrado ou null" },
                          section: {
                            type: "string",
                            enum: ["SP", "MG", "DF", "CONCORRENTES", "AVISOS_DIVERSOS"],
                          },
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
            },
          ],
          tool_choice: { type: "function", function: { name: "classify_publications" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          allPublications.push(...chunkPubs);
        } catch (parseErr) {
          console.error(`Failed to parse AI response for chunk ${i + 1}:`, parseErr);
        }
      }
    }

    // Post-process with regex enforcement
    const publications = postProcessPublications(allPublications);
    console.log(`Post-processing: ${allPublications.length} raw → ${publications.length} final`);

    // Insert publications into database
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

    const opportunities = publications.filter(
      (p: any) => ["SP", "MG", "DF", "AVISOS_DIVERSOS"].includes(p.section)
    ).length;
    const competitorMentions = publications.filter(
      (p: any) => p.section === "CONCORRENTES"
    ).length;

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
