import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPETITORS = [
  "ORION ENGENHARIA",
  "EQS ENGENHARIA",
  "GREEN4T",
  "GLS",
  "GEMELO",
  "CETEST",
  "ACECO",
  "KOERICH ENGENHARIA",
  "MPE ENGENHARIA",
  "ATLÂNTICO ENGENHARIA",
  "VIRTUAL ENGENHARIA",
  "VIA ENGENHARIA",
];

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

    const maxChars = 80000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

    const systemPrompt = `Você é um especialista em análise de publicações do Diário Oficial da União (DOU) - Seção 3.

O arquivo enviado já corresponde à Seção 3, portanto você NÃO precisa identificar a seção do documento. Apenas interprete corretamente o conteúdo das publicações.

Sua tarefa é analisar o texto e identificar publicações relevantes seguindo RIGOROSAMENTE as regras abaixo, na ordem de prioridade indicada.

═══════════════════════════════════════════
REGRA 1 — MONITORAMENTO DE CONCORRENTES / ORION (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════
Antes de qualquer outro filtro, verifique se a publicação menciona alguma empresa da lista abaixo em QUALQUER parte do texto.

Se mencionar QUALQUER uma dessas empresas, a publicação DEVE ser capturada com section = "CONCORRENTES", INDEPENDENTEMENTE do tipo de publicação, estado ou escopo técnico.

Empresas monitoradas: ${COMPETITORS.join(", ")}

═══════════════════════════════════════════
REGRA 2 — IDENTIFICAR AVISOS RELACIONADOS A LICITAÇÃO
═══════════════════════════════════════════
Capturar publicações que contenham AVISOS relacionados a processos de contratação pública:

Abertura de processos:
- Aviso de Licitação
- Aviso de Pregão
- Aviso de Concorrência
- Aviso de Dispensa
- Aviso de Inexigibilidade
- Aviso de Chamamento Público
- Aviso de Credenciamento
- Aviso de Ata de Registro de Preços
- Intenção de Registro de Preços (IRP)

Atualização/modificação de processos:
- Aviso de Alteração
- Aviso de Retificação
- Aviso de Republicação
- Aviso de Suspensão
- Aviso de Reabertura de Prazo
- Aviso de Revogação

Publicações que NÃO são avisos de licitação (ex: Extratos de Contrato, Resultados de Julgamento, Homologação, Adjudicação, Termo Aditivo) devem ser IGNORADAS, a menos que mencionem concorrentes (Regra 1).

═══════════════════════════════════════════
REGRA 3 — ANALISAR O OBJETO DA CONTRATAÇÃO (FILTRO TÉCNICO)
═══════════════════════════════════════════
Após identificar um aviso de licitação, leia o campo "Objeto" ou a descrição da contratação.
Capture APENAS se o objeto estiver relacionado às atividades abaixo:

ENGENHARIA E OBRAS:
engenharia, obras, reforma, ampliação, adequação predial, retrofit, infraestrutura

MANUTENÇÃO PREDIAL:
manutenção predial, manutenção preventiva, manutenção corretiva, facilities técnico

SISTEMAS PREDIAIS:
instalações elétricas, climatização, ar condicionado, automação predial, CFTV, controle de acesso, sistemas de detecção e combate a incêndio

AMBIENTES DE MISSÃO CRÍTICA:
data center, datacenter, sala cofre, ambientes de missão crítica, infraestrutura de data center, infraestrutura crítica de TI, CPD, centro de dados

ENERGIA:
energia solar, sistema fotovoltaico, geração fotovoltaica, usina solar, implantação de sistema fotovoltaico

Se o objeto NÃO tem relação com essas atividades (ex: vigilância patrimonial, limpeza, alimentação, compra de mobiliário, materiais administrativos), a publicação deve ser IGNORADA.

═══════════════════════════════════════════
REGRA DE SIMILARIDADE SEMÂNTICA
═══════════════════════════════════════════
Os termos listados acima são EXEMPLOS de referência. A análise deve ser CONTEXTUAL e SEMÂNTICA.

NÃO dependa apenas de correspondência exata de palavras. Considere:
- Palavras juntas ou separadas: "data center" = "datacenter" = "data-center"
- Siglas: "CPD" = "centro de processamento de dados"
- Sinônimos técnicos: "sistema fotovoltaico" = "energia solar" = "geração solar"
- Variações de grafia comuns em publicações oficiais

═══════════════════════════════════════════
REGRA 4 — IDENTIFICAÇÃO DO ESTADO
═══════════════════════════════════════════
Após o filtro técnico, identifique o estado da contratação.
A identificação NÃO deve depender apenas da sigla do estado.

Considere qualquer município, cidade, órgão público ou entidade localizada nesses estados:

SP (São Paulo): Campinas, Santos, São José dos Campos, Ribeirão Preto, Guarulhos, Sorocaba, São Bernardo, Osasco e demais municípios paulistas.
MG (Minas Gerais): Belo Horizonte, Uberlândia, Juiz de Fora, Montes Claros, Contagem, Betim e demais municípios mineiros.
DF (Distrito Federal): Brasília, Taguatinga, Ceilândia, Gama, Samambaia, Planaltina, Governo do Distrito Federal, Secretarias do GDF.

Para identificar o estado, analise o TEXTO COMPLETO da publicação procurando:
- Padrão "Cidade/UF" (ex: "Santos/SP", "Belo Horizonte/MG", "Brasília/DF")
- Padrão "Cidade-UF" ou "Cidade - UF"
- Nome do estado por extenso
- Cidades conhecidas dos estados acima

═══════════════════════════════════════════
REGRA 5 — CLASSIFICAÇÃO FINAL
═══════════════════════════════════════════
- SP → section = "SP"
- MG → section = "MG"
- DF → section = "DF"
- Outros estados ou estado não identificado → section = "AVISOS_DIVERSOS"

RESULTADO: Para cada publicação capturada, extraia:
- publication_type: tipo da publicação (ex: "Aviso de Pregão", "Aviso de Licitação")
- organ: órgão publicador
- object_text: texto do campo "Objeto" (se houver)
- full_text: texto completo da publicação
- state: UF identificada (se houver)
- is_relevant: true (só retorne publicações relevantes)
- competitor_match: nome do concorrente encontrado (se houver, senão null)
- section: classificação (SP, MG, DF, CONCORRENTES, AVISOS_DIVERSOS)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise o seguinte texto extraído do DOU Seção 3 e retorne APENAS as publicações relevantes conforme as regras:\n\n${truncatedText}`,
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
                        publication_type: { type: "string" },
                        organ: { type: "string" },
                        object_text: { type: "string" },
                        full_text: { type: "string" },
                        state: { type: "string" },
                        is_relevant: { type: "boolean" },
                        competitor_match: { type: "string" },
                        section: {
                          type: "string",
                          enum: ["SP", "MG", "DF", "CONCORRENTES", "AVISOS_DIVERSOS"],
                        },
                      },
                      required: ["publication_type", "full_text", "section", "is_relevant"],
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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    let publications: any[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      publications = parsed.publications || [];
    }

    // Post-process: enforce competitor detection with regex
    const competitorPatterns = COMPETITORS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const competitorRegex = new RegExp(`(${competitorPatterns.join('|')})`, 'gi');

    const stateRegex = /[A-Za-zÀ-ÿ\s]+[\/\-–—]\s*(SP|MG|DF|RJ|BA|PR|RS|SC|GO|PE|CE|PA|MA|MT|MS|ES|PB|RN|AL|PI|SE|TO|RO|AC|AP|AM|RR)\b/gi;
    const dfCities = /\b(Bras[íi]lia|Taguatinga|Ceil[âa]ndia|Gama|Samambaia|Planaltina|Governo do Distrito Federal|GDF)\b/gi;
    const spCities = /\b(Campinas|Santos|São José dos Campos|Ribeirão Preto|Guarulhos|Sorocaba|São Bernardo|Osasco|Bauru|Piracicaba|São Carlos|Jundiaí|Mogi das Cruzes)\b/gi;
    const mgCities = /\b(Belo Horizonte|Uberlândia|Juiz de Fora|Montes Claros|Contagem|Betim|Uberaba|Governador Valadares|Ipatinga|Poços de Caldas)\b/gi;

    publications = publications.map((pub: any) => {
      const fullText = (pub.full_text || '') + ' ' + (pub.object_text || '') + ' ' + (pub.organ || '');

      // Priority 1: Competitor check
      const compMatch = fullText.match(competitorRegex);
      if (compMatch) {
        return { ...pub, section: 'CONCORRENTES', competitor_match: compMatch[0].toUpperCase(), is_relevant: true };
      }

      // Priority 2: State detection refinement
      let detectedState: string | null = pub.state || null;
      const stateMatches = fullText.matchAll(stateRegex);
      for (const m of stateMatches) {
        const uf = m[1].toUpperCase();
        if (['SP', 'MG', 'DF'].includes(uf)) {
          detectedState = uf;
          break;
        }
        if (!detectedState) detectedState = uf;
      }

      // Check city names for state detection
      if (!detectedState || !['SP', 'MG', 'DF'].includes(detectedState)) {
        if (dfCities.test(fullText)) {
          detectedState = 'DF';
        }
        dfCities.lastIndex = 0;
      }
      if (!detectedState || !['SP', 'MG', 'DF'].includes(detectedState)) {
        if (spCities.test(fullText)) {
          detectedState = 'SP';
        }
        spCities.lastIndex = 0;
      }
      if (!detectedState || !['SP', 'MG', 'DF'].includes(detectedState)) {
        if (mgCities.test(fullText)) {
          detectedState = 'MG';
        }
        mgCities.lastIndex = 0;
      }

      if (detectedState && ['SP', 'MG', 'DF'].includes(detectedState)) {
        return { ...pub, state: detectedState, section: detectedState };
      }

      return { ...pub, state: detectedState, section: 'AVISOS_DIVERSOS' };
    });

    // Filter only relevant
    publications = publications.filter((p: any) => p.is_relevant);

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
        const errText = await insertRes.text();
        console.error("Insert publications error:", errText);
      }
    }

    // Update reading stats
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
