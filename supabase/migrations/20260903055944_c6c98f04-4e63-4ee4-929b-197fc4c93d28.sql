-- 1. Ledger types for sweep-generated entries
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'mastercard_sweep';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'salary_credit';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'loan_repayment';