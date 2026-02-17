import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Flag, CheckCircle } from "lucide-react";

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  recipient: string | null;
  status: string;
  wallet_type: string;
  created_at: string;
}

export function TransactionMonitoring() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setTransactions(data);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const flagTransaction = async (tx: Transaction) => {
    const { error } = await supabase.from("flagged_transactions").insert({
      transaction_id: tx.id,
      user_id: tx.user_id,
      reason: "Flagged for review by admin",
      severity: Math.abs(tx.amount) > 100000 ? "high" : "medium",
      status: "pending",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Transaction flagged for review" });
    }
  };

  const filtered = transactions.filter(tx => {
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.user_id.includes(search) ||
      (tx.recipient?.toLowerCase() || "").includes(search.toLowerCase());
    const matchType = typeFilter === "all" || tx.type === typeFilter;
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalVolume = filtered.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const pendingCount = filtered.filter(tx => tx.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Volume</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(totalVolume)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{filtered.length}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{pendingCount}</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." className="pl-10 glass-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] glass-card"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="bill">Bill</SelectItem>
            <SelectItem value="save">Save</SelectItem>
            <SelectItem value="mpesa">M-Pesa</SelectItem>
            <SelectItem value="pension_contribution">Pension</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] glass-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No transactions found</TableCell></TableRow>
            ) : (
              filtered.slice(0, 50).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(tx.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{tx.type.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-foreground text-sm">{tx.description}</p>
                      {tx.recipient && <p className="text-xs text-muted-foreground">To: {tx.recipient}</p>}
                    </div>
                  </TableCell>
                  <TableCell className={tx.amount >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                    {tx.amount >= 0 ? "+" : ""}KES {new Intl.NumberFormat("en-KE").format(Math.abs(tx.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => flagTransaction(tx)} title="Flag for review">
                      <Flag className="h-4 w-4 text-warning" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
