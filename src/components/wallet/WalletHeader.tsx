import { Bell, Settings, Banknote, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/I18nContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export function WalletHeader() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleLogout = () => {
    localStorage.clear();
    toast({
      title: t('auth.loggedOut'),
      description: t('auth.loggedOutDesc'),
    });
    navigate("/");
  };

  return (
    <div className="relative">
      <div className="relative z-10 glass-card p-6 rounded-3xl border-2 border-glass-border/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/30">
              <AvatarImage src="/api/placeholder/48/48" />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                JM
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('wallet.welcomeBack')}, John</h1>
              <p className="text-sm text-muted-foreground">{t('wallet.manageFinances')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <LanguageToggle />
            <button className="p-2 rounded-full glass-card button-3d border border-glass-border/20 hover:border-primary/30 transition-all">
              <Bell className="h-5 w-5 text-foreground" />
            </button>
            <button className="p-2 rounded-full glass-card button-3d border border-glass-border/20 hover:border-primary/30 transition-all">
              <Settings className="h-5 w-5 text-foreground" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full glass-card button-3d border border-glass-border/20 hover:border-destructive/30 transition-all group"
              title={t('common.logout')}
            >
              <LogOut className="h-5 w-5 text-foreground group-hover:text-destructive transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 py-4 glass-card rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/10 to-primary-light/10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center button-3d">
            <Banknote className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Rukisha
            </h2>
            <p className="text-sm text-muted-foreground font-medium">{t('wallet.equityDiaspora')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
