// Resumable settlement run: processes COMPLETED events in batches from a checkpoint.
// Crash-safe: re-invoking continues from last_processed_event_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Find or open today's run
    let { data: run } = await supabase.from("settlement_runs")
      .select("*").eq("run_date", today).maybeSingle();

    if (!run) {
      const ins = await supabase.from("settlement_runs").insert({
        run_date: today, status: "running", started_at: new Date().toISOString(),
      }).select().single();
      run = ins.data!;
    } else if (run.status === "completed") {
      return new Response(JSON.stringify({ ok: true, message: "already completed", run }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("settlement_runs").update({
        status: "running", started_at: run.started_at ?? new Date().toISOString(),
      }).eq("id", run.id);
    }

    // Pull next batch of credit.confirmed events after the checkpoint
    const { data: events } = await supabase.from("switch_events")
      .select("id,intent_id,payload,created_at")
      .eq("event_type", "credit.confirmed")
      .gt("id", run.last_processed_event_id)
      .order("id", { ascending: true })
      .limit(BATCH);

    if (!events || events.length === 0) {
      await supabase.from("settlement_runs").update({
        status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      return new Response(JSON.stringify({ ok: true, message: "no new events; run completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate net positions per bank from intents tied to these events
    const intentIds = events.map((e: any) => e.intent_id).filter(Boolean);
    const { data: intents } = await supabase.from("transaction_intents")
      .select("id,payee_bank,amount").in("id", intentIds);

    const perBank = new Map<string, { volume: number; count: number }>();
    let totalVol = 0;
    for (const i of intents ?? []) {
      const bank = i.payee_bank ?? "INTERNAL";
      const cur = perBank.get(bank) ?? { volume: 0, count: 0 };
      cur.volume += Number(i.amount);
      cur.count += 1;
      perBank.set(bank, cur);
      totalVol += Number(i.amount);
    }

    // Insert per-bank settlement positions for today
    const positions = Array.from(perBank.entries()).map(([bank, v]) => ({
      position_date: today,
      participating_bank: bank,
      inbound_volume: v.volume,
      outbound_volume: 0,
      net_position: -v.volume, // Lipafo owes the bank for credits
      transaction_count: v.count,
      cutoff_at: new Date().toISOString(),
      status: "pending",
    }));
    if (positions.length > 0) await supabase.from("settlement_positions").insert(positions);

    const lastId = events[events.length - 1].id;
    await supabase.from("settlement_runs").update({
      last_processed_event_id: lastId,
      events_processed: run.events_processed + events.length,
      banks_settled: perBank.size,
      total_volume: Number(run.total_volume) + totalVol,
      status: events.length === BATCH ? "checkpointed" : "completed",
      checkpoint_at: new Date().toISOString(),
      completed_at: events.length === BATCH ? null : new Date().toISOString(),
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      ok: true, processed: events.length, last_event_id: lastId,
      banks: perBank.size, total_volume: totalVol,
      more: events.length === BATCH,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
