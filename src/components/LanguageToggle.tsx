import { useI18n, type Locale } from "@/contexts/I18nContext";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  const toggle = () => setLocale(locale === 'en' ? 'fr' : 'en');

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full glass-card button-3d border border-glass-border/20 hover:border-primary/30 transition-all group flex items-center gap-1.5"
      title={locale === 'en' ? 'Passer au Français' : 'Switch to English'}
    >
      <Languages className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
      <span className="text-xs font-bold text-foreground uppercase">{locale}</span>
    </button>
  );
}
