create extension if not exists pgcrypto;

create table if not exists public.balance_saves (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 30),
  memo text not null default '',
  state jsonb not null default '{"search":"","difficulty":"","type":"","sort":"name-asc"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monsters (
  id uuid primary key default gen_random_uuid(),
  balance_id uuid not null references public.balance_saves(id) on delete cascade,
  name text not null,
  type text not null,
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'boss')),
  hp integer not null check (hp > 0),
  damage integer not null default 0 check (damage >= 0),
  defense integer not null default 0 check (defense >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  speed double precision not null default 0 check (speed >= 0),
  spawn_rate double precision not null default 0 check (spawn_rate between 0 and 1),
  note text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade tables that were created with an earlier version of this schema.
alter table public.balance_saves add column if not exists memo text not null default '';
alter table public.balance_saves add column if not exists state jsonb not null default '{"search":"","difficulty":"","type":"","sort":"name-asc"}'::jsonb;
alter table public.balance_saves add column if not exists created_at timestamptz not null default now();
alter table public.balance_saves add column if not exists updated_at timestamptz not null default now();

alter table public.monsters add column if not exists balance_id uuid references public.balance_saves(id) on delete cascade;
alter table public.monsters add column if not exists type text;
alter table public.monsters add column if not exists damage integer not null default 0;
alter table public.monsters add column if not exists defense integer not null default 0;
alter table public.monsters add column if not exists xp_reward integer not null default 0;
alter table public.monsters add column if not exists speed double precision not null default 0;
alter table public.monsters add column if not exists spawn_rate double precision not null default 0;
alter table public.monsters add column if not exists note text not null default '';
alter table public.monsters add column if not exists deleted_at timestamptz;
alter table public.monsters add column if not exists created_at timestamptz not null default now();
alter table public.monsters add column if not exists updated_at timestamptz not null default now();

create index if not exists monsters_balance_id_idx on public.monsters(balance_id);
create index if not exists monsters_deleted_at_idx on public.monsters(deleted_at);

alter table public.balance_saves enable row level security;
alter table public.monsters enable row level security;

drop policy if exists "Public read balance saves" on public.balance_saves;
drop policy if exists "Public insert balance saves" on public.balance_saves;
drop policy if exists "Public update balance saves" on public.balance_saves;
drop policy if exists "Public delete balance saves" on public.balance_saves;
create policy "Public read balance saves" on public.balance_saves for select using (true);
create policy "Public insert balance saves" on public.balance_saves for insert with check (true);
create policy "Public update balance saves" on public.balance_saves for update using (true) with check (true);
create policy "Public delete balance saves" on public.balance_saves for delete using (true);

drop policy if exists "Public read monsters" on public.monsters;
drop policy if exists "Public insert monsters" on public.monsters;
drop policy if exists "Public update monsters" on public.monsters;
drop policy if exists "Public delete monsters" on public.monsters;
create policy "Public read monsters" on public.monsters for select using (true);
create policy "Public insert monsters" on public.monsters for insert with check (true);
create policy "Public update monsters" on public.monsters for update using (true) with check (true);
create policy "Public delete monsters" on public.monsters for delete using (true);
