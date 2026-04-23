import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  MapPin, Search, Loader2, Navigation, Clock, 
  Star, CheckCircle, ArrowRight, ArrowDownToLine, 
  ArrowUpFromLine, Bot, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";

interface AgentDiscoveryFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "cash_in" | "cash_out" | "discover";
}

interface Agent {
  id: string;
  name: string;
  location: string;
  distance: string;
  phone: string;
  hours: string;
  rating: number;
  services: string[];
  float: string;
  status: "open" | "busy" | "closed";
}

const MOCK_AGENTS: Agent[] = [
  {
    id: "A001",
    name: "Mama Wanjiku Store",
    location: "Westlands, Nairobi",
    distance: "0.3 km",
    phone: "+254 722 001 234",
    hours: "7:00 AM – 9:00 PM",
    rating: 4.9,
    services: ["Cash In", "Cash Out", "Bill Pay"],
    float: "KES 85,000",
    status: "open",
  },
  {
    id: "A002",
    name: "Karibu Kiosk Agent",
    location: "Parklands, Nairobi",
    distance: "0.7 km",
    phone: "+254 733 556 789",
    hours: "8:00 AM – 8:00 PM",
    rating: 4.7,
    services: ["Cash In", "Cash Out"],
    float: "KES 42,000",
    status: "open",
  },
  {
    id: "A003",
    name: "Equity Bank Agent – ABC",
    location: "Ngara, Nairobi",
    distance: "1.2 km",
    phone: "+254 700 889 900",
    hours: "8:00 AM – 5:00 PM",
    rating: 4.5,
    services: ["Cash In", "Cash Out", "ATM"],
    float: "KES 150,000",
    status: "open",
  },
  {
    id: "A004",
    name: "Duka la Mwananchi",
    location: "Pangani, Nairobi",
    distance: "1.9 km",
    phone: "+254 711 234 567",
    hours: "6:30 AM – 10:00 PM",
    rating: 4.3,
    services: ["Cash In", "Cash Out"],
    float: "KES 28,000",
    status: "busy",
  },
];

const STEPS_CASH_IN = ["Select Agent", "Enter Details", "Confirm & Get Code", "Done"];
const STEPS_CASH_OUT = ["Select Agent", "Enter Amount", "Authenticate", "Done"];

export function AgentDiscoveryFlow({ open, onOpenChange, mode = "discover" }: AgentDiscoveryFlowProps) {
  const { toast } = useToast();
  const { addTransaction, balances } = useWallet();

  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [processing, setProcessing] = useState(false);
  const [aiGuide, setAiGuide] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [transactionCode, setTransactionCode] = useState("");
  const [currentMode, setCurrentMode] = useState<"cash_in" | "cash_out" | "discover">(mode);

  const filteredAgents = MOCK_AGENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase())
  );

  const fetchAIGuide = useCallback(async (agentName: string, txMode: string, txAmount?: string) => {
    setLoadingAI(true);
    try {
      const prompt = txAmount
        ? `You are Lipafo AI assistant. Give a short, friendly 2-sentence guide for a user who wants to ${txMode === "cash_in" ? "deposit cash" : "withdraw cash"} of KES ${txAmount} at "${agentName}" agent. Mention they should carry their national ID and the transaction code. Keep it under 40 words.`
        : `You are Lipafo AI assistant. In 2 sentences, tell a user what to expect when visiting "${agentName}" bank agent for ${txMode === "cash_in" ? "a cash deposit" : "a cash withdrawal"}. Be friendly and mention they need their ID. Under 35 words.`;

      const { data, error } = await supabase.functions.invoke("rukisha-ai", {
        body: { message: prompt, conversationHistory: [] },
      });

      if (!error && data?.reply) {
        setAiGuide(data.reply);
      } else {
        setAiGuide(
          txMode === "cash_in"
            ? `Head to ${agentName} with your national ID and cash. Tell the agent you want to deposit to your Lipafo wallet and share your transaction code.`
            : `Visit ${agentName} with your national ID and PIN. The agent will verify your identity before dispensing cash.`
        );
      }
    } catch {
      setAiGuide(
        currentMode === "cash_in"
          ? `Head to ${agentName} with your national ID and cash. Share your transaction code with the agent to complete the deposit.`
          : `Visit ${agentName} with your national ID. Authenticate with your PIN to complete the withdrawal.`
      );
    } finally {
      setLoadingAI(false);
    }
  }, [currentMode]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setSearch("");
      setSelectedAgent(null);
      setAmount("");
      setPin("");
      setAiGuide("");
      setTransactionCode("");
      setCurrentMode(mode);
    }
  }, [open, mode]);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setStep(1);
    fetchAIGuide(agent.name, currentMode);
  };

  const handleConfirmDetails = () => {
    if (!amount || parseFloat(amount) < 50) {
      toast({ title: "Invalid amount", description: "Minimum is KES 50", variant: "destructive" });
      return;
    }
    if (currentMode === "cash_in") {
      const code = `RUK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      setTransactionCode(code);
      fetchAIGuide(selectedAgent!.name, currentMode, amount);
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleAuthenticate = async () => {
    if (pin.length < 4) {
      toast({ title: "Enter PIN", description: "Please enter your 4-digit PIN", variant: "destructive" });
      return;
    }
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1800));

    if (currentMode === "cash_out") {
      const txAmount = parseFloat(amount);
      if (txAmount > balances.main) {
        toast({ title: "Insufficient balance", description: "Not enough funds in main wallet", variant: "destructive" });
        setProcessing(false);
        return;
      }
      await addTransaction({
        type: "sent",
        amount: -txAmount,
        description: `Cash withdrawal at ${selectedAgent?.name}`,
        status: "completed",
        walletType: "main",
      });
    }

    const code = `WDR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setTransactionCode(code);
    setProcessing(false);
    setStep(3);
    toast({
      title: currentMode === "cash_in" ? "Code Generated!" : "Withdrawal Authorised!",
      description: `Present code ${code} to agent`,
    });
  };

  const handleCashInComplete = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    const txAmount = parseFloat(amount);
    await addTransaction({
      type: "received",
      amount: txAmount,
      description: `Cash deposit at ${selectedAgent?.name}`,
      status: "completed",
      walletType: "main",
    });
    setProcessing(false);
    setStep(3);
    toast({ title: "Deposit Confirmed!", description: `KES ${txAmount.toLocaleString()} added to wallet` });
  };

  const statusColor: Record<string, string> = {
    open: "text-success",
    busy: "text-warning",
    closed: "text-destructive",
  };

  const statusBadge: Record<string, string> = {
    open: "bg-success/20 text-success border-success/30",
    busy: "bg-warning/20 text-warning border-warning/30",
    closed: "bg-destructive/20 text-destructive border-destructive/30",
  };

  const isCashIn = currentMode === "cash_in";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {currentMode === "discover" ? (
              <><MapPin className="h-5 w-5 text-primary" />Find Lipafo Agents</>
            ) : isCashIn ? (
              <><ArrowDownToLine className="h-5 w-5 text-success" />Cash In – Agent</>
            ) : (
              <><ArrowUpFromLine className="h-5 w-5 text-warning" />Cash Out – Agent</>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mode picker if discover */}
        {currentMode === "discover" && step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What do you want to do at an agent?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCurrentMode("cash_in")}
                className="glass-card button-3d p-5 rounded-xl border border-success/30 bg-success/10 hover:border-success/60 transition-all flex flex-col items-center gap-2"
              >
                <ArrowDownToLine className="h-8 w-8 text-success" />
                <p className="font-semibold text-sm text-foreground">Cash In</p>
                <p className="text-xs text-muted-foreground text-center">Deposit cash to wallet</p>
              </button>
              <button
                onClick={() => setCurrentMode("cash_out")}
                className="glass-card button-3d p-5 rounded-xl border border-warning/30 bg-warning/10 hover:border-warning/60 transition-all flex flex-col items-center gap-2"
              >
                <ArrowUpFromLine className="h-8 w-8 text-warning" />
                <p className="font-semibold text-sm text-foreground">Cash Out</p>
                <p className="text-xs text-muted-foreground text-center">Withdraw cash from wallet</p>
              </button>
            </div>
            <div className="glass-card p-3 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-xs text-muted-foreground">
                💡 You can also use your linked debit card at any ATM for cash withdrawals
              </p>
            </div>
          </div>
        )}

        {/* Step 0: Agent list */}
        {(currentMode !== "discover" || step === 0) && step === 0 && currentMode !== "discover" && (
          <AgentList
            agents={filteredAgents}
            search={search}
            setSearch={setSearch}
            onSelect={handleSelectAgent}
            mode={currentMode}
            statusColor={statusColor}
            statusBadge={statusBadge}
          />
        )}

        {/* When mode is set from discover, show agent list */}
        {currentMode !== "discover" && step === 0 && (
          <AgentList
            agents={filteredAgents}
            search={search}
            setSearch={setSearch}
            onSelect={handleSelectAgent}
            mode={currentMode}
            statusColor={statusColor}
            statusBadge={statusBadge}
          />
        )}

        {/* Step 1: Amount + AI guide */}
        {step === 1 && selectedAgent && (
          <div className="space-y-4">
            <button onClick={() => setStep(0)} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              ← Change Agent
            </button>

            {/* Selected Agent */}
            <Card className="glass-card p-4 border border-primary/20 bg-primary/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground text-sm">{selectedAgent.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedAgent.location} · {selectedAgent.distance}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedAgent.hours}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadge[selectedAgent.status]}`}>
                  {selectedAgent.status.toUpperCase()}
                </span>
              </div>
            </Card>

            {/* AI Guide */}
            <Card className="glass-card p-4 border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <Bot className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Lipafo AI Guide</p>
                  {loadingAI ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Getting personalised advice...
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiGuide}</p>
                  )}
                </div>
              </div>
            </Card>

            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="glass-card text-lg font-semibold mt-1"
              />
              {!isCashIn && (
                <p className="text-xs text-muted-foreground mt-1">
                  Available: KES {balances.main.toLocaleString()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000, 3000, 5000, 10000].map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a.toString())}
                  className={`glass-card p-2 rounded-lg text-xs font-medium transition-all ${
                    amount === a.toString()
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-glass-border/20 text-foreground hover:border-primary/30"
                  }`}
                >
                  {a.toLocaleString()}
                </button>
              ))}
            </div>

            <Button onClick={handleConfirmDetails} className="w-full button-3d" disabled={!amount}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2 Cash In: Show transaction code */}
        {step === 2 && isCashIn && selectedAgent && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              ← Back
            </button>

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Visit agent and share this code</p>
              <p className="font-semibold text-foreground">{selectedAgent.name}</p>
            </div>

            <Card className="glass-card p-6 border border-success/30 bg-success/10 text-center">
              <p className="text-xs text-muted-foreground mb-2">TRANSACTION CODE</p>
              <p className="text-4xl font-mono font-bold text-success tracking-widest">{transactionCode}</p>
              <p className="text-xs text-muted-foreground mt-3">Hand KES {parseFloat(amount).toLocaleString()} + show this code</p>
            </Card>

            {/* AI final instruction */}
            {aiGuide && (
              <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{aiGuide}</p>
                </div>
              </Card>
            )}

            <div className="glass-card p-3 rounded-xl space-y-2 text-sm">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">What to bring</p>
              <div className="space-y-1">
                {["National ID / Passport", `KES ${parseFloat(amount).toLocaleString()} in cash`, "This transaction code"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-success shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleCashInComplete} disabled={processing} className="w-full button-3d bg-success/80 hover:bg-success/90">
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirming...</> : "I've paid the agent – Confirm"}
            </Button>
          </div>
        )}

        {/* Step 2 Cash Out: PIN authentication */}
        {step === 2 && !isCashIn && selectedAgent && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              ← Back
            </button>

            <Card className="glass-card p-4 border border-warning/20 bg-warning/5">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Withdrawing from main wallet</p>
                <p className="text-3xl font-bold text-foreground">KES {parseFloat(amount || "0").toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">at {selectedAgent.name}</p>
              </div>
            </Card>

            {/* AI guide */}
            {aiGuide && (
              <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{aiGuide}</p>
                </div>
              </Card>
            )}

            <div>
              <Label>Enter your 4-digit PIN to authorise</Label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="glass-card text-center text-2xl font-mono tracking-[0.5em] mt-1"
              />
            </div>

            <Button onClick={handleAuthenticate} disabled={processing || pin.length < 4} className="w-full button-3d">
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Authenticating...</> : <>Authorise Withdrawal</>}
            </Button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="space-y-5 text-center py-4">
            <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center ${isCashIn ? "bg-success/20" : "bg-warning/20"}`}>
              <CheckCircle className={`h-10 w-10 ${isCashIn ? "text-success" : "text-warning"}`} />
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground">KES {parseFloat(amount).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isCashIn ? "deposited to your Lipafo wallet" : "authorised for cash withdrawal"}
              </p>
            </div>

            {transactionCode && (
              <Card className="glass-card p-4">
                <p className="text-xs text-muted-foreground">
                  {isCashIn ? "Transaction Code" : "Withdrawal Code – show agent"}
                </p>
                <p className="text-xl font-mono font-bold text-primary mt-1">{transactionCode}</p>
                {!isCashIn && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Visit {selectedAgent?.name} and present this code to collect cash
                  </p>
                )}
              </Card>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full button-3d">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-component: Agent List ─── */
function AgentList({
  agents,
  search,
  setSearch,
  onSelect,
  mode,
  statusColor,
  statusBadge,
}: {
  agents: Agent[];
  search: string;
  setSearch: (v: string) => void;
  onSelect: (a: Agent) => void;
  mode: "cash_in" | "cash_out" | "discover";
  statusColor: Record<string, string>;
  statusBadge: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 glass-card px-3 py-2 rounded-xl border border-glass-border/20">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or area..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Navigation className="h-3 w-3 text-primary" />
        <span>Using your current location · {agents.length} agents nearby</span>
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => agent.status !== "closed" && onSelect(agent)}
            disabled={agent.status === "closed"}
            className={`w-full glass-card p-4 rounded-xl border transition-all text-left group ${
              agent.status === "closed"
                ? "opacity-50 cursor-not-allowed border-glass-border/10"
                : "border-glass-border/20 hover:border-primary/40 active:scale-[0.99]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-foreground truncate">{agent.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${statusBadge[agent.status]}`}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{agent.location}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3 text-primary" />{agent.distance}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{agent.hours}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-warning fill-warning" />{agent.rating}
                  </span>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {agent.services
                    .filter((s) =>
                      mode === "cash_in" ? s === "Cash In" : mode === "cash_out" ? s === "Cash Out" || s === "ATM" : true
                    )
                    .map((s) => (
                      <span key={s} className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                        {s}
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-xs text-muted-foreground">Float</p>
                <p className="text-xs font-semibold text-foreground">{agent.float}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 group-hover:text-primary transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
