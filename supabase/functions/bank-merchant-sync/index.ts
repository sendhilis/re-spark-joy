// Webhook for participating banks to push their merchant list into Lipafo.
// Auth: header `x-bank-sync-key: <participating_banks.sync_api_key>`.
// Body: { merchants: [{ merchant_name, category, paybill_number, till_number? }] }
// Never accepts MSISDN/contact_phone — confidential bank data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bank-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IncomingMerchant = {
  merchant_name: string;
  category?: string;
  paybill_number: string;
  till_number?: string | null;
  status?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const apiKey = req.headers.get("x-bank-sync-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-bank-sync-key header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: bank, error: bankErr } = await supabase
    .from("participating_banks")
    .select("id, bank_name")
    .eq("sync_api_key", apiKey)
    .maybeSingle();

  if (bankErr || !bank) {
    return new Response(JSON.stringify({ error: "Invalid sync key" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { merchants?: IncomingMerchant[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const list = Array.isArray(body.merchants) ? body.merchants : [];
  if (list.length === 0) {
    return new Response(JSON.stringify({ error: "merchants[] required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const rows = list
    .filter((m) => m && m.merchant_name && m.paybill_number)
    .map((m) => ({
      bank_id: bank.id,
      merchant_name: String(m.merchant_name).trim(),
      category: (m.category || "retail").toString().toLowerCase(),
      paybill_number: String(m.paybill_number).trim(),
      till_number: m.till_number ? String(m.till_number).trim() : null,
      status: m.status || "active",
      synced_at: new Date().toISOString(),
    }));

  let inserted = 0, updated = 0;
  let errMsg: string | null = null;

  try {
    // Upsert by (bank_id, paybill_number, till_number)
    const { data: upserted, error } = await supabase
      .from("bank_merchants")
      .upsert(rows, { onConflict: "bank_id,paybill_number,till_number", ignoreDuplicates: false })
      .select("id, created_at, updated_at");
    if (error) throw error;
    for (const r of upserted ?? []) {
      if (r.created_at === r.updated_at) inserted++; else updated++;
    }
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await supabase.from("bank_merchant_sync_logs").insert({
    bank_id: bank.id,
    received_count: list.length,
    inserted_count: inserted,
    updated_count: updated,
    status: errMsg ? "error" : "success",
    error_message: errMsg,
    source_ip: req.headers.get("x-forwarded-for"),
  });

  if (!errMsg) {
    await supabase.from("participating_banks")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", bank.id);
  }

  return new Response(
    JSON.stringify({
      bank: bank.bank_name,
      received: list.length,
      inserted,
      updated,
      status: errMsg ? "error" : "success",
      error: errMsg,
    }),
    { status: errMsg ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
