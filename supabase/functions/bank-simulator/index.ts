// Lipafo Bank Simulator
// Stand-in for a participating bank's pacs.008 receiver during the controlled pilot.
// Verifies HMAC signature, simulates configurable latency / failure, returns pacs.002.
//
// Headers expected from Lipafo switch:
//   X-Lipafo-Signature: HMAC-SHA256 hex of raw body using shared secret
//   X-Lipafo-Bank-Code: e.g. "KCB"
//   X-Lipafo-Trace-Id:  trace correlation id

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lipafo-signature, x-lipafo-bank-code, x-lipafo-trace-id",
};

// Shared HMAC secret used for the pilot. In production each bank has its own.
const SHARED_SECRET = Deno.env.get("BANK_SIM_HMAC_SECRET") ?? "lipafo-pilot-shared-secret";

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("x-lipafo-signature") ?? "";
    const bankCode = req.headers.get("x-lipafo-bank-code") ?? "UNKNOWN";
    const traceId = req.headers.get("x-lipafo-trace-id") ?? newId();

    // Verify HMAC
    const expected = await hmacSha256Hex(SHARED_SECRET, rawBody);
    if (sigHeader !== expected) {
      return new Response(JSON.stringify({
        message_type: "pacs.002",
        status: "RJCT",
        reason_code: "AM05",
        reason: "signature_invalid",
        trace_id: traceId,
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let payload: any = {};
    try { payload = JSON.parse(rawBody); } catch { /* ignore */ }

    // Simulator behaviour controls (sent inline by caller for the pilot)
    // amount > 9_999_999 → reject, special amounts trigger specific outcomes
    const amount = Number(payload?.amount ?? 0);
    const simLatency = Math.round(40 + Math.random() * 120); // 40–160ms
    await new Promise((r) => setTimeout(r, simLatency));

    let status = "ACSC"; // accepted, settlement complete
    let reason_code: string | null = null;
    let reason: string | null = null;

    if (amount > 9_999_999) {
      status = "RJCT"; reason_code = "AM04"; reason = "insufficient_funds";
    } else if (amount % 1000 === 13) {
      // deterministic failure injection: any amount ending in 013
      status = "RJCT"; reason_code = "BE05"; reason = "unknown_creditor";
    } else if (amount % 1000 === 17) {
      // simulate timeout
      await new Promise((r) => setTimeout(r, 6000));
    }

    return new Response(JSON.stringify({
      message_type: "pacs.002",
      status,
      reason_code,
      reason,
      bank_code: bankCode,
      trace_id: traceId,
      simulated_latency_ms: simLatency,
      bank_reference: `${bankCode}-${newId()}`,
    }), { status: status === "ACSC" ? 200 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
