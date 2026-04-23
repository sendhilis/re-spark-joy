import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Eye, EyeOff, Copy, Snowflake, Trash2, Plus, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface VirtualCardFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VCard {
  id: string;
  card_number: string;
  cvv: string;
  expiry_month: number;
  expiry_year: number;
  card_holder: string;
  is_frozen: boolean;
  spending_limit: number;
  current_spent: number;
}

export function VirtualCardFlow({ open, onOpenChange }: VirtualCardFlowProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState("cards");
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [newCardLabel, setNewCardLabel] = useState("");
  const [newCardAmount, setNewCardAmount] = useState("1000");
  const [processing, setProcessing] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [spendLimit, setSpendLimit] = useState(50000);
  const [cards, setCards] = useState<VCard[]>([]);
  const { toast } = useToast();

  const fetchCards = useCallback(async () => {
    if (!user) return;
    setLoadingCards(true);
    const { data, error } = await supabase
      .from("virtual_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setCards(data);
    setLoadingCards(false);
  }, [user]);

  useEffect(() => {
    if (open) fetchCards();
  }, [open, fetchCards]);

  // Sync spending limit when a card is selected
  useEffect(() => {
    const card = cards.find(c => c.id === selectedCard);
    if (card) setSpendLimit(card.spending_limit);
  }, [selectedCard, cards]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const generateCard = async () => {
    if (!user) return;
    if (!newCardLabel || !newCardAmount || parseFloat(newCardAmount) < 100) {
      toast({ title: "Error", description: "Enter a label and amount (min KES 100)", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const num = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join(" ");
      const cvv = Math.floor(100 + Math.random() * 900).toString();

      const { error } = await supabase.from("virtual_cards").insert({
        user_id: user.id,
        card_number: num,
        cvv,
        expiry_month: 2,
        expiry_year: 29,
        card_holder: user.user_metadata?.full_name?.toUpperCase() || user.email?.split("@")[0].toUpperCase() || "CARDHOLDER",
        spending_limit: 50000,
        is_frozen: false,
        current_spent: 0,
      });

      if (error) throw error;

      await fetchCards();
      setNewCardLabel("");
      setNewCardAmount("1000");
      setTab("cards");
      toast({ title: "Card Created!", description: `Virtual card "${newCardLabel}" is ready` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create card", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleFreeze = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const newFrozen = !card.is_frozen;
    // Optimistic update
    setCards(prev => prev.map(c => c.id === id ? { ...c, is_frozen: newFrozen } : c));
    const { error } = await supabase.from("virtual_cards").update({ is_frozen: newFrozen }).eq("id", id);
    if (error) {
      setCards(prev => prev.map(c => c.id === id ? { ...c, is_frozen: !newFrozen } : c));
      toast({ title: "Error", description: "Failed to update card", variant: "destructive" });
    } else {
      toast({ title: newFrozen ? "Card Frozen" : "Card Unfrozen", description: newFrozen ? "Card is temporarily disabled" : "Card is active again" });
    }
  };

  const saveSpendLimit = async (id: string) => {
    const { error } = await supabase.from("virtual_cards").update({ spending_limit: spendLimit }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update spending limit", variant: "destructive" });
    } else {
      setCards(prev => prev.map(c => c.id === id ? { ...c, spending_limit: spendLimit } : c));
      toast({ title: "Limit Updated", description: `Spending limit set to KES ${spendLimit.toLocaleString()}` });
    }
  };

  const deleteCard = async (id: string) => {
    const { error } = await supabase.from("virtual_cards").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete card", variant: "destructive" });
    } else {
      setCards(prev => prev.filter(c => c.id !== id));
      setSelectedCard(null);
      toast({ title: "Card Deleted", description: "Virtual card has been permanently deleted" });
    }
  };

  const managingCard = cards.find(c => c.id === selectedCard);

  const formatExpiry = (month: number, year: number) =>
    `${String(month).padStart(2, "0")}/${String(year).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Virtual Cards
          </DialogTitle>
        </DialogHeader>

        {selectedCard && managingCard ? (
          <div className="space-y-5">
            <Button onClick={() => setSelectedCard(null)} variant="ghost" size="sm" className="text-muted-foreground">
              ← Back to cards
            </Button>

            {/* Card Preview */}
            <Card className={`p-5 bg-gradient-to-br border ${managingCard.is_frozen ? "from-muted/30 to-muted/10 border-muted/30" : "from-primary/20 to-primary/5 border-primary/20"}`}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="text-xs font-semibold text-primary">LIPAFO VIRTUAL</div>
                  <div className="text-xs text-muted-foreground">MASTERCARD</div>
                </div>
                <div className="py-2">
                  <p className="text-lg font-mono tracking-wider text-foreground">
                    {showDetails === managingCard.id ? managingCard.card_number : "•••• •••• •••• " + managingCard.card_number.slice(-4)}
                  </p>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Cardholder</p>
                    <p className="text-sm font-semibold text-foreground">{managingCard.card_holder}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase">Expires</p>
                    <p className="text-sm font-bold text-foreground">{formatExpiry(managingCard.expiry_month, managingCard.expiry_year)}</p>
                  </div>
                </div>
                {managingCard.is_frozen && (
                  <div className="flex items-center gap-1 text-warning text-xs font-semibold">
                    <Snowflake className="h-3 w-3" /> FROZEN
                  </div>
                )}
              </div>
            </Card>

            {/* Card Details */}
            <div className="space-y-3">
              <Button onClick={() => setShowDetails(showDetails === managingCard.id ? null : managingCard.id)} variant="outline" className="w-full" size="sm">
                {showDetails === managingCard.id ? <><EyeOff className="h-4 w-4 mr-2" />Hide Details</> : <><Eye className="h-4 w-4 mr-2" />Show Details</>}
              </Button>

              {showDetails === managingCard.id && (
                <div className="space-y-2">
                  {[
                    { label: "Card Number", value: managingCard.card_number, copyVal: managingCard.card_number.replace(/\s/g, "") },
                    { label: "CVV", value: managingCard.cvv, copyVal: managingCard.cvv },
                    { label: "Expiry", value: formatExpiry(managingCard.expiry_month, managingCard.expiry_year), copyVal: formatExpiry(managingCard.expiry_month, managingCard.expiry_year) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between glass-card p-3 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-mono text-foreground">{item.value}</p>
                      </div>
                      <Button onClick={() => copyToClipboard(item.copyVal, item.label)} variant="ghost" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Card Settings</Label>

              <Card className="glass-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Freeze Card</p>
                      <p className="text-xs text-muted-foreground">Temporarily disable transactions</p>
                    </div>
                  </div>
                  <Switch checked={managingCard.is_frozen} onCheckedChange={() => toggleFreeze(managingCard.id)} />
                </div>
              </Card>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">Spending Limit</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">KES {spendLimit.toLocaleString()}</span>
                </div>
                <Slider value={[spendLimit]} onValueChange={(v) => setSpendLimit(v[0])} min={1000} max={200000} step={1000} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>KES 1,000</span>
                  <span>KES 200,000</span>
                </div>
                <Button onClick={() => saveSpendLimit(managingCard.id)} variant="outline" size="sm" className="w-full">
                  Save Spending Limit
                </Button>
              </div>

              <Button onClick={() => deleteCard(managingCard.id)} variant="destructive" className="w-full" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Card Permanently
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full glass-card">
              <TabsTrigger value="cards" className="flex-1">My Cards</TabsTrigger>
              <TabsTrigger value="create" className="flex-1">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="cards" className="space-y-3 mt-4">
              {loadingCards ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No virtual cards yet</p>
                  <Button onClick={() => setTab("create")} className="mt-3 button-3d" size="sm">
                    <Plus className="h-4 w-4 mr-2" />Create Your First Card
                  </Button>
                </div>
              ) : (
                cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card.id)}
                    className="w-full glass-card p-4 rounded-xl border border-glass-border/20 hover:border-primary/40 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${card.is_frozen ? "bg-muted/30" : "bg-primary/20"}`}>
                          <CreditCard className={`h-5 w-5 ${card.is_frozen ? "text-muted-foreground" : "text-primary"}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{card.card_holder}</p>
                          <p className="text-xs text-muted-foreground">•••• {card.card_number.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{formatExpiry(card.expiry_month, card.expiry_year)}</p>
                        {card.is_frozen && (
                          <span className="text-xs text-warning flex items-center gap-1 justify-end">
                            <Snowflake className="h-3 w-3" /> Frozen
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="text-center mb-2">
                <CreditCard className="h-16 w-16 mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Create a virtual card for secure online payments</p>
              </div>

              <div>
                <Label>Card Label / Purpose</Label>
                <Input value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} placeholder="e.g. Netflix, Shopping" className="glass-card" />
              </div>

              <div>
                <Label>Initial Load Amount (KES)</Label>
                <Input type="number" value={newCardAmount} onChange={(e) => setNewCardAmount(e.target.value)} placeholder="1000" className="glass-card" />
                <p className="text-xs text-muted-foreground mt-1">Min: KES 100 · Deducted from main wallet</p>
              </div>

              <Button onClick={generateCard} disabled={processing} className="w-full button-3d">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <>Create Virtual Card</>}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
