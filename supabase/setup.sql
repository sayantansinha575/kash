-- ==============================================================================
-- Kash App - Complete Supabase Setup & Migration Script
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'rider', 'manager');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. USER PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Trigger to create profile upon auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. USER ROLES & HELPER FUNCTIONS
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'manager'))
$$;

DO $$ BEGIN
  CREATE POLICY "admin read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. SAVED ADDRESSES
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Home',
  line text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own addresses" ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. CARTS (SYNCED ACROSS DEVICES)
CREATE TABLE IF NOT EXISTS public.carts (
  user_id uuid PRIMARY KEY,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own cart" ON public.carts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  lines jsonb NOT NULL,
  item_total numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  packaging numeric NOT NULL DEFAULT 0,
  taxes numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  coupon text,
  address text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  payment text NOT NULL DEFAULT 'cod',
  status text NOT NULL DEFAULT 'active',
  idempotency_key text UNIQUE,
  lat double precision,
  lng double precision,
  cancelled_at timestamptz,
  rider_id uuid,
  stage integer NOT NULL DEFAULT 0,
  rider_lat double precision,
  rider_lng double precision,
  rider_at timestamptz,
  id_checked boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  call_at timestamptz,
  call_from text,
  store_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "riders read" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'rider') AND ((status = 'active' AND rider_id IS NULL) OR rider_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "staff read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id, created_at desc);

-- Realtime publication for orders
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Helper RPCs for orders
CREATE OR REPLACE FUNCTION public.order_rider_name(_order_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name FROM public.orders o JOIN public.profiles p ON p.id = o.rider_id
  WHERE o.id = _order_id AND o.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.order_customer(_order_id text)
RETURNS TABLE(full_name text, phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.phone FROM public.orders o JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = _order_id AND o.rider_id = auth.uid()
$$;

-- 7. SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id text,
  topic text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own tickets read" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "own tickets insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'open' AND char_length(message) BETWEEN 5 AND 1000 AND char_length(topic) <= 60);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. PRODUCTS CATALOG
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL CHECK (price >= 0),
  category text NOT NULL DEFAULT 'Regular',
  menthol boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  image_url text,
  image_key text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "staff insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "staff update products" ON public.products FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  code text PRIMARY KEY,
  pct numeric NOT NULL CHECK (pct > 0 AND pct <= 100),
  max_off numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 10. STORE SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  delivery_fee numeric NOT NULL DEFAULT 19,
  packaging numeric NOT NULL DEFAULT 20,
  tax_pct numeric NOT NULL DEFAULT 5,
  min_order numeric NOT NULL DEFAULT 99,
  open_hour integer NOT NULL DEFAULT 8 CHECK (open_hour BETWEEN 0 AND 23),
  close_hour integer NOT NULL DEFAULT 24 CHECK (close_hour BETWEEN 1 AND 24),
  max_km numeric NOT NULL DEFAULT 8,
  areas text NOT NULL DEFAULT 'Indiranagar, Domlur, HAL, Koramangala',
  eta integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO anon;
GRANT SELECT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "settings public read" ON public.settings FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "admin update settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Insert default row if not exists
INSERT INTO public.settings (id, delivery_fee, packaging, tax_pct, min_order, open_hour, close_hour, max_km, areas, eta)
VALUES (1, 19, 20, 5, 99, 8, 24, 8, 'Indiranagar, Domlur, HAL, Koramangala', 20)
ON CONFLICT (id) DO NOTHING;

-- 11. STORAGE BUCKET & POLICIES (product-photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "staff upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos' AND public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "staff update product photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-photos' AND public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "staff read product photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-photos' AND public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

