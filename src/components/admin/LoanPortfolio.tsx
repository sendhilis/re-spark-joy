import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LoanApplication {
  id: string;
  user_id: string;
  loan_type: string;
  amount: number;
  duration_months: number;
  interest_rate: number;
  monthly_payment: number | null;
  purpose: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export function LoanPortfolio() {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reviewLoan, setReviewLoan] = useState<LoanApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setLoans(data);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!reviewLoan || !user) return;
    const { error } = await supabase
      .from("loan_applications")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        notes: reviewNotes,
      })
      .eq("id", reviewLoan.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Loan ${status}`, description: `Loan application has been ${status}.` });
      setReviewLoan(null);
      setReviewNotes("");
      fetchLoans();
    }
  };

  const filtered = loans.filter(l => statusFilter === "all" || l.status === statusFilter);
  const totalPortfolio = loans.filter(l => l.status === "approved").reduce((s, l) => s + l.amount, 0);
  const pendingCount = loans.filter(l => l.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Portfolio</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(totalPortfolio)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Applications</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{loans.length}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Review</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{pendingCount}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approval Rate</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {loans.length > 0 ? Math.round((loans.filter(l => l.status === "approved").length / loans.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] glass-card"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="glass-card" onClick={fetchLoans}>Refresh</Button>
      </div>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No loan applications found</TableCell></TableRow>
            ) : (
              filtered.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{loan.loan_type.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-foreground font-medium">KES {new Intl.NumberFormat("en-KE").format(loan.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{loan.duration_months} months</TableCell>
                  <TableCell className="text-muted-foreground">{loan.interest_rate}%</TableCell>
                  <TableCell>
                    <Badge variant={loan.status === "approved" ? "default" : loan.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                      {loan.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {loan.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                      {loan.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {loan.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => { setReviewLoan(loan); setReviewNotes(""); }}>
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!reviewLoan} onOpenChange={() => setReviewLoan(null)}>
        <DialogContent className="glass-card border-glass-border">
          <DialogHeader><DialogTitle>Review Loan Application</DialogTitle></DialogHeader>
          {reviewLoan && (
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-xl space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="text-foreground capitalize">{reviewLoan.loan_type.replace("_", " ")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-bold">KES {new Intl.NumberFormat("en-KE").format(reviewLoan.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span className="text-foreground">{reviewLoan.duration_months} months</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rate:</span><span className="text-foreground">{reviewLoan.interest_rate}%</span></div>
                {reviewLoan.purpose && <div className="flex justify-between"><span className="text-muted-foreground">Purpose:</span><span className="text-foreground">{reviewLoan.purpose}</span></div>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Review Notes</label>
                <Textarea className="glass-card mt-1" placeholder="Add review notes..." value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-destructive hover:bg-destructive/80" onClick={() => handleReview("rejected")}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button className="flex-1 button-3d" onClick={() => handleReview("approved")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
