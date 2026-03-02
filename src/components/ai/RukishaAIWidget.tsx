import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MessageCircle, X, Send, Sparkles, CreditCard, TrendingUp, Bell, Heart, Wallet, Globe, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

type Msg = { role: "user" | "assistant"; content: string };

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const quickActions: QuickAction[] = [
  { id: "salary_repay_history", label: "Repay History", icon: <History className="h-4 w-4" />, description: "View salary loan repayment history" },
  { id: "loan_health", label: "Loan Health Check", icon: <Heart className="h-4 w-4" />, description: "Review your diaspora loan status" },
  { id: "repay_reminder", label: "Repay Reminders", icon: <Bell className="h-4 w-4" />, description: "Set up payment reminders" },
  { id: "repay_monitor", label: "Repay Monitor", icon: <TrendingUp className="h-4 w-4" />, description: "Track repayment progress" },
  { id: "remittance", label: "Send Money Home", icon: <Globe className="h-4 w-4" />, description: "Remittance guidance & rates" },
  { id: "wallet_setup", label: "Wallet Optimizer", icon: <Wallet className="h-4 w-4" />, description: "Optimize your sub-wallets" },
  { id: "exchange_rates", label: "Exchange Rates", icon: <CreditCard className="h-4 w-4" />, description: "KES exchange rate info" },
];

const proactiveNudges = [
  "🏠 Have you checked your diaspora mortgage health recently? I can run a quick review.",
  "⏰ Setting up automatic repay reminders can help you never miss a payment. Want me to help?",
  "💰 Your remittance fees could be lower with Rukisha. Let me show you how much you'd save.",
  "📊 I can monitor your loan repayments and alert you to any concerns. Interested?",
  "🎯 Your sub-wallets could be working harder for you. Let me suggest an optimal allocation.",
  "💳 I can show you your salary loan repayment history. Want to see your progress?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rukisha-ai`;

export function RukishaAIWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [currentNudge, setCurrentNudge] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Safely try to use wallet context (may not be available on all pages)
  let walletData: ReturnType<typeof useWallet> | null = null;
  try {
    walletData = useWallet();
  } catch {
    // Not within WalletProvider, wallet context unavailable
  }

  // Build wallet context payload for the AI
  const walletContext = useMemo(() => {
    if (!walletData) return undefined;

    const { balances, transactions } = walletData;

    const salaryTransfers = transactions
      .filter(t => t.description?.toLowerCase().includes('salary transfer'))
      .map(t => ({ amount: t.amount, description: t.description, timestamp: t.timestamp, status: t.status }));

    const loanRepayments = transactions
      .filter(t => t.description?.toLowerCase().includes('loan repayment'))
      .map(t => ({ amount: t.amount, description: t.description, timestamp: t.timestamp, status: t.status }));

    const recentTransactions = transactions.slice(0, 15).map(t => ({
      type: t.type, amount: t.amount, description: t.description,
      timestamp: t.timestamp, status: t.status,
    }));

    return { balances, salaryTransfers, loanRepayments, recentTransactions };
  }, [walletData?.balances, walletData?.transactions]);

  // Proactive nudge timer
  useEffect(() => {
    if (isOpen || messages.length > 0) return;
    const timer = setTimeout(() => {
      setShowNudge(true);
      setCurrentNudge(Math.floor(Math.random() * proactiveNudges.length));
    }, 15000);
    return () => clearTimeout(timer);
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamChat = useCallback(async (msgs: Msg[], action?: string) => {
    setIsLoading(true);
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: msgs, action, walletContext }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        toast({ title: "Rukisha AI", description: err.error || "Something went wrong", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Rukisha AI error:", e);
      toast({ title: "Rukisha AI", description: "Connection error. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast, walletContext]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await streamChat(newMessages);
  };

  const handleQuickAction = async (action: QuickAction) => {
    const userMsg: Msg = { role: "user", content: action.description };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await streamChat(newMessages, action.id);
  };

  const handleNudgeClick = () => {
    setShowNudge(false);
    setIsOpen(true);
    const nudgeText = proactiveNudges[currentNudge].replace(/^[^\s]+\s/, "");
    const userMsg: Msg = { role: "user", content: nudgeText };
    setMessages([userMsg]);
    streamChat([userMsg]);
  };

  return (
    <>
      {/* Proactive Nudge Bubble */}
      {showNudge && !isOpen && (
        <div className="fixed bottom-24 right-4 z-50 max-w-[280px] animate-in slide-in-from-bottom-4 fade-in duration-500">
          <div
            className="glass-card p-4 rounded-2xl border border-primary/30 cursor-pointer touch-feedback"
            onClick={handleNudgeClick}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground leading-snug">{proactiveNudges[currentNudge]}</p>
                <p className="text-xs text-primary mt-1 font-medium">Tap to chat →</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowNudge(false); }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-300 safe-top safe-bottom">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Rukisha AI</h3>
                <p className="text-xs text-muted-foreground">Diaspora Financial Assistant</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-xl">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto scroll-native no-scrollbar px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-6">
                {/* Welcome */}
                <div className="text-center space-y-2 pt-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary-light/20 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground">Habari! 👋</h4>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    I'm your diaspora financial assistant. I can see your wallet activity and loan repayment history in real-time.
                  </p>
                </div>

                {/* Quick Actions Grid */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action)}
                        className="glass-card p-3 rounded-2xl text-left touch-feedback hover:border-primary/30 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-primary group-hover:scale-110 transition-transform">{action.icon}</div>
                          <span className="text-xs font-semibold text-foreground">{action.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{action.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "glass-card text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none text-sm [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions strip when in conversation */}
          {messages.length > 0 && !isLoading && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              {quickActions.slice(0, 4).map(action => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  className="shrink-0 glass-card px-3 py-1.5 rounded-full text-xs font-medium text-foreground flex items-center gap-1.5 touch-feedback"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/50 safe-bottom">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your loan repayments..."
                className="flex-1 glass-card rounded-2xl border-border/30 h-11 text-sm"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="rounded-2xl h-11 w-11 shrink-0 button-3d"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setShowNudge(false); }}
          className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/30 flex items-center justify-center touch-feedback animate-in zoom-in duration-300"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background animate-pulse" />
        </button>
      )}
    </>
  );
}
