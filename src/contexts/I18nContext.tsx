import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Locale = 'en' | 'fr';

type TranslationDict = Record<string, string>;

const en: TranslationDict = {
  // Common
  'common.search': 'Search',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.submit': 'Submit',
  'common.loading': 'Loading...',
  'common.viewAll': 'View All',
  'common.status': 'Status',
  'common.active': 'Active',
  'common.pending': 'Pending',
  'common.completed': 'Completed',
  'common.failed': 'Failed',
  'common.configure': 'Configure',
  'common.create': 'Create',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.logout': 'Logout',
  'common.settings': 'Settings',
  'common.notifications': 'Notifications',

  // Auth
  'auth.login': 'Login',
  'auth.signup': 'Sign Up',
  'auth.loggedOut': 'Logged out successfully',
  'auth.loggedOutDesc': 'You have been signed out of your account.',

  // Wallet Header
  'wallet.welcomeBack': 'Welcome back',
  'wallet.manageFinances': 'Manage your finances smartly',
  'wallet.equityDiaspora': 'Equity Bank - Diaspora Connect',

  // Wallet Card
  'wallet.mainWallet': 'Main Wallet',
  'wallet.availableBalance': 'Available Balance',
  'wallet.quickDeposit': 'Quick Deposit',

  // Quick Actions
  'quickActions.title': 'Quick Actions',
  'quickActions.getLoan': 'Get Loan',
  'quickActions.getLoanDesc': 'Apply for loans',
  'quickActions.moveMoney': 'Move Money',
  'quickActions.moveMoneyDesc': 'Between wallets',
  'quickActions.sendMoney': 'Send Money',
  'quickActions.sendMoneyDesc': 'To others',
  'quickActions.cashIn': 'Cash In',
  'quickActions.cashInDesc': 'Deposit at agent',
  'quickActions.cashOut': 'Cash Out',
  'quickActions.cashOutDesc': 'ATM or agent',
  'quickActions.payBills': 'Pay Bills',
  'quickActions.payBillsDesc': 'Utilities & services',
  'quickActions.qrPay': 'QR Pay',
  'quickActions.qrPayDesc': 'Scan & pay',
  'quickActions.save': 'Save',
  'quickActions.saveDesc': 'Add to savings',
  'quickActions.virtualCard': 'Virtual Card',
  'quickActions.virtualCardDesc': 'Manage cards',
  'quickActions.linkDebit': 'Link Debit Card',
  'quickActions.linkDebitDesc': 'ATM & agent access',
  'quickActions.intlCard': 'Intl Card',
  'quickActions.intlCardDesc': 'Diaspora cards',
  'quickActions.mobileMoney': 'Mobile Money',
  'quickActions.mobileMoneyDesc': 'Top up mobile money',
  'quickActions.bankTransfer': 'Bank Transfer',
  'quickActions.bankTransferDesc': 'Send to bank account',
  'quickActions.schoolFees': 'School Fees',
  'quickActions.schoolFeesDesc': 'Pay tuition fees',
  'quickActions.findAgents': 'Find Agents',
  'quickActions.findAgentsDesc': 'Locate nearby agents',
  'quickActions.diaspora': 'Diaspora',
  'quickActions.diasporaDesc': 'Worker Services',
  'quickActions.loanProducts': 'Loan Products',

  // Sub Wallets
  'subWallets.title': 'Sub-Wallets',
  'subWallets.addWallet': 'Add Wallet',
  'subWallets.education': 'Education',
  'subWallets.medical': 'Medical',
  'subWallets.holiday': 'Holiday',
  'subWallets.retirement': 'Retirement',
  'subWallets.goal': 'Goal',
  'subWallets.goalReached': 'of goal reached',

  // Transactions
  'transactions.title': 'Recent Transactions',
  'transactions.sent': 'Sent',
  'transactions.received': 'Received',
  'transactions.bill': 'Bill Payment',
  'transactions.school': 'School Fees',
  'transactions.save': 'Savings',

  // Save As You Spend
  'says.title': 'Save-As-You-Spend',
  'says.description': 'Automatically save 5% of every transaction to your retirement and education wallets',
  'says.saved': "You've saved",
  'says.thisMonth': 'this month!',

  // FX Widget
  'fx.title': 'FX Rates',
  'fx.spread': 'Spread',
  'fx.fixedPeg': 'Fixed Peg',

  // Admin
  'admin.title': 'Admin Dashboard',
  'admin.subtitle': 'Rukisha Wallet Administration',
  'admin.backToWallet': 'Back to Wallet',
  'admin.checkingAccess': 'Checking admin access...',
  'admin.accessDenied': 'Access Denied',
  'admin.noPrivileges': 'You do not have admin privileges to access this dashboard.',
  'admin.totalUsers': 'Total Users',
  'admin.transactions': 'Transactions',
  'admin.loanApplications': 'Loan Applications',
  'admin.flaggedItems': 'Flagged Items',
  'admin.agents': 'Agents',
  'admin.diaspora': 'Diaspora',
  'admin.accounting': 'Accounting',
  'admin.users': 'Users',
  'admin.loans': 'Loans',
  'admin.compliance': 'Compliance',
  'admin.analytics': 'Analytics',
  'admin.regulatory': 'Regulatory',
  'admin.fees': 'Fees',

  // Accounting
  'accounting.title': 'Accounting & GL Management',
  'accounting.subtitle': 'Production-grade wallet transaction posting, chart of accounts, journal entries, and core banking integration',
  'accounting.coa': 'Chart of Accounts',
  'accounting.glMapping': 'GL Mapping',
  'accounting.journalEntries': 'Journal Entries',
  'accounting.poolGLs': 'Pool GLs',
  'accounting.corePosting': 'Core Posting',
  'accounting.reconciliation': 'Reconciliation',
  'accounting.feeSchedules': 'Fee Schedules',

  // Country Compliance
  'compliance.regulatoryFramework': 'Regulatory Framework',
  'compliance.governingRule': 'Governing Rule',
  'compliance.sanctionsBody': 'Sanctions Body',
  'compliance.reportingFrequency': 'Reporting Frequency',
  'compliance.kycTierLimits': 'KYC Tier Limits',
  'compliance.kycTierDesc': 'Transaction limits per KYC verification level',
  'compliance.tier1': 'Tier 1 (Basic)',
  'compliance.tier1Desc': 'Phone number only',
  'compliance.tier2': 'Tier 2 (Standard)',
  'compliance.tier3': 'Tier 3 (Enhanced)',
  'compliance.tier3Desc': 'Full ID + address proof',
  'compliance.amlThreshold': 'AML Reporting Threshold',
  'compliance.amlDesc': 'All transactions exceeding this amount trigger automatic STR (Suspicious Transaction Report) to',
  'compliance.taxConfig': 'Tax Configuration',
  'compliance.taxType': 'Tax Type',
  'compliance.rate': 'Rate',
  'compliance.applicable': 'Applicable',
  'compliance.mobileMoneyProviders': 'Mobile Money Providers',
  'compliance.licensedOperators': 'Licensed mobile money operators in',
  'compliance.provider': 'Provider',
  'compliance.code': 'Code',
  'compliance.ussd': 'USSD',
  'compliance.settlementBank': 'Settlement Bank',
  'compliance.settlementBanks': 'Settlement Banks',

  // Country Fees
  'countryFees.feeSchedule': 'Fee Schedule',
  'countryFees.feeOverrides': 'Country-specific fee overrides in',
  'countryFees.feeRules': 'Fee Rules',
  'countryFees.exciseDuty': 'Excise Duty',
  'countryFees.withholdingTax': 'Withholding Tax',
  'countryFees.transactionType': 'Transaction Type',
  'countryFees.localName': 'Local Name',
  'countryFees.model': 'Model',
  'countryFees.fee': 'Fee',
  'countryFees.minMax': 'Min / Max',
  'countryFees.crossCountry': 'Cross-Country Fee Comparison',
  'countryFees.diasporaComparison': 'Diaspora Remittance fee comparison across all tenants',
  'countryFees.country': 'Country',
  'countryFees.baseFee': 'Base Fee',
  'countryFees.maxFee': 'Max Fee',
  'countryFees.current': 'Current',
  'countryFees.fxRates': 'FX Rates',
  'countryFees.fxApplicable': 'Exchange rates applicable for',
};

const fr: TranslationDict = {
  // Common
  'common.search': 'Rechercher',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.close': 'Fermer',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.submit': 'Soumettre',
  'common.loading': 'Chargement...',
  'common.viewAll': 'Tout voir',
  'common.status': 'Statut',
  'common.active': 'Actif',
  'common.pending': 'En attente',
  'common.completed': 'Terminé',
  'common.failed': 'Échoué',
  'common.configure': 'Configurer',
  'common.create': 'Créer',
  'common.edit': 'Modifier',
  'common.delete': 'Supprimer',
  'common.logout': 'Déconnexion',
  'common.settings': 'Paramètres',
  'common.notifications': 'Notifications',

  // Auth
  'auth.login': 'Connexion',
  'auth.signup': 'Inscription',
  'auth.loggedOut': 'Déconnexion réussie',
  'auth.loggedOutDesc': 'Vous avez été déconnecté de votre compte.',

  // Wallet Header
  'wallet.welcomeBack': 'Bon retour',
  'wallet.manageFinances': 'Gérez vos finances intelligemment',
  'wallet.equityDiaspora': 'Equity Bank - Connexion Diaspora',

  // Wallet Card
  'wallet.mainWallet': 'Portefeuille Principal',
  'wallet.availableBalance': 'Solde Disponible',
  'wallet.quickDeposit': 'Dépôt Rapide',

  // Quick Actions
  'quickActions.title': 'Actions Rapides',
  'quickActions.getLoan': 'Obtenir un Prêt',
  'quickActions.getLoanDesc': 'Demander un prêt',
  'quickActions.moveMoney': 'Transférer',
  'quickActions.moveMoneyDesc': 'Entre portefeuilles',
  'quickActions.sendMoney': 'Envoyer',
  'quickActions.sendMoneyDesc': 'Vers un tiers',
  'quickActions.cashIn': 'Dépôt',
  'quickActions.cashInDesc': 'Dépôt chez un agent',
  'quickActions.cashOut': 'Retrait',
  'quickActions.cashOutDesc': 'GAB ou agent',
  'quickActions.payBills': 'Payer Factures',
  'quickActions.payBillsDesc': 'Services & utilités',
  'quickActions.qrPay': 'Payer par QR',
  'quickActions.qrPayDesc': 'Scanner & payer',
  'quickActions.save': 'Épargner',
  'quickActions.saveDesc': 'Ajouter à l\'épargne',
  'quickActions.virtualCard': 'Carte Virtuelle',
  'quickActions.virtualCardDesc': 'Gérer les cartes',
  'quickActions.linkDebit': 'Lier Carte Débit',
  'quickActions.linkDebitDesc': 'Accès GAB & agent',
  'quickActions.intlCard': 'Carte Intl',
  'quickActions.intlCardDesc': 'Cartes diaspora',
  'quickActions.mobileMoney': 'Mobile Money',
  'quickActions.mobileMoneyDesc': 'Recharger mobile money',
  'quickActions.bankTransfer': 'Virement Bancaire',
  'quickActions.bankTransferDesc': 'Envoyer au compte bancaire',
  'quickActions.schoolFees': 'Frais Scolaires',
  'quickActions.schoolFeesDesc': 'Payer les frais de scolarité',
  'quickActions.findAgents': 'Trouver Agents',
  'quickActions.findAgentsDesc': 'Localiser les agents proches',
  'quickActions.diaspora': 'Diaspora',
  'quickActions.diasporaDesc': 'Services aux travailleurs',
  'quickActions.loanProducts': 'Produits de Prêt',

  // Sub Wallets
  'subWallets.title': 'Sous-Portefeuilles',
  'subWallets.addWallet': 'Ajouter',
  'subWallets.education': 'Éducation',
  'subWallets.medical': 'Médical',
  'subWallets.holiday': 'Vacances',
  'subWallets.retirement': 'Retraite',
  'subWallets.goal': 'Objectif',
  'subWallets.goalReached': 'de l\'objectif atteint',

  // Transactions
  'transactions.title': 'Transactions Récentes',
  'transactions.sent': 'Envoyé',
  'transactions.received': 'Reçu',
  'transactions.bill': 'Paiement de facture',
  'transactions.school': 'Frais scolaires',
  'transactions.save': 'Épargne',

  // Save As You Spend
  'says.title': 'Épargnez-en-Dépensant',
  'says.description': 'Épargnez automatiquement 5% de chaque transaction vers vos portefeuilles retraite et éducation',
  'says.saved': 'Vous avez épargné',
  'says.thisMonth': 'ce mois-ci !',

  // FX Widget
  'fx.title': 'Taux de Change',
  'fx.spread': 'Écart',
  'fx.fixedPeg': 'Parité Fixe',

  // Admin
  'admin.title': 'Tableau de Bord Admin',
  'admin.subtitle': 'Administration du Portefeuille Rukisha',
  'admin.backToWallet': 'Retour au Portefeuille',
  'admin.checkingAccess': 'Vérification de l\'accès admin...',
  'admin.accessDenied': 'Accès Refusé',
  'admin.noPrivileges': 'Vous n\'avez pas les privilèges administrateur pour accéder à ce tableau de bord.',
  'admin.totalUsers': 'Utilisateurs Totaux',
  'admin.transactions': 'Transactions',
  'admin.loanApplications': 'Demandes de Prêt',
  'admin.flaggedItems': 'Éléments Signalés',
  'admin.agents': 'Agents',
  'admin.diaspora': 'Diaspora',
  'admin.accounting': 'Comptabilité',
  'admin.users': 'Utilisateurs',
  'admin.loans': 'Prêts',
  'admin.compliance': 'Conformité',
  'admin.analytics': 'Analytique',
  'admin.regulatory': 'Réglementaire',
  'admin.fees': 'Frais',

  // Accounting
  'accounting.title': 'Comptabilité & Gestion du Grand Livre',
  'accounting.subtitle': 'Comptabilisation des transactions de portefeuille, plan comptable, écritures et intégration bancaire',
  'accounting.coa': 'Plan Comptable',
  'accounting.glMapping': 'Mapping GL',
  'accounting.journalEntries': 'Écritures',
  'accounting.poolGLs': 'GLs de Pool',
  'accounting.corePosting': 'Comptabilisation Core',
  'accounting.reconciliation': 'Rapprochement',
  'accounting.feeSchedules': 'Barèmes de Frais',

  // Country Compliance
  'compliance.regulatoryFramework': 'Cadre Réglementaire',
  'compliance.governingRule': 'Règle Applicable',
  'compliance.sanctionsBody': 'Organisme de Sanctions',
  'compliance.reportingFrequency': 'Fréquence de Reporting',
  'compliance.kycTierLimits': 'Limites KYC par Niveau',
  'compliance.kycTierDesc': 'Limites de transaction par niveau de vérification KYC',
  'compliance.tier1': 'Niveau 1 (Basique)',
  'compliance.tier1Desc': 'Numéro de téléphone uniquement',
  'compliance.tier2': 'Niveau 2 (Standard)',
  'compliance.tier3': 'Niveau 3 (Renforcé)',
  'compliance.tier3Desc': 'Pièce d\'identité + justificatif de domicile',
  'compliance.amlThreshold': 'Seuil de Déclaration LCB-FT',
  'compliance.amlDesc': 'Toute transaction dépassant ce montant déclenche automatiquement une DOS (Déclaration d\'Opération Suspecte) auprès du',
  'compliance.taxConfig': 'Configuration Fiscale',
  'compliance.taxType': 'Type d\'Impôt',
  'compliance.rate': 'Taux',
  'compliance.applicable': 'Applicable',
  'compliance.mobileMoneyProviders': 'Opérateurs Mobile Money',
  'compliance.licensedOperators': 'Opérateurs de mobile money agréés au',
  'compliance.provider': 'Opérateur',
  'compliance.code': 'Code',
  'compliance.ussd': 'USSD',
  'compliance.settlementBank': 'Banque de Règlement',
  'compliance.settlementBanks': 'Banques de Règlement',

  // Country Fees
  'countryFees.feeSchedule': 'Barème de Frais',
  'countryFees.feeOverrides': 'Frais spécifiques par pays en',
  'countryFees.feeRules': 'Règles de Frais',
  'countryFees.exciseDuty': 'Droit d\'Accise',
  'countryFees.withholdingTax': 'Retenue à la Source',
  'countryFees.transactionType': 'Type de Transaction',
  'countryFees.localName': 'Nom Local',
  'countryFees.model': 'Modèle',
  'countryFees.fee': 'Frais',
  'countryFees.minMax': 'Min / Max',
  'countryFees.crossCountry': 'Comparaison des Frais Inter-Pays',
  'countryFees.diasporaComparison': 'Comparaison des frais de transfert diaspora entre tous les pays',
  'countryFees.country': 'Pays',
  'countryFees.baseFee': 'Frais de Base',
  'countryFees.maxFee': 'Frais Max',
  'countryFees.current': 'Actuel',
  'countryFees.fxRates': 'Taux de Change',
  'countryFees.fxApplicable': 'Taux de change applicables pour',
};

const translations: Record<Locale, TranslationDict> = { en, fr };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('fr');

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = translations[locale][key] || translations['en'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
