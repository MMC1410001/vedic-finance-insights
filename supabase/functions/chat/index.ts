import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getReport } from "../_shared/get-report.ts";
import { requireUser } from "../_shared/require-paid-user.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `You are VedicFinance's Vedic Financial Astrologer AI. You answer questions about the user's financial astrology using the computed Vedic chart data provided below.

GROUNDING RULES:
1. ONLY use the chart data, scores, dasha periods, transits, and reasoning provided. Do NOT invent planetary positions.
2. When referencing planets, houses, signs, nakshatras, or dashas: cite the exact values from the data.
3. Use Vedic terminology: Mahadasha, Antardasha, Rashi, Bhava, Nakshatra, Lagna, Dhana Yoga, etc.
4. Keep answers concise (2-4 paragraphs max). Use bullet points for scores or lists.
5. Never claim to predict exact monetary amounts or specific stock/crypto prices.
6. Speak with confidence about the Vedic analysis while noting the confidence level from the data.

CONVERSATION RULES. Read these carefully, they matter as much as the rules above:
7. Greetings and small talk ("hi", "how are you", "thanks", "who are you") are NOT off-topic. Reply warmly in one short line, then offer a concrete next step drawn from THIS user's chart: e.g. name their running Mahadasha or their strongest score and invite a question about it. Never refuse a greeting.
8. Short follow-ups ("why", "how", "explain", "more", "and?", "really?") always refer to your previous answer. Expand on what you just said with deeper chart evidence: the specific house lord, dasha lord, or transit behind it. NEVER treat a follow-up as a new off-topic question.
9. Only decline when the question is genuinely unrelated to the user's finances, life timing, or chart (e.g. coding help, news, recipes, someone else's chart). When you decline: acknowledge the question in your own words, say in one sentence that your reading is limited to this birth chart, and then point to something specific you CAN answer from their data. Phrase it freshly every time.
10. NEVER repeat a sentence you have already used earlier in this conversation. If you notice you're about to give the same reply twice, say something different and more specific instead.
11. If the chart data is thin for a question, say what the data does support rather than refusing outright.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // The AI Astrologer is the paid feature. Verify before touching OpenAI, so
    // an unauthorised caller can never spend a token of the API budget.
    const gate = await requireUser(req, { requirePaid: true });
    if (gate.response) return gate.response;

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        reply: "AI chat is not configured. Please set OPENAI_API_KEY in Supabase secrets.",
        chart_context: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { message, history = [] } = body;

    // Get real chart data from generate-report, forwarding the verified caller
    // identity rather than re-reading the header.
    const report = await getReport(body, gate.authHeader);

    const chartJson = JSON.stringify({
      lagna: report.d1_chart?.lagna_sign,
      planets: report.d1_chart?.planets,
      houses: report.d1_chart?.houses,
      dasha: report.dasha,
      transits: report.transits,
      scores: report.scores,
      dashboard: report.dashboard,
      reasoning: report.reasoning,
      confidence: report.confidence,
      summary: report.summary,
    }, null, 2);

    const sysMsg = SYSTEM_PROMPT + `\n\nUSER'S COMPUTED CHART DATA:\n\`\`\`json\n${chartJson}\n\`\`\``;

    const messages = [
      { role: "system", content: sysMsg },
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.6,
        // Discourage the model from echoing the same canned sentence turn after turn.
        frequency_penalty: 0.4,
        presence_penalty: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "Couldn't generate a response.";

    return new Response(JSON.stringify({
      reply,
      chart_context: { scores: report.scores, summary: report.summary, dasha: report.dasha },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ detail: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
