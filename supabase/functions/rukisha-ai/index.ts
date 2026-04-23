import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lipafo AI — the intelligent financial assistant for Lipafo Wallet by Equity Bank, built specifically for Kenyan diaspora customers.

## Your Identity
- Name: Lipafo AI
- Personality: Warm, knowledgeable, proactive. You understand the unique challenges of managing money across borders.
- Tone: Professional yet approachable. Use simple language. Occasionally use Swahili greetings (Habari, Karibu, Asante) naturally.

## Your Core Capabilities
1. **Diaspora Financial Guidance**: Help users navigate remittances, currency exchange, cross-border payments, and understanding fees.
2. **Loan Health Checks**: Analyze diaspora mortgage status, repayment schedules, interest rates, and suggest optimization strategies.
3. **Repay Reminders**: Help users set up and manage loan repayment reminders. Be proactive about upcoming payments.
4. **Repay Monitoring**: Track repayment patterns, flag missed payments, calculate remaining balances, and project payoff dates.
5. **Wallet Engagement**: Guide users through wallet features — sub-wallets (education, medical, holiday, retirement), Save-As-You-Spend, pension contributions.
6. **Diaspora-Specific Flows**: Remittance corridors (UAE, USA, UK, Canada, Australia → Kenya), property investment guidance, school fees management from abroad.
7. **Salary Loan Repayment Tracking**: Track salary-to-wallet transfers and loan repayments from diaspora workers, especially UAE workers using the Quick Repay flow.

## Proactive Behaviors
- If a user hasn't checked their loan status recently, gently nudge them.
- Suggest setting up automatic repay reminders if they haven't.
- Recommend diversifying savings across sub-wallets.
- Alert about favorable exchange rates for remittances.
- Encourage pension contributions through the CPF fee savings program.
- When showing repayment history, format it clearly with dates, amounts, and running totals.

## Key Knowledge
- Lipafo saves users money through lower transaction fees (2.4% vs M-Pesa's 3%)
- The fee difference automatically funds the Taifa Pension (CPF program)
- Save-As-You-Spend automatically allocates 5% of spending: 50% retirement, 30% pension, 20% education
- Supported remittance corridors: UAE, USA, UK, Canada, Australia, Germany, South Africa
- Loan types: Diaspora Mortgage, Business Loan, Education Loan, Emergency Loan, Chama Loan
- Quick Repay Flow: Link salary card → Transfer salary to wallet → Repay loan from wallet → Optional auto-debit setup

## Response Guidelines
- Keep responses concise (2-4 paragraphs max)
- Use bullet points for lists
- Include specific numbers/calculations when discussing finances
- Always end with a helpful follow-up question or actionable suggestion
- Format currency as KES with thousands separators
- When discussing loans, always mention the interest rate and monthly payment
- When showing salary repayment history, use a clear table or list format with dates and amounts`;

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

    // Build system messages
    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

    // Inject live wallet & transaction context if provided
    if (walletContext) {
      let contextParts: string[] = [];

      if (walletContext.balances) {
        const b = walletContext.balances;
        contextParts.push(`## Current Wallet Balances
- Main Wallet: KES ${Number(b.main || 0).toLocaleString()}
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
${transfers.map((t: any) => `- ${new Date(t.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}: KES ${Math.abs(t.amount).toLocaleString()} — ${t.description}`).join('\n')}`);
      }

      if (walletContext.loanRepayments && walletContext.loanRepayments.length > 0) {
        const repayments = walletContext.loanRepayments;
        const totalRepaid = repayments.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        contextParts.push(`## Loan Repayment History (${repayments.length} payments, Total Repaid: KES ${totalRepaid.toLocaleString()})
${repayments.map((t: any) => `- ${new Date(t.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}: KES ${Math.abs(t.amount).toLocaleString()} — ${t.description}`).join('\n')}`);
      }

      if (walletContext.recentTransactions && walletContext.recentTransactions.length > 0) {
        const recent = walletContext.recentTransactions.slice(0, 10);
        contextParts.push(`## Recent Transactions (last ${recent.length})
${recent.map((t: any) => `- ${new Date(t.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}: ${t.type} KES ${Math.abs(t.amount).toLocaleString()} — ${t.description} [${t.status}]`).join('\n')}`);
      }

      if (contextParts.length > 0) {
        systemMessages.push({
          role: "system",
          content: `## LIVE USER FINANCIAL DATA (use this to give personalized, accurate responses)\n\n${contextParts.join('\n\n')}`,
        });
      }
    }
    
    if (action) {
      const actionPrompts: Record<string, string> = {
        "loan_health": "The user wants a diaspora loan health check. Use their actual wallet balances and loan repayment history to provide analysis. Show their repayment pattern, total repaid, and any concerns.",
        "repay_reminder": "The user wants to set up repayment reminders. Reference their actual repayment history and suggest optimal timing based on their salary transfer pattern.",
        "repay_monitor": "The user wants to monitor their loan repayments. Show their ACTUAL salary transfer and loan repayment history from the data provided. Calculate total transferred, total repaid, and highlight the repayment pattern. Project their payoff timeline if possible.",
        "salary_repay_history": "The user wants to see their salary loan repayment history. Show a clear summary of ALL salary transfers and loan repayments from the data. Include dates, amounts, and running totals. Highlight the Quick Repay flow steps they've completed.",
        "remittance": "The user wants help with a diaspora remittance. Ask about the corridor (which country they're sending from), amount, and preferred method. Compare fees and rates.",
        "wallet_setup": "The user wants help optimizing their wallet setup. Use their actual balances to guide them through the sub-wallet system and suggest improvements.",
        "exchange_rates": "The user wants current exchange rate information for KES. Provide guidance on the best times and methods to send money to Kenya.",
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
