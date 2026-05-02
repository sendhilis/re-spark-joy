// Settlement Agent loop — three actions for the KCB-as-Agent pilot:
//   action: "generate"  -> from today's settlement_positions, build instructions (debtor=Lipafo-on-behalf, creditor=member bank)
//                          checks member_collateral.available_balance and earmarks utilised_amount
//   action: "dispatch"  -> mark generated instructions as dispatched (simulates pacs.009 send to KCB)
//   action: "confirm"   -> simulate KCB confirmation: insert settlement_confirmations + flip instruction status,
//                          release collateral utilisation and credit beneficiary collateral.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action } = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    const { data: agent, error: agentErr } = await supabase
      .from("settlement_agents").select("*").eq("agent_code", "KCB_KE_AGENT").single();
    if (agentErr || !agent) throw new Error("KCB settlement agent not configured");

    if (action === "generate") {
      // Sweep ALL open pending net positions across cycles — an EOD run should
      // never strand backlog from earlier dates that haven't yet been settled.
      const { data: positions } = await supabase
        .from("settlement_positions").select("*")
        .eq("status", "pending")
        .order("position_date", { ascending: true });

      if (!positions?.length) {
        return json({ ok: true, message: "No pending positions to settle", generated: 0 });
      }

      // Load collateral for liquidity check (debtor side = Lipafo's pooled position via member banks owing)
      const { data: collat } = await supabase.from("member_collateral").select("*");
      const colByBank = new Map(collat?.map((c) => [c.member_bank, c]) ?? []);

      const instructions: any[] = [];
      const skipped: any[] = [];
      let seq = 1;

      for (const p of positions) {
        const net = Number(p.net_position);
        if (net === 0) continue;

        // For pilot: every leg routes through KCB. Debtor = bank with negative balance from Lipafo's perspective,
        // Creditor = bank that needs to receive. Lipafo earmarks against the DEBTOR's collateral.
        const debtor = net < 0 ? "LIPAFO_POOL" : p.participating_bank;
        const creditor = net < 0 ? p.participating_bank : "LIPAFO_POOL";
        const amount = Math.abs(net);

        // Liquidity check on debtor collateral (skip if debtor is LIPAFO_POOL — pilot assumption: Lipafo pre-funded)
        if (debtor !== "LIPAFO_POOL") {
          const c = colByBank.get(debtor);
          if (!c || Number(c.available_balance) < amount) {
            skipped.push({ bank: debtor, reason: "insufficient collateral", required: amount, available: c?.available_balance ?? 0 });
            continue;
          }
          // Earmark
          await supabase.from("member_collateral")
            .update({ utilised_amount: Number(c.utilised_amount) + amount })
            .eq("id", c.id);
          c.utilised_amount = Number(c.utilised_amount) + amount;
        }

        const cycleDate: string = (p.position_date as string).slice(0, 10);
        const ref = `LPF-INSTR-${cycleDate.replace(/-/g, "")}-${String(seq++).padStart(4, "0")}`;
        instructions.push({
          instruction_ref: ref,
          cycle_date: cycleDate,
          agent_id: agent.id,
          debtor_bank: debtor,
          creditor_bank: creditor,
          amount,
          currency: "KES",
          message_type: "pacs.009",
          payload: {
            MsgId: ref,
            CreDtTm: new Date().toISOString(),
            SttlmMtd: "CLRG",
            ClrSys: "LIPAFO",
            Agent: agent.agent_code,
            DbtrAgt: debtor,
            CdtrAgt: creditor,
            IntrBkSttlmAmt: { Ccy: "KES", Amt: amount },
            position_id: p.id,
          },
          status: "generated",
        });
      }

      if (instructions.length > 0) {
        await supabase.from("settlement_instructions").insert(instructions);
      }
      return json({ ok: true, generated: instructions.length, skipped, agent: agent.agent_name });
    }

    if (action === "dispatch") {
      // Dispatch all generated instructions (any cycle) for the pilot demo
      const { data: pending } = await supabase
        .from("settlement_instructions").select("id")
        .eq("status", "generated");
      if (!pending?.length) return json({ ok: true, dispatched: 0 });
      await supabase.from("settlement_instructions")
        .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
        .in("id", pending.map((i) => i.id));
      return json({ ok: true, dispatched: pending.length });
    }

    if (action === "confirm") {
      // For demo robustness: auto-dispatch any still-generated instructions first
      const { data: stillGenerated } = await supabase
        .from("settlement_instructions").select("id")
        .eq("status", "generated");
      if (stillGenerated?.length) {
        await supabase.from("settlement_instructions")
          .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
          .in("id", stillGenerated.map((i) => i.id));
      }

      // Simulate KCB confirming all dispatched legs (any cycle)
      const { data: dispatched } = await supabase
        .from("settlement_instructions").select("*")
        .eq("status", "dispatched");
      if (!dispatched?.length) return json({ ok: true, confirmed: 0 });

      const { data: collat } = await supabase.from("member_collateral").select("*");
      const colByBank = new Map(collat?.map((c) => [c.member_bank, c]) ?? []);
      const confs: any[] = [];

      // Realistic agent-side outcome distribution (cumulative thresholds)
      // settled 88% | rejected 5% | failed_insufficient_funds 4% | pending_late 3%
      const pickOutcome = (): "settled" | "rejected" | "failed_insufficient_funds" | "pending_late" => {
        const r = Math.random();
        if (r < 0.88) return "settled";
        if (r < 0.93) return "rejected";
        if (r < 0.97) return "failed_insufficient_funds";
        return "pending_late";
      };

      const rejectionReasons = [
        "AC03 - Invalid creditor account",
        "AG01 - Transaction forbidden on this account",
        "RC01 - Bank identifier (BIC) incorrect",
        "DUPL - Duplicate MsgId detected",
        "FF01 - Invalid file format (pacs.009)",
      ];

      const tally = { settled: 0, rejected: 0, failed_insufficient_funds: 0, pending_late: 0 };
      const settledPositionIds: string[] = [];

      for (const ins of dispatched) {
        const outcome = pickOutcome();
        tally[outcome]++;

        const agentRef = `KCB-CONF-${ins.instruction_ref.split("-").pop()}-${Math.floor(Math.random() * 9999)}`;
        const amount = Number(ins.amount);

        const conf: any = {
          instruction_id: ins.id,
          agent_reference: agentRef,
          outcome,
          settled_amount: outcome === "settled" ? amount : null,
          raw_payload: {
            ConfRef: agentRef,
            OrgnlMsgId: ins.instruction_ref,
            SttlmDt: new Date().toISOString(),
            outcome,
          },
        };

        let newInstructionStatus = "confirmed";
        let rejectionReason: string | null = null;

        if (outcome === "settled") {
          // Cash actually moved: debit debtor collateral, credit creditor collateral, release earmark
          if (ins.debtor_bank !== "LIPAFO_POOL") {
            const c = colByBank.get(ins.debtor_bank);
            if (c) {
              const newUtil = Math.max(0, Number(c.utilised_amount) - amount);
              const newPosted = Number(c.posted_balance) - amount;
              await supabase.from("member_collateral").update({
                utilised_amount: newUtil,
                posted_balance: newPosted,
              }).eq("id", c.id);
              c.utilised_amount = newUtil;
              c.posted_balance = newPosted;
            }
          }
          if (ins.creditor_bank !== "LIPAFO_POOL") {
            const c = colByBank.get(ins.creditor_bank);
            if (c) {
              const newPosted = Number(c.posted_balance) + amount;
              await supabase.from("member_collateral").update({ posted_balance: newPosted }).eq("id", c.id);
              c.posted_balance = newPosted;
            }
          }
          if (ins.payload?.position_id) settledPositionIds.push(ins.payload.position_id);
        } else if (outcome === "rejected" || outcome === "failed_insufficient_funds") {
          // No cash moves. Release the earmark so debtor's available_balance is restored.
          newInstructionStatus = "rejected";
          rejectionReason = outcome === "rejected"
            ? rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)]
            : "AM04 - Insufficient funds at agent";
          conf.reason = rejectionReason;
          conf.raw_payload.RjctRsn = rejectionReason;
          if (ins.debtor_bank !== "LIPAFO_POOL") {
            const c = colByBank.get(ins.debtor_bank);
            if (c) {
              const newUtil = Math.max(0, Number(c.utilised_amount) - amount);
              await supabase.from("member_collateral").update({ utilised_amount: newUtil }).eq("id", c.id);
              c.utilised_amount = newUtil;
            }
          }
        } else {
          // pending_late: agent acknowledged but hasn't booked. Keep earmark; instruction stays dispatched.
          newInstructionStatus = "dispatched";
          conf.reason = "Acknowledged - awaiting next RTGS window";
          conf.raw_payload.Status = "ACWP"; // AcceptedWithoutPosting
        }

        const updates: Record<string, unknown> = {
          status: newInstructionStatus,
          agent_reference: agentRef,
        };
        if (newInstructionStatus === "confirmed") updates.confirmed_at = new Date().toISOString();
        if (rejectionReason) updates.rejection_reason = rejectionReason;
        await supabase.from("settlement_instructions").update(updates).eq("id", ins.id);

        confs.push(conf);
      }

      if (confs.length) await supabase.from("settlement_confirmations").insert(confs);

      // Only positions whose instruction actually settled flip to settled
      if (settledPositionIds.length) {
        await supabase.from("settlement_positions")
          .update({ status: "settled" }).in("id", settledPositionIds);
      }

      return json({ ok: true, processed: confs.length, breakdown: tally, agent: agent.agent_name });
    }

    if (action === "topup") {
      const { member_bank, amount } = await req.clone().json();
      const { data: c } = await supabase.from("member_collateral")
        .select("*").eq("member_bank", member_bank).single();
      if (!c) throw new Error("Member not found");
      await supabase.from("member_collateral").update({
        posted_balance: Number(c.posted_balance) + Number(amount),
        last_topup_at: new Date().toISOString(),
      }).eq("id", c.id);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
