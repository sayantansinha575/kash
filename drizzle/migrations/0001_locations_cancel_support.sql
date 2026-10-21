alter table public.addresses add column lat double precision, add column lng double precision;
alter table public.orders add column lat double precision, add column lng double precision, add column cancelled_at timestamptz;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id text,
  topic text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "own tickets read" on public.support_tickets for select to authenticated using (auth.uid() = user_id);
create policy "own tickets insert" on public.support_tickets for insert to authenticated with check (auth.uid() = user_id and status = 'open' and char_length(message) between 5 and 1000 and char_length(topic) <= 60);