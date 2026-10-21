import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Dish, Option } from "@/lib/data";
import r1 from "@/assets/r1.jpg";
import r2 from "@/assets/r2.jpg";
import r3 from "@/assets/r3.jpg";
import r4 from "@/assets/r4.jpg";

export const localImages: Record<string, string> = { r1, r2, r3, r4 };

export type ProductRow = {
  id: string; name: string; description: string; price: number; category: string; menthol: boolean;
  available: boolean; image_url: string | null; image_key: string | null; sizes: unknown; extras: unknown; sort: number;
};
export type Settings = {
  delivery_fee: number; packaging: number; tax_pct: number; min_order: number;
  open_hour: number; close_hour: number; max_km: number; areas: string; eta: number;
};

export const imageOf = (p: { image_url: string | null; image_key: string | null }) => p.image_url || localImages[p.image_key ?? ""] || r1;

export const toDish = (p: ProductRow): Dish => {
  const sizes = (p.sizes as Option[]) ?? [];
  const extras = (p.extras as Option[]) ?? [];
  return {
    id: p.id, name: p.name, desc: p.description, price: Number(p.price), veg: p.menthol, category: p.category,
    available: p.available, image: imageOf(p), ...(sizes.length ? { sizes } : {}), ...(extras.length ? { extras } : {}),
  };
};

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").order("sort").order("name");
    if (error) throw error;
    return data as ProductRow[];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data as Settings | null;
  },
});

export const defaultSettings: Settings = { delivery_fee: 19, packaging: 20, tax_pct: 5, min_order: 99, open_hour: 8, close_hour: 24, max_km: 8, areas: "", eta: 20 };
export const useSettings = () => useQuery(settingsQuery).data ?? defaultSettings;

const h = (n: number) => (n === 0 || n === 24 ? "12am" : n === 12 ? "12pm" : n < 12 ? `${n}am` : `${n - 12}pm`);
export const hoursLabel = (s: Settings) => `${h(s.open_hour)} – ${h(s.close_hour)}`;

// India time hour; open if open_hour <= hour < close_hour.
export const isOpenNow = (s: Settings, now = new Date()) => {
  const hr = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes() + 330) / 60) % 24;
  return hr >= s.open_hour && hr < s.close_hour;
};

export function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

export const useRoles = (userId: string | undefined) => useQuery({
  queryKey: ["my-roles", userId],
  enabled: !!userId,
  queryFn: async () => ((await supabase.from("user_roles").select("role").eq("user_id", userId!)).data ?? []).map((r) => r.role as string),
});
