-- Lipafo Switch Engine tables
create table if not exists public.lipafo_transactions (
  id                 uuid primary key,
  idempotency_key    text unique not null,
  state              text not null default 'INITIATED',
  ltr                text,
  sender_phone       text not null,
  sender_bank        text not null,
  receiver_phone     text not null,
  receiver_bank      text not null,
  receiver_name      text,
  amount_cents       bigint not null,
  currency           text not null default 'KES',
  fraud_score        numeric(4,3) default 0,
  latency_ms         integer,
  error_code         text,
  debit_ref          text,
  credit_ref         text,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_lipafo_txn_state         on public.lipafo_transactions(state);
create index if not exists idx_lipafo_txn_created       on public.lipafo_transactions(created_at desc);
create index if not exists idx_lipafo_txn_sender_bank   on public.lipafo_transactions(sender_bank);
create index if not exists idx_lipafo_txn_receiver_bank on public.lipafo_transactions(receiver_bank);

create table if not exists public.lipafo_positions (
  id              text primary key,
  date            date not null,
  sending_bank    text not null,
  receiving_bank  text not null,
  net_cents       numeric(20,2) not null default 0,
  updated_at      timestamptz not null default now()
);
create index if not exists idx_lipafo_pos_date on public.lipafo_positions(date desc);

create table if not exists public.lipafo_alias_registry (
  phone          text primary key,
  bank_code      text not null,
  account_name   text not null,
  account_ref    text,
  lmid           text,
  entity_type    text default 'INDIVIDUAL',
  is_active      boolean default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

insert into public.lipafo_alias_registry (phone, bank_code, account_name, account_ref, entity_type)
values
  ('0722000001', 'KCB',    'Jane Wanjiku',           'KCB-001',  'INDIVIDUAL'),
  ('0722000002', 'COOP',   'Mama Mboga Supermarket', 'COOP-001', 'MERCHANT'),
  ('0722000003', 'EQUITY', 'John Kamau',             'EQ-001',   'INDIVIDUAL'),
  ('0722000004', 'ABSA',   'Wairimu Holdings Ltd',   'ABSA-001', 'CORPORATE'),
  ('0722000005', 'FAMILY', 'Mwangi Traders',         'FAM-001',  'MERCHANT')
on conflict (phone) do nothing;

alter table public.lipafo_transactions    enable row level security;
alter table public.lipafo_positions       enable row level security;
alter table public.lipafo_alias_registry  enable row level security;

create policy "Admins manage lipafo transactions"
  on public.lipafo_transactions for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins manage lipafo positions"
  on public.lipafo_positions for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins manage lipafo aliases"
  on public.lipafo_alias_registry for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Authenticated can read aliases"
  on public.lipafo_alias_registry for select to authenticated using (true);

alter table public.lipafo_transactions  replica identity full;
alter table public.lipafo_positions     replica identity full;
alter publication supabase_realtime add table public.lipafo_transactions;
alter publication supabase_realtime add table public.lipafo_positions;