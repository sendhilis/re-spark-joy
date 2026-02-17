import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Eye, EyeOff, Copy, Snowflake, Trash2, Plus, Shield, Settings, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VirtualCardFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VCard {
  id: string;
  number: string;
  cvv: string;
  expiry: string;
  name: string;
  balance: number;
  frozen: boolean;
  spendLimit: number;
  label: string;
}

export function VirtualCardFlow({ open, onOpenChange }: VirtualCardFlowProps) {
  const [tab, setTab] = useState("cards");
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");
  const [newCardAmount, setNewCardAmount] = useState("1000");
  const [processing, setProcessing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [spendLimit, setSpendLimit] = useState(50000);

  const [cards, setCards] = useState<VCard[]>([
    {
      id: "1", number: "5234 5678 9012 3456", cvv: "123", expiry: "12/28",
      name: "JOHN KIPROTICH", balance: 5000, frozen: false, spendLimit: 50000, label: "Online Shopping",
    },
  ]);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const generateCard = () => {
    if (!newCardLabel || !newCardAmount || parseFloat(newCardAmount) < 100) {
      toast({ title: "Error", description: "Enter a label and amount (min KES 100)", variant: "destructive" });
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      const num = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join(" ");
      const cvv = Math.floor(100 + Math.random() * 900).toString();
      const newCard: VCard = {
        id: Date.now().toString(), number: num, cvv, expiry: "02/29",
        name: "JOHN KIPROTICH", balance: parseFloat(newCardAmount), frozen: false,
        spendLimit: 50000, label: newCardLabel,
      };
      setCards(prev => [...prev, newCard]);
      setProcessing(false);
      setCreating(false);
      setNewCardLabel("");
      setNewCardAmount("1000");
      toast({ title: "Card Created!", description: `Virtual card "${newCardLabel}" is ready` });
    }, 1500);
  };

  const toggleFreeze = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, frozen: !c.frozen } : c));
    const card = cards.find(c => c.id === id);
    toast({ title: card?.frozen ? "Card Unfrozen" : "Card Frozen", description: card?.frozen ? "Card is active again" : "Card is temporarily disabled" });
  };

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setSelectedCard(null);
    toast({ title: "Card Deleted", description: "Virtual card has been permanently deleted" });
  };

  const managingCard = cards.find(c => c.id === selectedCard);

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
            <Card className={`p-5 bg-gradient-to-br border ${managingCard.frozen ? "from-muted/30 to-muted/10 border-muted/30" : "from-primary/20 to-primary/5 border-primary/20"}`}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="text-xs font-semibold text-primary">RUKISHA VIRTUAL</div>
                  <div className="text-xs text-muted-foreground">MASTERCARD</div>
                </div>
                <div className="py-2">
                  <p className="text-lg font-mono tracking-wider text-foreground">
                    {showDetails === managingCard.id ? managingCard.number : "•••• •••• •••• " + managingCard.number.slice(-4)}
                  </p>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Cardholder</p>
                    <p className="text-sm font-semibold text-foreground">{managingCard.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase">Balance</p>
                    <p className="text-sm font-bold text-foreground">KES {managingCard.balance.toLocaleString()}</p>
                  </div>
                </div>
                {managingCard.frozen && (
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
                    { label: "Card Number", value: managingCard.number, copyVal: managingCard.number.replace(/\s/g, "") },
                    { label: "CVV", value: managingCard.cvv, copyVal: managingCard.cvv },
                    { label: "Expiry", value: managingCard.expiry, copyVal: managingCard.expiry },
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
                  <Switch checked={managingCard.frozen} onCheckedChange={() => toggleFreeze(managingCard.id)} />
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
              {cards.length === 0 ? (
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
                        <div className={`p-2 rounded-full ${card.frozen ? "bg-muted/30" : "bg-primary/20"}`}>
                          <CreditCard className={`h-5 w-5 ${card.frozen ? "text-muted-foreground" : "text-primary"}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{card.label}</p>
                          <p className="text-xs text-muted-foreground">•••• {card.number.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">KES {card.balance.toLocaleString()}</p>
                        {card.frozen && (
                          <span className="text-xs text-warning flex items-center gap-1">
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
                <Label>Card Label</Label>
                <Input value={newCardLabel} onChange={(e) => setNewCardLabel(e.target.value)} placeholder="e.g. Netflix, Shopping" className="glass-card" />
              </div>

              <div>
                <Label>Load Amount (KES)</Label>
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
