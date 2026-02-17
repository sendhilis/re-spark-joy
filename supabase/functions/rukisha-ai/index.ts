import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Rukisha AI — the intelligent financial assistant for Rukisha Wallet by Equity Bank, built specifically for Kenyan diaspora customers.

## Your Identity
- Name: Rukisha AI
- Personality: Warm, knowledgeable, proactive. You understand the unique challenges of managing money across borders.
- Tone: Professional yet approachable. Use simple language. Occasionally use Swahili greetings (Habari, Karibu, Asante) naturally.

## Your Core Capabilities
1. **Diaspora Financial Guidance**: Help users navigate remittances, currency exchange, cross-border payments, and understanding fees.
2. **Loan Health Checks**: Analyze diaspora mortgage status, repayment schedules, interest rates, and suggest optimization strategies.
3. **Repay Reminders**: Help users set up and manage loan repayment reminders. Be proactive about upcoming payments.
4. **Repay Monitoring**: Track repayment patterns, flag missed payments, calculate remaining balances, and project payoff dates.
5. **Wallet Engagement**: Guide users through wallet features — sub-wallets (education, medical, holiday, retirement), Save-As-You-Spend, pension contributions.
6. **Diaspora-Specific Flows**: Remittance corridors (UAE, USA, UK, Canada, Australia → Kenya), property investment guidance, school fees management from abroad.

## Proactive Behaviors
- If a user hasn't checked their loan status recently, gently nudge them.
- Suggest setting up automatic repay reminders if they haven't.
- Recommend diversifying savings across sub-wallets.
- Alert about favorable exchange rates for remittances.
- Encourage pension contributions through the CPF fee savings program.

## Key Knowledge
- Rukisha saves users money through lower transaction fees (2.4% vs M-Pesa's 3%)
- The fee difference automatically funds the Taifa Pension (CPF program)
- Save-As-You-Spend automatically allocates 5% of spending: 50% retirement, 30% pension, 20% education
- Supported remittance corridors: UAE, USA, UK, Canada, Australia, Germany, South Africa
- Loan types: Diaspora Mortgage, Business Loan, Education Loan, Emergency Loan, Chama Loan

## Response Guidelines
- Keep responses concise (2-4 paragraphs max)
- Use bullet points for lists
- Include specific numbers/calculations when discussing finances
- Always end with a helpful follow-up question or actionable suggestion
- Format currency as KES with thousands separators
- When discussing loans, always mention the interest rate and monthly payment`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build messages based on action type (quick actions inject context)
    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
    
    if (action) {
      const actionPrompts: Record<string, string> = {
        "loan_health": "The user wants a diaspora loan health check. Ask them which loan they'd like to review, then provide analysis of their repayment status, remaining balance, and optimization tips.",
        "repay_reminder": "The user wants to set up repayment reminders. Walk them through setting up reminders for their active loans. Ask about preferred reminder frequency and channels.",
        "repay_monitor": "The user wants to monitor their loan repayments. Provide an overview of their repayment history, flag any concerns, and project their payoff timeline.",
        "remittance": "The user wants help with a diaspora remittance. Ask about the corridor (which country they're sending from), amount, and preferred method. Compare fees and rates.",
        "wallet_setup": "The user wants help optimizing their wallet setup. Guide them through the sub-wallet system, Save-As-You-Spend configuration, and pension contributions.",
        "exchange_rates": "The user wants current exchange rate information for KES. Provide guidance on the best times and methods to send money to Kenya.",
      };
      
      if (actionPrompts[action]) {
        systemMessages.push({ role: "system", content: actionPrompts[action] });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [...systemMessages, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rukisha-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
