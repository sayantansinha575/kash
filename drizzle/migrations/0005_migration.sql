CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'manager'))
$$;

CREATE TABLE public.products (
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
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update products" ON public.products FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.coupons (
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
CREATE POLICY "admin coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.settings (
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
CREATE POLICY "settings public read" ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin update settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders ADD COLUMN store_ok boolean NOT NULL DEFAULT false;
CREATE POLICY "staff read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "staff upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff update product photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-photos' AND public.is_staff(auth.uid()));