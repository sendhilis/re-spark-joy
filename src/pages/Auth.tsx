import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword } = useAuth();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: ""
  });

  // Redirect if already logged in
  if (user) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);
    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!", description: "Successfully logged in to Rukisha" });
      navigate("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      toast({ title: "Password Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (signupForm.password.length < 6) {
      toast({ title: "Password Too Short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(signupForm.email, signupForm.password, {
      first_name: signupForm.firstName,
      last_name: signupForm.lastName,
    });
    setIsLoading(false);
    if (error) {
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account Created!", description: "Welcome to Rukisha!" });
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    setIsLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reset link sent!", description: "Check your email for the password reset link." });
      setShowForgotPassword(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <Banknote className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                Reset Password
              </h1>
            </div>
            <p className="text-muted-foreground">Enter your email to receive a reset link</p>
          </div>
          <Card className="glass-card p-8 border-2 border-primary/20">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="Enter your email" className="pl-10" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 button-3d" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)}>
                ← Back to Sign In
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <Banknote className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                Rukisha
              </h1>
              <p className="text-xs text-muted-foreground">by CPF Group</p>
            </div>
          </div>
          <p className="text-muted-foreground">Your Digital Wallet, Your Financial Future</p>
        </div>

        {/* Auth Form */}
        <Card className="glass-card p-8 border-2 border-primary/20">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" type="email" placeholder="Enter your email" className="pl-10"
                        value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" className="pl-10 pr-10"
                        value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 button-3d" disabled={isLoading}>
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
                <button type="button" onClick={() => setShowForgotPassword(true)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                  Forgot your password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname">First Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-firstname" type="text" placeholder="First name" className="pl-10"
                          value={signupForm.firstName} onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname">Last Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-lastname" type="text" placeholder="Last name" className="pl-10"
                          value={signupForm.lastName} onChange={(e) => setSignupForm({ ...signupForm, lastName: e.target.value })} required />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-email" type="email" placeholder="Enter your email" className="pl-10"
                        value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Create a password" className="pl-10 pr-10"
                        value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-confirm" type={showPassword ? "text" : "password"} placeholder="Confirm your password" className="pl-10"
                        value={signupForm.confirmPassword} onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })} required />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 button-3d" disabled={isLoading}>
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to Rukisha's Terms of Service and Privacy Policy
            </p>
          </div>
        </Card>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
