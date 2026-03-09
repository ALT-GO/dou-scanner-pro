import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPETITORS = [
  "ORION ENGENHARIA",
  "EQS",
  "GREEN4T",
  "GEMELO",
  "KOERICH",
  "VIA ENGENHARIA",
  "ATLÂNTICO ENGENHARIA",
  "ACECO",
  "GLS",
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

    // Truncate text if too long - split into chunks for processing
    const maxChars = 80000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

    const systemPrompt = `Você é um especialista em análise de publicações do Diário Oficial da União (DOU) - Seção 3.

Sua tarefa é analisar o texto extraído do DOU Seção 3 e identificar cada publicação individual relacionada a processos licitatórios.

TIPOS DE PUBLICAÇÃO A IDENTIFICAR:
- Aviso de Licitação
- Aviso de Pregão
- Aviso de Concorrência
- Aviso de Registro de Preços
- Aviso de Suspensão
- Aviso de Alteração
- Extrato de Dispensa de Licitação
- Extrato de Contrato
- Resultado de Julgamento
- Outros avisos relacionados a licitações

ESCOPO DA EMPRESA (para avaliar relevância):
A empresa atua em:
- manutenção predial e industrial
- retrofits prediais e industriais
- sistemas de segurança eletrônica
- ambientes de missão crítica (datacenters, salas técnicas, hospitais)
- eficiência predial (energia fotovoltaica, esgoto a vácuo, automação)
- gestão contínua de infraestrutura
- soluções IoT para monitoramento de energia, água, gás e climatização
- serviços de engenharia civil, elétrica, mecânica relacionados

CONCORRENTES A MONITORAR: ${COMPETITORS.join(", ")}

REGRAS DE CLASSIFICAÇÃO:
1. Publicações de SP, MG ou DF que sejam relevantes ao escopo → section = estado correspondente (SP, MG, DF)
2. Publicações que mencionem qualquer concorrente ou ORION ENGENHARIA → section = "CONCORRENTES" (independente do estado)
3. Publicações relevantes mas sem estado/município claro → section = "AVISOS_DIVERSOS"
4. Publicações não relevantes ao escopo da empresa devem ser ignoradas

Para cada publicação, extraia:
- publication_type: tipo da publicação
- organ: órgão publicador
- object_text: texto do campo "Objeto" (se houver)
- full_text: texto completo da publicação
- state: UF identificada (se houver)
- is_relevant: se é relevante ao escopo da empresa
- competitor_match: nome do concorrente encontrado (se houver)
- section: classificação (SP, MG, DF, CONCORRENTES, AVISOS_DIVERSOS)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise o seguinte texto extraído do DOU Seção 3 e retorne as publicações identificadas:\n\n${truncatedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_publications",
              description: "Classifica e retorna todas as publicações identificadas no DOU Seção 3",
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
        is_relevant: pub.is_relevant ?? false,
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
      (p: any) => ["SP", "MG", "DF", "AVISOS_DIVERSOS"].includes(p.section) && p.is_relevant
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
