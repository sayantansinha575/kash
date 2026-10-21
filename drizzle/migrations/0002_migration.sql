CREATE TYPE public.app_role AS ENUM ('admin', 'rider');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.orders
  ADD COLUMN rider_id uuid,
  ADD COLUMN stage integer NOT NULL DEFAULT 0,
  ADD COLUMN rider_lat double precision,
  ADD COLUMN rider_lng double precision,
  ADD COLUMN rider_at timestamptz,
  ADD COLUMN id_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN delivered_at timestamptz;

CREATE POLICY "riders read" ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'rider') AND ((status = 'active' AND rider_id IS NULL) OR rider_id = auth.uid()));

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

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;