import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Shield, Ban, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  created_at: string;
}

interface UserWallet {
  type: string;
  balance: number;
}

export function UserManagement() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userWallets, setUserWallets] = useState<UserWallet[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });

    const { data: roles } = await supabase.from("user_roles").select("*");
    if (roles) {
      const roleMap: Record<string, string[]> = {};
      roles.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });
      setUserRoles(roleMap);
    }
    setLoading(false);
  };

  const viewUserDetails = async (userId: string) => {
    setSelectedUser(userId);
    const { data } = await supabase.from("wallets").select("type, balance").eq("user_id", userId);
    if (data) setUserWallets(data);
  };

  const toggleAdminRole = async (userId: string) => {
    const isAdmin = userRoles[userId]?.includes("admin");
    if (isAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      toast({ title: "Admin role removed" });
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      toast({ title: "Admin role granted" });
    }
    fetchProfiles();
  };

  const filteredProfiles = profiles.filter(p =>
    (p.display_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    p.user_id.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users by name or ID..." className="pl-10 glass-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Badge variant="outline" className="text-sm">{profiles.length} users</Badge>
      </div>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filteredProfiles.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users found</TableCell></TableRow>
            ) : (
              filteredProfiles.map((profile) => (
                <TableRow key={profile.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{profile.display_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{profile.user_id.substring(0, 8)}...</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.phone || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(userRoles[profile.user_id] || ["user"]).map(role => (
                        <Badge key={role} variant={role === "admin" ? "default" : "secondary"} className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(profile.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => viewUserDetails(profile.user_id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAdminRole(profile.user_id)}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="glass-card border-glass-border">
          <DialogHeader><DialogTitle>User Wallets</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {userWallets.map((w) => (
              <div key={w.type} className="flex justify-between items-center glass-card p-3 rounded-xl">
                <span className="capitalize text-foreground font-medium">{w.type}</span>
                <span className="text-foreground font-bold">KES {new Intl.NumberFormat("en-KE").format(w.balance)}</span>
              </div>
            ))}
            {userWallets.length === 0 && <p className="text-muted-foreground text-center">No wallets found</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
