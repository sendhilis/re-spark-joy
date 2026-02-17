import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Shield, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

interface FlaggedTransaction {
  id: string;
  transaction_id: string | null;
  user_id: string;
  reason: string;
  severity: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export function ComplianceCenter() {
  const [flagged, setFlagged] = useState<FlaggedTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reviewItem, setReviewItem] = useState<FlaggedTransaction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { fetchFlagged(); }, []);

  const fetchFlagged = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("flagged_transactions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setFlagged(data);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const handleResolve = async (status: "resolved" | "escalated") => {
    if (!reviewItem || !user) return;
    const { error } = await supabase
      .from("flagged_transactions")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        notes: reviewNotes,
      })
      .eq("id", reviewItem.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Case ${status}` });
      setReviewItem(null);
      fetchFlagged();
    }
  };

  const filtered = flagged.filter(f => statusFilter === "all" || f.status === statusFilter);
  const highSeverity = flagged.filter(f => f.severity === "high" && f.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Flags</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{flagged.length}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Review</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{flagged.filter(f => f.status === "pending").length}</p></CardContent>
        </Card>
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">High Severity</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{highSeverity}</p></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] glass-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="glass-card" onClick={fetchFlagged}>Refresh</Button>
      </div>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No flagged transactions</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(item.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-foreground">{item.reason}</TableCell>
                  <TableCell>
                    <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"} className="text-xs capitalize">
                      {item.severity === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {item.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "resolved" ? "default" : item.status === "escalated" ? "destructive" : "secondary"} className="text-xs capitalize">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => { setReviewItem(item); setReviewNotes(""); }}>Review</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!reviewItem} onOpenChange={() => setReviewItem(null)}>
        <DialogContent className="glass-card border-glass-border">
          <DialogHeader><DialogTitle>Review Flagged Transaction</DialogTitle></DialogHeader>
          {reviewItem && (
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-xl space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Reason:</span><span className="text-foreground">{reviewItem.reason}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Severity:</span><Badge variant={reviewItem.severity === "high" ? "destructive" : "secondary"}>{reviewItem.severity}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">User:</span><span className="text-foreground text-sm">{reviewItem.user_id.substring(0, 12)}...</span></div>
              </div>
              <Textarea className="glass-card" placeholder="Review notes..." value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              <div className="flex gap-3">
                <Button className="flex-1 bg-destructive hover:bg-destructive/80" onClick={() => handleResolve("escalated")}>
                  <AlertTriangle className="h-4 w-4 mr-2" /> Escalate
                </Button>
                <Button className="flex-1 button-3d" onClick={() => handleResolve("resolved")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Resolve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
