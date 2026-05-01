// Generate synthetic load through switch-process-intent so the admin console has data.
// Also lets you flip a bank circuit to OPEN to demo failure handling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BANKS = ["KCB", "EQUITY", "COOP", "NCBA", "STANBIC", "FAMILY", "ABSA", "IM"];
const PAYEES = ["NAIVAS-001", "KPLC-MAIN", "JAVA-WST", "CARREFOUR-LAV", "QUICKMART-KAREN"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { count = 30, open_circuit } = await req.json().catch(() => ({}));

    if (open_circuit) {
      await supabase.from("bank_connectors").update({
        circuit_state: "OPEN", opened_at: new Date().toISOString(),
        last_failure_at: new Date().toISOString(), failure_count: 5,
      }).eq("bank_code", open_circuit);
      return new Response(JSON.stringify({ ok: true, opened: open_circuit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/switch-process-intent`;
    const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    // Build all request bodies up-front
    const jobs = Array.from({ length: count }, (_, i) => {
      const bank = BANKS[Math.floor(Math.random() * BANKS.length)];
      const payee = PAYEES[Math.floor(Math.random() * PAYEES.length)];
      const amount = Math.round(100 + Math.random() * 25000);
      return {
        idempotency_key: `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        payer_identifier: `MSISDN+2547${Math.floor(10000000 + Math.random() * 89999999)}`,
        payee_identifier: payee,
        payee_bank: bank,
        amount, currency: "KES", rail: "bank_rail",
      };
    });

    // Bounded-concurrency worker pool (CONCURRENCY in flight at any time).
    // Prevents the seeder from exceeding the edge runtime wall-clock limit
    // when many requests are slow (e.g. circuit-open fail-fast bursts).
    const CONCURRENCY = 10;
    const PER_REQUEST_TIMEOUT_MS = 8000;
    const results: { status: number }[] = new Array(jobs.length);
    let cursor = 0;

    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= jobs.length) return;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS);
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify(jobs[idx]),
            signal: ctrl.signal,
          });
          // Drain body to free the connection
          await r.text().catch(() => {});
          results[idx] = { status: r.status };
        } catch (_e) {
          results[idx] = { status: 0 }; // timeout / network error
        } finally {
          clearTimeout(t);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

    return new Response(JSON.stringify({
      ok: true, generated: count,
      success: results.filter((r) => r?.status === 200).length,
      circuit_blocked: results.filter((r) => r?.status === 503).length,
      server_errors: results.filter((r) => r?.status >= 500 && r?.status !== 503).length,
      timed_out: results.filter((r) => r?.status === 0).length,
      concurrency: 10,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
