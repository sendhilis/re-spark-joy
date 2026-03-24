import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderTree, GitBranch, BookOpen, Layers, RefreshCw, Settings2, Server } from "lucide-react";
import { ChartOfAccounts } from "./ChartOfAccounts";
import { GLMapping } from "./GLMapping";
import { JournalEntries } from "./JournalEntries";
import { PoolGLManagement } from "./PoolGLManagement";
import { Reconciliation } from "./Reconciliation";
import { FeeDefinition } from "./FeeDefinition";
import { CoreBankingPosting } from "./CoreBankingPosting";
import { useI18n } from "@/contexts/I18nContext";

export function AccountingManagement() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">{t('accounting.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('accounting.subtitle')}</p>
      </div>

      <Tabs defaultValue="coa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 glass-card h-auto py-1">
          <TabsTrigger value="coa" className="flex items-center gap-1.5 text-xs py-2">
            <FolderTree className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.coa')}</span><span className="lg:hidden">COA</span>
          </TabsTrigger>
          <TabsTrigger value="gl-mapping" className="flex items-center gap-1.5 text-xs py-2">
            <GitBranch className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.glMapping')}</span><span className="lg:hidden">GL Map</span>
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-1.5 text-xs py-2">
            <BookOpen className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.journalEntries')}</span><span className="lg:hidden">JEs</span>
          </TabsTrigger>
          <TabsTrigger value="pool-gl" className="flex items-center gap-1.5 text-xs py-2">
            <Layers className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.poolGLs')}</span><span className="lg:hidden">Pools</span>
          </TabsTrigger>
          <TabsTrigger value="core-posting" className="flex items-center gap-1.5 text-xs py-2">
            <Server className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.corePosting')}</span><span className="lg:hidden">Core</span>
          </TabsTrigger>
          <TabsTrigger value="recon" className="flex items-center gap-1.5 text-xs py-2">
            <RefreshCw className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.reconciliation')}</span><span className="lg:hidden">Recon</span>
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-1.5 text-xs py-2">
            <Settings2 className="h-3.5 w-3.5" /><span className="hidden lg:inline">{t('accounting.feeSchedules')}</span><span className="lg:hidden">Fees</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coa"><ChartOfAccounts /></TabsContent>
        <TabsContent value="gl-mapping"><GLMapping /></TabsContent>
        <TabsContent value="journal"><JournalEntries /></TabsContent>
        <TabsContent value="pool-gl"><PoolGLManagement /></TabsContent>
        <TabsContent value="core-posting"><CoreBankingPosting /></TabsContent>
        <TabsContent value="recon"><Reconciliation /></TabsContent>
        <TabsContent value="fees"><FeeDefinition /></TabsContent>
      </Tabs>
    </div>
  );
}
