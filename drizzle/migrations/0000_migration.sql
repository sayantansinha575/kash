create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'Home',
  line text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;
create policy "own addresses" on public.addresses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.carts (
  user_id uuid primary key,
  lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.carts to authenticated;
grant all on public.carts to service_role;
alter table public.carts enable row level security;
create policy "own cart" on public.carts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.orders (
  id text primary key,
  user_id uuid not null,
  lines jsonb not null,
  item_total numeric not null,
  discount numeric not null default 0,
  delivery_fee numeric not null default 0,
  packaging numeric not null default 0,
  taxes numeric not null default 0,
  total numeric not null,
  coupon text,
  address text not null,
  instructions text not null default '',
  payment text not null default 'cod',
  status text not null default 'active',
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (auth.uid() = user_id);
create index orders_user_idx on public.orders(user_id, created_at desc);