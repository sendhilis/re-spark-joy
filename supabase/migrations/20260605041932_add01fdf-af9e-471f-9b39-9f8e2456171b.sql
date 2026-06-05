DELETE FROM public.settlement_positions WHERE position_date = CURRENT_DATE;
DELETE FROM public.settlement_dispatches WHERE scheduled_at::date >= CURRENT_DATE AND status = 'scheduled';