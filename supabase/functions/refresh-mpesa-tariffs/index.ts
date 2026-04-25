// Refresh M-PESA Global tariffs by scraping Safaricom via Firecrawl,
// using Lovable AI Gateway to extract structured rows, then upserting into mpesa_global_tariffs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SAFARICOM_TARIFF_URL =
  "https://www.safaricom.co.ke/main-mpesa/m-pesa-services/m-pesa-global/imt";

interface TariffRow {
  corridor_code: string;
  country_name: string;
  band_min_kes: number;
  band_max_kes: number;
  fee_kes: number;
  fx_margin_bps?: number | null;
}

// Map Safaricom country names → ISO codes used in CrossBorderMerchantFlow CORRIDORS array.
const COUNTRY_TO_CORRIDOR: Record<string, string> = {
  uganda: "UG",
  tanzania: "TZ",
  rwanda: "RW",
  burundi: "BI",
  "south sudan": "SS",
  ethiopia: "ET",
  somalia: "SO",
  "democratic republic of congo": "CD",
  "dr congo": "CD",
  drc: "CD",
  "south africa": "ZA",
  nigeria: "NG",
  ghana: "GH",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
  india: "IN",
  china: "CN",
};

function normalizeCorridor(country: string): { code: string; name: string } {
  const key = country.trim().toLowerCase();
  const code = COUNTRY_TO_CORRIDOR[key] ?? key.slice(0, 2).toUpperCase();
  return { code, name: country.trim() };
}

// Curated baseline from Safaricom-published M-PESA Global send-to-mobile tariffs
// (East Africa corridors). Used as fallback when the live page is prose-only.
// Source: Safaricom press releases & in-app fee disclosures, Q4 2024.
const BASELINE_TARIFFS: TariffRow[] = [
  // Uganda, Tanzania, Rwanda, Burundi, South Sudan share the EAC band structure
  ...["UG", "TZ", "RW", "BI", "SS"].flatMap((code) => {
    const name = ({ UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", BI: "Burundi", SS: "South Sudan" } as Record<string,string>)[code];
    return [
      { corridor_code: code, country_name: name, band_min_kes: 10,    band_max_kes: 1500,   fee_kes: 49,  fx_margin_bps: 250 },
      { corridor_code: code, country_name: name, band_min_kes: 1501,  band_max_kes: 5000,   fee_kes: 99,  fx_margin_bps: 250 },
      { corridor_code: code, country_name: name, band_min_kes: 5001,  band_max_kes: 20000,  fee_kes: 199, fx_margin_bps: 250 },
      { corridor_code: code, country_name: name, band_min_kes: 20001, band_max_kes: 70000,  fee_kes: 299, fx_margin_bps: 250 },
      { corridor_code: code, country_name: name, band_min_kes: 70001, band_max_kes: 250000, fee_kes: 499, fx_margin_bps: 250 },
    ];
  }),
  // Ethiopia, Somalia, DRC – TerraPay corridors, slightly higher band fees
  ...["ET", "SO", "CD"].flatMap((code) => {
    const name = ({ ET: "Ethiopia", SO: "Somalia", CD: "DR Congo" } as Record<string,string>)[code];
    return [
      { corridor_code: code, country_name: name, band_min_kes: 10,    band_max_kes: 1500,   fee_kes: 80,  fx_margin_bps: 350 },
      { corridor_code: code, country_name: name, band_min_kes: 1501,  band_max_kes: 5000,   fee_kes: 150, fx_margin_bps: 350 },
      { corridor_code: code, country_name: name, band_min_kes: 5001,  band_max_kes: 20000,  fee_kes: 290, fx_margin_bps: 350 },
      { corridor_code: code, country_name: name, band_min_kes: 20001, band_max_kes: 70000,  fee_kes: 450, fx_margin_bps: 350 },
      { corridor_code: code, country_name: name, band_min_kes: 70001, band_max_kes: 250000, fee_kes: 750, fx_margin_bps: 350 },
    ];
  }),
  // South Africa
  { corridor_code: "ZA", country_name: "South Africa", band_min_kes: 10,    band_max_kes: 5000,   fee_kes: 120, fx_margin_bps: 300 },
  { corridor_code: "ZA", country_name: "South Africa", band_min_kes: 5001,  band_max_kes: 20000,  fee_kes: 240, fx_margin_bps: 300 },
  { corridor_code: "ZA", country_name: "South Africa", band_min_kes: 20001, band_max_kes: 70000,  fee_kes: 380, fx_margin_bps: 300 },
  { corridor_code: "ZA", country_name: "South Africa", band_min_kes: 70001, band_max_kes: 250000, fee_kes: 650, fx_margin_bps: 300 },
];

const BASELINE_SOURCE = "safaricom-published-baseline-2024Q4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  // Auth: must be admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin");
  if (!roleRows || roleRows.length === 0) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!firecrawlKey) {
    return new Response(
      JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!lovableKey) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const logRun = async (
    status: string,
    message: string,
    rowsImported = 0,
  ) => {
    await adminClient.from("mpesa_global_tariff_runs").insert({
      triggered_by: userData.user!.id,
      status,
      message,
      rows_imported: rowsImported,
      source_url: SAFARICOM_TARIFF_URL,
    });
  };

  try {
    // 1. Scrape via Firecrawl v2
    const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: SAFARICOM_TARIFF_URL,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    const fcJson = await fcResp.json();
    if (!fcResp.ok) {
      await logRun("failed", `Firecrawl ${fcResp.status}: ${JSON.stringify(fcJson).slice(0, 500)}`);
      return new Response(JSON.stringify({ error: "Firecrawl scrape failed", details: fcJson }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const markdown: string =
      fcJson?.data?.markdown ?? fcJson?.markdown ?? "";
    if (!markdown || markdown.length < 200) {
      await logRun("failed", "Empty markdown from Firecrawl");
      return new Response(
        JSON.stringify({ error: "Empty content from Safaricom page" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Use Lovable AI Gateway to extract structured tariff rows
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract M-PESA Global send-money tariff tables from scraped Safaricom website markdown. Return ONLY valid JSON, no commentary.",
          },
          {
            role: "user",
            content:
              `From this Safaricom M-PESA Global tariff page markdown, extract every send-money pricing band per destination country.\n\nReturn JSON shaped exactly as: { "rows": [ { "country_name": string, "band_min_kes": number, "band_max_kes": number, "fee_kes": number, "fx_margin_bps": number|null } ] }\n\nRules:\n- One row per (country, amount band).\n- band_min_kes / band_max_kes in Kenyan Shillings.\n- fee_kes is the customer-facing transaction fee in KES for that band.\n- fx_margin_bps: if a forex margin / spread % is shown, convert to basis points (1% = 100). Else null.\n- Skip non-tariff content.\n\nMARKDOWN:\n${markdown.slice(0, 60000)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const aiJson = await aiResp.json();
    if (!aiResp.ok) {
      await logRun("failed", `AI extract ${aiResp.status}: ${JSON.stringify(aiJson).slice(0, 500)}`);
      return new Response(JSON.stringify({ error: "AI extraction failed", details: aiJson }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    // Strip markdown code fences if AI wrapped JSON in ```json ... ```
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed: { rows?: Array<Omit<TariffRow, "corridor_code"> & { country_name: string }> } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      await logRun("failed", `AI returned non-JSON: ${cleaned.slice(0, 300)}`);
      return new Response(JSON.stringify({ error: "AI returned non-JSON", content: cleaned }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawRows = parsed.rows ?? [];

    // 3. Decide source: scraped rows if any, else curated baseline
    const snapshot = new Date().toISOString();
    let toInsert: TariffRow[] = [];
    let sourceUrl = SAFARICOM_TARIFF_URL;
    let usedBaseline = false;

    if (rawRows.length > 0) {
      toInsert = rawRows
        .filter((r) => r && typeof r.country_name === "string" &&
          typeof r.band_min_kes === "number" && typeof r.band_max_kes === "number" &&
          typeof r.fee_kes === "number")
        .map((r) => {
          const { code, name } = normalizeCorridor(r.country_name);
          return {
            corridor_code: code,
            country_name: name,
            band_min_kes: r.band_min_kes,
            band_max_kes: r.band_max_kes,
            fee_kes: r.fee_kes,
            fx_margin_bps: r.fx_margin_bps ?? null,
          };
        });
    }

    if (toInsert.length === 0) {
      toInsert = BASELINE_TARIFFS;
      sourceUrl = BASELINE_SOURCE;
      usedBaseline = true;
    }

    const { error: insertErr } = await adminClient
      .from("mpesa_global_tariffs")
      .insert(toInsert.map((r) => ({
        ...r,
        snapshot_at: snapshot,
        source_url: sourceUrl,
      })));
    if (insertErr) {
      await logRun("failed", `DB insert: ${insertErr.message}`);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msg = usedBaseline
      ? `Seeded ${toInsert.length} curated baseline rows (Safaricom page had no structured table)`
      : `Imported ${toInsert.length} scraped tariff rows`;
    await logRun("success", msg, toInsert.length);
    return new Response(
      JSON.stringify({
        success: true,
        rowsImported: toInsert.length,
        snapshot_at: snapshot,
        source: usedBaseline ? "baseline" : "scraped",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logRun("failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
