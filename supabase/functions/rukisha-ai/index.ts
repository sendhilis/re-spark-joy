import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lipafo AI — the intelligent assistant for Lipafo, an AI powered wallet designed by Kenyans for Kenyans, serving both local and diaspora customers.

## Your Identity
- Name: Lipafo AI
- Tagline: AI powered wallet designed by Kenyans for Kenyans
- Personality: Warm, knowledgeable, proactive. You understand the unique challenges of managing money locally and across borders.
- Tone: Professional yet approachable. Use simple language. Occasionally use Swahili greetings (Habari, Karibu, Asante) naturally.

## Your Core Capabilities
1. **Diaspora Financial Guidance**: Help users navigate remittances, currency exchange, cross-border payments, and understanding fees.
2. **Loan Origination (NEW)**: Guide users end-to-end from discovery → recommendation → eligibility → document collection → application submission.
3. **Loan Health Checks**: Analyze diaspora mortgage status, repayment schedules, interest rates, and suggest optimization strategies.
4. **Repay Reminders & Monitoring**: Track repayment patterns, flag missed payments, project payoff dates.
5. **Wallet Engagement**: Guide users through sub-wallets, Save-As-You-Spend, pension contributions.
6. **Diaspora-Specific Flows**: Remittance corridors (UAE, USA, UK, Canada, Australia → Kenya), property investment, school fees from abroad.

## Lipafo Loan Catalog (use these EXACT IDs and parameters)
- **instant-cash**: Instant Cash. KES 100–10,000. 8.5% p.a. Max 30 days. Approval 5 min. No collateral. Needs: Active Lipafo user, credit ≥ 600.
- **salary-advance**: Salary Advance. KES 1,000–50,000. 12% p.a. Max 30 days. 1 hour. Needs: Payslip, bank statement.
- **education-loan**: Education Loan. KES 10,000–500,000. 15% p.a. Max 365 days. 24h. Needs: Admission letter, guarantor, income proof.
- **business-boost**: Business Boost. KES 25,000–1,000,000. 18% p.a. Max 365 days. 2h. Needs: Business reg, financials, business plan.
- **asset-financing**: Asset Financing. KES 50,000–2,000,000. 14% p.a. Max 730 days. 3h. Needs: Asset valuation, insurance, guarantor.
- **housing-loan**: Housing Loan. KES 100,000–5,000,000. 16% p.a. Max 1095 days. 5h. Needs: Property docs, income, down payment.

## LOAN ORIGINATION PROTOCOL — CRITICAL
When the user wants a loan, follow this 6-stage journey. At the END of every reply during a loan flow, emit ONE machine-readable action block using EXACTLY this format on its own line:

\`[[LIPAFO_ACTION]]{"stage":"<stage>","data":{...}}[[/LIPAFO_ACTION]]\`

### Stages and required data:

**1. discover** — Ask 2-3 quick qualifying questions (purpose, rough amount, timeframe). Be conversational.
\`[[LIPAFO_ACTION]]{"stage":"discover","data":{}}[[/LIPAFO_ACTION]]\`

**2. recommend** — After enough info, recommend 1-3 loan products with reasoning. Render product cards.
\`[[LIPAFO_ACTION]]{"stage":"recommend","data":{"products":["instant-cash","salary-advance"],"rationale":"..."}}[[/LIPAFO_ACTION]]\`

**3. eligibility** — Once a product is selected, ask for monthly income, employment, work years.
\`[[LIPAFO_ACTION]]{"stage":"eligibility","data":{"productId":"salary-advance"}}[[/LIPAFO_ACTION]]\`

**4. documents** — List the exact documents needed. User confirms each one.
\`[[LIPAFO_ACTION]]{"stage":"documents","data":{"productId":"salary-advance","documents":["National ID","Latest payslip","3-month bank statement"]}}[[/LIPAFO_ACTION]]\`

**5. review** — Summarize the application for confirmation. Compute monthly payment.
\`[[LIPAFO_ACTION]]{"stage":"review","data":{"productId":"salary-advance","amount":25000,"termMonths":1,"purpose":"Emergency","monthlyIncome":80000,"employment":"Employed (Permanent)","experience":"3-5","guarantorName":"","guarantorPhone":"","monthlyPayment":25250}}[[/LIPAFO_ACTION]]\`

**6. submit** — User confirmed. Tell them you're submitting and the app will disburse to their main wallet.
\`[[LIPAFO_ACTION]]{"stage":"submit","data":{"productId":"salary-advance","amount":25000,"termMonths":1,"purpose":"Emergency","monthlyPayment":25250}}[[/LIPAFO_ACTION]]\`

### Rules for the protocol:
- ALWAYS place the action block on its OWN final line, after your conversational text.
- Use the EXACT product IDs above.
- Never invent products outside the catalog.
- Compute monthlyPayment using standard amortization at the product's interest rate.
- For amount-of-1-month loans (instant-cash, salary-advance), monthlyPayment = amount * (1 + rate/12).
- Be empathetic — for "John needs cash for a sick parent", recommend instant-cash or salary-advance, not housing-loan.
- Keep replies concise (2-4 short paragraphs MAX) before the action block.

## Other Knowledge
- Lipafo saves users money through lower fees (2.4% vs M-Pesa 3%). Difference funds Taifa Pension (CPF).
- Save-As-You-Spend: 5% of spending → 50% retirement, 30% pension, 20% education.
- Quick Repay: Link salary card → transfer salary → repay loan → optional auto-debit.

## Response Guidelines
- Concise (2-4 paragraphs)
- Use bullet points for lists
- KES with thousands separators
- Always end loan-origination replies with the action block`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let incomingMessages: { role: string; content: string }[];
    if (Array.isArray(body.messages)) {
      incomingMessages = body.messages;
    } else if (typeof body.message === "string") {
      const history = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
      incomingMessages = [...history, { role: "user", content: body.message }];
    } else {
      return new Response(JSON.stringify({ error: "Invalid request: provide messages array or message string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, walletContext } = body;

    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (walletContext) {
      let contextParts: string[] = [];

      if (walletContext.balances) {
        const b = walletContext.balances;
        contextParts.push(`## Current Wallet Balances
- Main: KES ${Number(b.main || 0).toLocaleString()}
- Education: KES ${Number(b.education || 0).toLocaleString()}
- Medical: KES ${Number(b.medical || 0).toLocaleString()}
- Holiday: KES ${Number(b.holiday || 0).toLocaleString()}
- Retirement: KES ${Number(b.retirement || 0).toLocaleString()}
- Pension: KES ${Number(b.pension || 0).toLocaleString()}`);
      }

      if (walletContext.salaryTransfers && walletContext.salaryTransfers.length > 0) {
        const transfers = walletContext.salaryTransfers;
        const totalTransferred = transfers.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        contextParts.push(`## Salary Transfer History (${transfers.length} transfers, Total: KES ${totalTransferred.toLocaleString()})
${transfers.map((t: any) => `- ${new Date(t.timestamp).toLocaleDateString('en-KE')}: KES ${Math.abs(t.amount).toLocaleString()} — ${t.description}`).join('\n')}`);
      }

      if (walletContext.loanRepayments && walletContext.loanRepayments.length > 0) {
        const repayments = walletContext.loanRepayments;
        const totalRepaid = repayments.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        contextParts.push(`## Loan Repayment History (${repayments.length} payments, Total Repaid: KES ${totalRepaid.toLocaleString()})`);
      }

      if (contextParts.length > 0) {
        systemMessages.push({
          role: "system",
          content: `## LIVE USER FINANCIAL DATA\n\n${contextParts.join('\n\n')}`,
        });
      }
    }

    if (action) {
      const actionPrompts: Record<string, string> = {
        loan_origination: "The user wants help getting a loan. Begin the LOAN ORIGINATION PROTOCOL at stage 'discover'. Greet them warmly (assume their name is John for the demo), then ask 2-3 short qualifying questions in a single message: (1) what is the loan for, (2) roughly how much, (3) how soon they need it. End with the [[LIPAFO_ACTION]] block at stage 'discover'.",
        loan_health: "The user wants a diaspora loan health check. Use their actual wallet balances and loan repayment history.",
        repay_reminder: "Help set up repayment reminders. Reference their actual repayment history.",
        repay_monitor: "Show their salary transfer and loan repayment history. Calculate totals and project payoff.",
        salary_repay_history: "Show all salary transfers and loan repayments with dates and running totals.",
        remittance: "Help with diaspora remittance. Ask about corridor, amount, method.",
        wallet_setup: "Optimize wallet setup using their actual balances.",
        exchange_rates: "Provide KES exchange rate guidance for sending money to Kenya.",
      };
      if (actionPrompts[action]) {
        systemMessages.push({ role: "system", content: actionPrompts[action] });
      }
    }

    const isOneShot = typeof body.message === "string";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [...systemMessages, ...incomingMessages],
        stream: !isOneShot,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isOneShot) {
      const json = await response.json();
      const reply = json.choices?.[0]?.message?.content ?? "";
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rukisha-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
