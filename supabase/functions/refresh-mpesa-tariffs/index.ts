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
  "https://www.safaricom.co.ke/main-mpesa-resources/m-pesa-global/tariffs";

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
    let parsed: { rows?: Array<Omit<TariffRow, "corridor_code"> & { country_name: string }> } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      await logRun("failed", `AI returned non-JSON: ${content.slice(0, 300)}`);
      return new Response(JSON.stringify({ error: "AI returned non-JSON", content }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawRows = parsed.rows ?? [];
    if (rawRows.length === 0) {
      await logRun("failed", "AI extracted zero rows");
      return new Response(JSON.stringify({ error: "No tariff rows extracted" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Normalize + insert
    const snapshot = new Date().toISOString();
    const toInsert: TariffRow[] = rawRows
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

    if (toInsert.length === 0) {
      await logRun("failed", "All extracted rows failed validation");
      return new Response(JSON.stringify({ error: "All extracted rows invalid" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await adminClient
      .from("mpesa_global_tariffs")
      .insert(toInsert.map((r) => ({
        ...r,
        snapshot_at: snapshot,
        source_url: SAFARICOM_TARIFF_URL,
      })));
    if (insertErr) {
      await logRun("failed", `DB insert: ${insertErr.message}`);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logRun("success", `Imported ${toInsert.length} tariff rows`, toInsert.length);
    return new Response(
      JSON.stringify({ success: true, rowsImported: toInsert.length, snapshot_at: snapshot }),
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
