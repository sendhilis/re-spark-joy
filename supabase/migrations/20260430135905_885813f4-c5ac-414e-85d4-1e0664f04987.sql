ALTER TABLE public.settlement_positions REPLICA IDENTITY FULL;
ALTER TABLE public.settlement_instructions REPLICA IDENTITY FULL;
ALTER TABLE public.settlement_confirmations REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_positions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_instructions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_confirmations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;