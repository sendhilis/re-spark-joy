import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RukishaAIWidget } from "@/components/ai/RukishaAIWidget";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Index from "./pages/Index";
import Showcase from "./pages/Showcase";
import ChamaMerchant from "./pages/ChamaMerchant";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import DownloadDoc from "./pages/DownloadDoc";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <WalletProvider>
              <Toaster />
              <Sonner />
              <RukishaAIWidget />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/showcase" element={<Showcase />} />
                <Route path="/chama-merchant" element={<ChamaMerchant />} />
                <Route path="/download-doc" element={<DownloadDoc />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </WalletProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
