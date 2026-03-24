import { createContext, useContext, useState, ReactNode } from 'react';

export type TenantCountry = 'SN' | 'CI' | 'BF' | 'ML';

export interface MobileMoneyProvider {
  name: string;
  code: string;
  ussdPrefix: string;
  settlementBank: string;
}

export interface ComplianceRule {
  id: string;
  rule: string;
  regulator: string;
  description: string;
  kycTier1Limit: number;
  kycTier2Limit: number;
  kycTier3Limit: number;
  amlThreshold: number;
  reportingFrequency: string;
  sanctionsBody: string;
}

export interface TaxConfig {
  vatRate: number;
  vatName: string;
  exciseDutyRate: number;
  exciseDutyApplicable: boolean;
  withholdingTaxRate: number;
  digitalServicesTax: number;
  stampDuty: number;
}

export interface FXRate {
  pair: string;
  rate: number;
  inverseRate: number;
  spread: number;
  lastUpdated: string;
  source: string;
}

export interface CountryFeeOverride {
  transactionType: string;
  feeName: string;
  feeModel: 'flat' | 'percentage' | 'tiered' | 'hybrid';
  amount: number | null;
  percentage: number | null;
  minFee: number;
  maxFee: number;
  currency: string;
}

export interface TenantConfig {
  code: TenantCountry;
  name: string;
  nameLocal: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  currencyName: string;
  secondaryCurrency: string;
  locale: string;
  language: string;
  timezone: string;
  dialCode: string;
  phoneFormat: string;
  capital: string;
  centralBank: string;
  regulatoryBody: string;
  financialIntelligenceUnit: string;
  mobileMoneyProviders: MobileMoneyProvider[];
  compliance: ComplianceRule;
  taxes: TaxConfig;
  fxRates: FXRate[];
  feeOverrides: CountryFeeOverride[];
  settlementBanks: string[];
  nationalIdName: string;
  nationalIdFormat: string;
  populationEstimate: string;
  gdpPerCapita: string;
  financialInclusionRate: string;
  interoperabilityScheme: string;
}

// All 4 countries use XOF (West African CFA Franc) pegged to EUR at 655.957
const XOF_USD_RATE = 605.42;
const XOF_EUR_RATE = 655.957; // Fixed peg

const baseFXRates: FXRate[] = [
  { pair: 'XOF/USD', rate: XOF_USD_RATE, inverseRate: 1 / XOF_USD_RATE, spread: 1.2, lastUpdated: '2026-03-24T08:00:00Z', source: 'BCEAO Reference Rate' },
  { pair: 'XOF/EUR', rate: XOF_EUR_RATE, inverseRate: 1 / XOF_EUR_RATE, spread: 0.0, lastUpdated: '2026-03-24T08:00:00Z', source: 'CFA Franc Fixed Peg' },
  { pair: 'USD/EUR', rate: 0.923, inverseRate: 1.083, spread: 0.5, lastUpdated: '2026-03-24T08:00:00Z', source: 'ECB Reference Rate' },
];

export const TENANT_CONFIGS: Record<TenantCountry, TenantConfig> = {
  SN: {
    code: 'SN',
    name: 'Senegal',
    nameLocal: 'Sénégal',
    flag: '🇸🇳',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    currencyName: 'West African CFA Franc',
    secondaryCurrency: 'USD',
    locale: 'fr-SN',
    language: 'Français',
    timezone: 'Africa/Dakar',
    dialCode: '+221',
    phoneFormat: 'XX XXX XX XX',
    capital: 'Dakar',
    centralBank: 'BCEAO',
    regulatoryBody: 'Ministère des Finances et du Budget',
    financialIntelligenceUnit: 'CENTIF Sénégal',
    mobileMoneyProviders: [
      { name: 'Orange Money', code: 'OM_SN', ussdPrefix: '#144#', settlementBank: 'BICIS' },
      { name: 'Wave', code: 'WAVE_SN', ussdPrefix: '*1#', settlementBank: 'CBAO' },
      { name: 'Free Money', code: 'FREE_SN', ussdPrefix: '#555#', settlementBank: 'SG Sénégal' },
      { name: 'E-Money (Tigo)', code: 'EMONEY_SN', ussdPrefix: '#222#', settlementBank: 'Ecobank' },
    ],
    compliance: {
      id: 'COMP-SN-001',
      rule: 'BCEAO Instruction N°008-05-2015',
      regulator: 'BCEAO / CENTIF',
      description: 'E-money and mobile financial services regulation under WAEMU framework',
      kycTier1Limit: 200000,
      kycTier2Limit: 2000000,
      kycTier3Limit: 10000000,
      amlThreshold: 5000000,
      reportingFrequency: 'Monthly to BCEAO, Quarterly to CENTIF',
      sanctionsBody: 'GIABA (ECOWAS)',
    },
    taxes: {
      vatRate: 18,
      vatName: 'TVA (Taxe sur la Valeur Ajoutée)',
      exciseDutyRate: 5,
      exciseDutyApplicable: true,
      withholdingTaxRate: 5,
      digitalServicesTax: 0,
      stampDuty: 0,
    },
    fxRates: baseFXRates,
    feeOverrides: [
      { transactionType: 'P2P Transfer', feeName: 'Transfert P2P', feeModel: 'tiered', amount: null, percentage: null, minFee: 0, maxFee: 2000, currency: 'XOF' },
      { transactionType: 'Bill Payment', feeName: 'Paiement de Facture', feeModel: 'flat', amount: 200, percentage: null, minFee: 200, maxFee: 200, currency: 'XOF' },
      { transactionType: 'Cash-Out Agent', feeName: 'Retrait Agent', feeModel: 'tiered', amount: null, percentage: null, minFee: 100, maxFee: 3000, currency: 'XOF' },
      { transactionType: 'Diaspora Remittance', feeName: 'Transfert Diaspora', feeModel: 'hybrid', amount: 500, percentage: 0.5, minFee: 500, maxFee: 15000, currency: 'XOF' },
      { transactionType: 'FX Conversion', feeName: 'Conversion Devises', feeModel: 'percentage', amount: null, percentage: 1.2, minFee: 0, maxFee: 0, currency: 'XOF' },
    ],
    settlementBanks: ['BICIS (BNP Paribas)', 'CBAO (Attijariwafa)', 'Société Générale Sénégal', 'Ecobank Sénégal', 'Bank of Africa Sénégal'],
    nationalIdName: 'Carte Nationale d\'Identité (CNI)',
    nationalIdFormat: 'X XXXX XXXX XXXXX',
    populationEstimate: '18.3M',
    gdpPerCapita: '$1,606',
    financialInclusionRate: '42%',
    interoperabilityScheme: 'GIM-UEMOA',
  },
  CI: {
    code: 'CI',
    name: 'Ivory Coast',
    nameLocal: 'Côte d\'Ivoire',
    flag: '🇨🇮',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    currencyName: 'West African CFA Franc',
    secondaryCurrency: 'USD',
    locale: 'fr-CI',
    language: 'Français',
    timezone: 'Africa/Abidjan',
    dialCode: '+225',
    phoneFormat: 'XX XX XX XX XX',
    capital: 'Abidjan (economic) / Yamoussoukro (political)',
    centralBank: 'BCEAO',
    regulatoryBody: 'ARTCI (Autorité de Régulation des Télécommunications)',
    financialIntelligenceUnit: 'CENTIF Côte d\'Ivoire',
    mobileMoneyProviders: [
      { name: 'MTN Mobile Money', code: 'MTN_CI', ussdPrefix: '*133#', settlementBank: 'SIB' },
      { name: 'Orange Money', code: 'OM_CI', ussdPrefix: '#144#', settlementBank: 'SGBCI' },
      { name: 'Moov Money', code: 'MOOV_CI', ussdPrefix: '*155#', settlementBank: 'Ecobank' },
      { name: 'Wave', code: 'WAVE_CI', ussdPrefix: '*1#', settlementBank: 'BICICI' },
    ],
    compliance: {
      id: 'COMP-CI-001',
      rule: 'BCEAO Instruction N°008-05-2015 + Loi 2016-412',
      regulator: 'BCEAO / ARTCI',
      description: 'E-money regulation under WAEMU with ARTCI telecom oversight',
      kycTier1Limit: 200000,
      kycTier2Limit: 2000000,
      kycTier3Limit: 15000000,
      amlThreshold: 5000000,
      reportingFrequency: 'Monthly to BCEAO, Quarterly to CENTIF',
      sanctionsBody: 'GIABA (ECOWAS)',
    },
    taxes: {
      vatRate: 18,
      vatName: 'TVA (Taxe sur la Valeur Ajoutée)',
      exciseDutyRate: 7.2,
      exciseDutyApplicable: true,
      withholdingTaxRate: 7.5,
      digitalServicesTax: 0,
      stampDuty: 0,
    },
    fxRates: baseFXRates,
    feeOverrides: [
      { transactionType: 'P2P Transfer', feeName: 'Transfert P2P', feeModel: 'tiered', amount: null, percentage: null, minFee: 0, maxFee: 2500, currency: 'XOF' },
      { transactionType: 'Bill Payment', feeName: 'Paiement CIE/SODECI', feeModel: 'flat', amount: 250, percentage: null, minFee: 250, maxFee: 250, currency: 'XOF' },
      { transactionType: 'Cash-Out Agent', feeName: 'Retrait Agent', feeModel: 'tiered', amount: null, percentage: null, minFee: 150, maxFee: 3500, currency: 'XOF' },
      { transactionType: 'Diaspora Remittance', feeName: 'Transfert Diaspora', feeModel: 'hybrid', amount: 500, percentage: 0.6, minFee: 500, maxFee: 20000, currency: 'XOF' },
      { transactionType: 'FX Conversion', feeName: 'Conversion Devises', feeModel: 'percentage', amount: null, percentage: 1.0, minFee: 0, maxFee: 0, currency: 'XOF' },
    ],
    settlementBanks: ['SGBCI', 'BICICI (BNP Paribas)', 'Ecobank CI', 'SIB', 'Bank of Africa CI'],
    nationalIdName: 'Carte Nationale d\'Identité (CNI)',
    nationalIdFormat: 'CI XXXXXXXXX',
    populationEstimate: '29.4M',
    gdpPerCapita: '$2,549',
    financialInclusionRate: '41%',
    interoperabilityScheme: 'GIM-UEMOA',
  },
  BF: {
    code: 'BF',
    name: 'Burkina Faso',
    nameLocal: 'Burkina Faso',
    flag: '🇧🇫',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    currencyName: 'West African CFA Franc',
    secondaryCurrency: 'USD',
    locale: 'fr-BF',
    language: 'Français',
    timezone: 'Africa/Ouagadougou',
    dialCode: '+226',
    phoneFormat: 'XX XX XX XX',
    capital: 'Ouagadougou',
    centralBank: 'BCEAO',
    regulatoryBody: 'ARCEP Burkina Faso',
    financialIntelligenceUnit: 'CENTIF Burkina Faso',
    mobileMoneyProviders: [
      { name: 'Orange Money', code: 'OM_BF', ussdPrefix: '#144#', settlementBank: 'BOA Burkina' },
      { name: 'Moov Money', code: 'MOOV_BF', ussdPrefix: '*155#', settlementBank: 'Coris Bank' },
      { name: 'Mobicash', code: 'MOBI_BF', ussdPrefix: '*600#', settlementBank: 'UBA Burkina' },
    ],
    compliance: {
      id: 'COMP-BF-001',
      rule: 'BCEAO Instruction N°008-05-2015 + Loi 004-2015/CNT',
      regulator: 'BCEAO / ARCEP',
      description: 'WAEMU e-money framework with local ARCEP supervision',
      kycTier1Limit: 200000,
      kycTier2Limit: 1500000,
      kycTier3Limit: 10000000,
      amlThreshold: 5000000,
      reportingFrequency: 'Monthly to BCEAO, Quarterly to CENTIF',
      sanctionsBody: 'GIABA (ECOWAS)',
    },
    taxes: {
      vatRate: 18,
      vatName: 'TVA (Taxe sur la Valeur Ajoutée)',
      exciseDutyRate: 5,
      exciseDutyApplicable: true,
      withholdingTaxRate: 5,
      digitalServicesTax: 0,
      stampDuty: 1,
    },
    fxRates: baseFXRates,
    feeOverrides: [
      { transactionType: 'P2P Transfer', feeName: 'Transfert P2P', feeModel: 'tiered', amount: null, percentage: null, minFee: 0, maxFee: 1500, currency: 'XOF' },
      { transactionType: 'Bill Payment', feeName: 'Paiement SONABEL/ONEA', feeModel: 'flat', amount: 150, percentage: null, minFee: 150, maxFee: 150, currency: 'XOF' },
      { transactionType: 'Cash-Out Agent', feeName: 'Retrait Agent', feeModel: 'tiered', amount: null, percentage: null, minFee: 100, maxFee: 2500, currency: 'XOF' },
      { transactionType: 'Diaspora Remittance', feeName: 'Transfert Diaspora', feeModel: 'hybrid', amount: 500, percentage: 0.5, minFee: 500, maxFee: 12000, currency: 'XOF' },
      { transactionType: 'FX Conversion', feeName: 'Conversion Devises', feeModel: 'percentage', amount: null, percentage: 1.5, minFee: 0, maxFee: 0, currency: 'XOF' },
    ],
    settlementBanks: ['Coris Bank International', 'Bank of Africa Burkina', 'Ecobank Burkina', 'UBA Burkina', 'BSIC Burkina'],
    nationalIdName: 'CNIB (Carte Nationale d\'Identité Burkinabè)',
    nationalIdFormat: 'BXXXXXXXXX',
    populationEstimate: '23.3M',
    gdpPerCapita: '$831',
    financialInclusionRate: '33%',
    interoperabilityScheme: 'GIM-UEMOA',
  },
  ML: {
    code: 'ML',
    name: 'Mali',
    nameLocal: 'Mali',
    flag: '🇲🇱',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    currencyName: 'West African CFA Franc',
    secondaryCurrency: 'USD',
    locale: 'fr-ML',
    language: 'Français',
    timezone: 'Africa/Bamako',
    dialCode: '+223',
    phoneFormat: 'XX XX XX XX',
    capital: 'Bamako',
    centralBank: 'BCEAO',
    regulatoryBody: 'AMRTP (Autorité Malienne de Régulation)',
    financialIntelligenceUnit: 'CENTIF Mali',
    mobileMoneyProviders: [
      { name: 'Orange Money', code: 'OM_ML', ussdPrefix: '#144#', settlementBank: 'BDM-SA' },
      { name: 'Moov Money', code: 'MOOV_ML', ussdPrefix: '*155#', settlementBank: 'BMS-SA' },
      { name: 'Sama Money', code: 'SAMA_ML', ussdPrefix: '*500#', settlementBank: 'Ecobank Mali' },
    ],
    compliance: {
      id: 'COMP-ML-001',
      rule: 'BCEAO Instruction N°008-05-2015 + Ordonnance 2014-012',
      regulator: 'BCEAO / AMRTP',
      description: 'WAEMU e-money regulation with AMRTP telecom licensing',
      kycTier1Limit: 200000,
      kycTier2Limit: 1500000,
      kycTier3Limit: 8000000,
      amlThreshold: 5000000,
      reportingFrequency: 'Monthly to BCEAO, Quarterly to CENTIF',
      sanctionsBody: 'GIABA (ECOWAS)',
    },
    taxes: {
      vatRate: 18,
      vatName: 'TVA (Taxe sur la Valeur Ajoutée)',
      exciseDutyRate: 3,
      exciseDutyApplicable: true,
      withholdingTaxRate: 3,
      digitalServicesTax: 0,
      stampDuty: 0,
    },
    fxRates: baseFXRates,
    feeOverrides: [
      { transactionType: 'P2P Transfer', feeName: 'Transfert P2P', feeModel: 'tiered', amount: null, percentage: null, minFee: 0, maxFee: 1500, currency: 'XOF' },
      { transactionType: 'Bill Payment', feeName: 'Paiement EDM-SA', feeModel: 'flat', amount: 150, percentage: null, minFee: 150, maxFee: 150, currency: 'XOF' },
      { transactionType: 'Cash-Out Agent', feeName: 'Retrait Agent', feeModel: 'tiered', amount: null, percentage: null, minFee: 75, maxFee: 2000, currency: 'XOF' },
      { transactionType: 'Diaspora Remittance', feeName: 'Transfert Diaspora', feeModel: 'hybrid', amount: 500, percentage: 0.5, minFee: 500, maxFee: 10000, currency: 'XOF' },
      { transactionType: 'FX Conversion', feeName: 'Conversion Devises', feeModel: 'percentage', amount: null, percentage: 1.5, minFee: 0, maxFee: 0, currency: 'XOF' },
    ],
    settlementBanks: ['BDM-SA', 'BMS-SA', 'Ecobank Mali', 'Bank of Africa Mali', 'Banque Atlantique Mali'],
    nationalIdName: 'NINA (Numéro d\'Identification Nationale)',
    nationalIdFormat: 'XXXXXXXXXXXX',
    populationEstimate: '23.0M',
    gdpPerCapita: '$879',
    financialInclusionRate: '35%',
    interoperabilityScheme: 'GIM-UEMOA',
  },
};

interface TenantContextType {
  currentTenant: TenantCountry;
  setCurrentTenant: (tenant: TenantCountry) => void;
  config: TenantConfig;
  allTenants: TenantConfig[];
  formatCurrency: (amount: number, currency?: string) => string;
  convertToUSD: (amountXOF: number) => number;
  convertFromUSD: (amountUSD: number) => number;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<TenantCountry>('SN');
  const config = TENANT_CONFIGS[currentTenant];
  const allTenants = Object.values(TENANT_CONFIGS);

  const formatCurrency = (amount: number, currency?: string) => {
    const cur = currency || config.currency;
    if (cur === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`;
  };

  const convertToUSD = (amountXOF: number) => amountXOF / XOF_USD_RATE;
  const convertFromUSD = (amountUSD: number) => amountUSD * XOF_USD_RATE;

  return (
    <TenantContext.Provider value={{ currentTenant, setCurrentTenant, config, allTenants, formatCurrency, convertToUSD, convertFromUSD }}>
      {children}
    </TenantContext.Provider>
  );
}
