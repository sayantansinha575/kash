import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CartLine = {
  key: string; restaurantId: string; dishId: string; name: string; veg: boolean;
  unit: number; qty: number; notes: string[];
};
export type Order = {
  id: string; restaurantId: string; lines: CartLine[]; total: number; address: string;
  instructions: string; payment: "cod"; createdAt: number; status: "active" | "cancelled" | "delivered";
};

type Ctx = {
  lines: CartLine[];
  add: (l: Omit<CartLine, "key" | "qty">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = "kash-cart";

function merge(a: CartLine[], b: CartLine[]) {
  const m = new Map(a.map((l) => [l.key, l]));
  for (const l of b) { const h = m.get(l.key); m.set(l.key, h ? { ...h, qty: Math.max(h.qty, l.qty) } : l); }
  return [...m.values()];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
    setReady(true);
  }, []);

  // On sign-in, merge the account cart with the local one.
  useEffect(() => {
    if (!ready || !user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    supabase.from("carts").select("lines").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const remote = (data?.lines as CartLine[] | undefined) ?? [];
      setLines((local) => merge(remote, local));
    });
  }, [ready, user]);
  useEffect(() => { if (!user) syncedFor.current = null; }, [user]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(lines));
    if (!user || syncedFor.current !== user.id) return;
    const t = setTimeout(() => {
      supabase.from("carts").upsert({ user_id: user.id, lines, updated_at: new Date().toISOString() }).then(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [lines, ready, user]);

  const add: Ctx["add"] = (l) => setLines((prev) => {
    const key = `${l.dishId}|${l.notes.join(",")}`;
    const hit = prev.find((x) => x.key === key);
    if (hit) return prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
    return [...prev, { ...l, key, qty: 1 }];
  });
  const setQty = (key: string, qty: number) =>
    setLines((p) => (qty <= 0 ? p.filter((x) => x.key !== key) : p.map((x) => (x.key === key ? { ...x, qty } : x))));
  return <CartCtx.Provider value={{ lines, add, setQty, clear: () => setLines([]) }}>{children}</CartCtx.Provider>;
}

export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("CartProvider missing");
  return c;
};

export const loadOrders = (): Order[] => {
  try { return JSON.parse(localStorage.getItem("kash-orders") || "[]"); } catch { return []; }
};
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
