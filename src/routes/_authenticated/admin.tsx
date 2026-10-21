import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/cart";
import { useRoles, settingsQuery, defaultSettings, type Settings } from "@/lib/catalog";
import { listUsers, setUserRole } from "@/lib/admin.functions";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { StoreOrders } from "@/components/admin/StoreOrders";
import { NoAccess } from "./store";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Kash" },
      { name: "description", content: "Manage Kash customers, partners, products, orders and settings." },
      { property: "og:title", content: "Kash admin" },
      { property: "og:description", content: "Manage Kash customers, partners, products, orders and settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const tabs = ["Reports", "Orders", "Products", "People", "Coupons", "Settings"] as const;
type Tab = (typeof tabs)[number];
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Admin() {
  const { user } = useAuth();
  const roles = useRoles(user?.id);
  const [tab, setTab] = useState<Tab>("Reports");
  if (roles.isLoading) return <div className="mx-auto mt-8 max-w-xl px-4"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!roles.data?.includes("admin")) return <NoAccess what="admin" />;
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-16">
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{t}</button>)}
      </div>
      {tab === "Reports" && <Reports />}
      {tab === "Orders" && <StoreOrders showAll />}
      {tab === "Products" && <ProductsManager canDelete />}
      {tab === "People" && <People me={user!.id} />}
      {tab === "Coupons" && <Coupons />}
      {tab === "Settings" && <SettingsForm />}
    </main>
  );
}

function Reports() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ["report", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const { data, error } = await supabase.from("orders").select("total, status, created_at, lines, discount").gte("created_at", since).limit(5000);
      if (error) throw error;
      return data;
    },
  });
  const r = useMemo(() => {
    const rows = data ?? [];
    const ok = rows.filter((o) => o.status !== "cancelled");
    const sales = ok.reduce((s, o) => s + Number(o.total), 0);
    const byDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) byDay.set(new Date(Date.now() - i * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), 0);
    ok.forEach((o) => { const k = new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); if (byDay.has(k)) byDay.set(k, byDay.get(k)! + Number(o.total)); });
    const top = new Map<string, number>();
    ok.forEach((o) => (o.lines as { name: string; qty: number }[]).forEach((l) => top.set(l.name, (top.get(l.name) ?? 0) + l.qty)));
    return {
      sales, orders: rows.length, delivered: rows.filter((o) => o.status === "delivered").length, cancelled: rows.filter((o) => o.status === "cancelled").length,
      avg: ok.length ? sales / ok.length : 0, discounts: ok.reduce((s, o) => s + Number(o.discount), 0),
      byDay: [...byDay.entries()], top: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [data, days]);
  const max = Math.max(1, ...r.byDay.map(([, v]) => v));
  const stat = (label: string, v: string) => <div className="rounded-2xl bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-extrabold">{v}</p></div>;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1 text-sm ${days === d ? "bg-primary text-primary-foreground" : "bg-card"}`}>{d} days</button>)}</div>
      {isLoading ? <div className="skeleton h-40 rounded-2xl" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stat("Sales", inr(r.sales))}{stat("Orders", String(r.orders))}{stat("Average order", inr(r.avg))}
            {stat("Delivered", String(r.delivered))}{stat("Cancelled", String(r.cancelled))}{stat("Coupon discounts", inr(r.discounts))}
          </div>
          <section className="rounded-2xl bg-card p-4 shadow-card">
            <p className="mb-3 font-bold">Sales by day</p>
            <div className="flex h-40 items-end gap-1">
              {r.byDay.map(([d, v]) => (
                <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d}: ${inr(v)}`}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 1 }} />
                  {days <= 7 && <span className="text-[10px] text-muted-foreground">{d}</span>}
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl bg-card p-4 shadow-card">
            <p className="mb-2 font-bold">Top products</p>
            {r.top.length === 0 && <p className="text-sm text-muted-foreground">No sales yet.</p>}
            {r.top.map(([n, q]) => <p key={n} className="flex justify-between text-sm"><span>{n}</span><span className="font-semibold">{q} sold</span></p>)}
          </section>
        </>
      )}
    </div>
  );
}

function People({ me }: { me: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "rider" | "manager" | "admin">("all");
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const toggle = async (userId: string, role: "admin" | "manager" | "rider", on: boolean) => {
    try { await setRole({ data: { userId, role, on } }); toast.success(on ? `Made ${role}` : `Removed ${role}`); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const rows = (data ?? []).filter((u) => (only === "all" || u.roles.includes(only)) && (!q || `${u.email} ${u.name} ${u.phone}`.toLowerCase().includes(q.toLowerCase())));
  const label = { rider: "Delivery partner", manager: "Store manager", admin: "Admin" } as const;
  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name or phone" className={input} />
      <div className="flex gap-2 overflow-x-auto">
        {(["all", "rider", "manager", "admin"] as const).map((f) => <button key={f} onClick={() => setOnly(f)} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${only === f ? "bg-primary text-primary-foreground" : "bg-card"}`}>{f === "all" ? "Everyone" : label[f] + "s"}</button>)}
      </div>
      {isLoading && <div className="skeleton h-24 rounded-2xl" />}
      {rows.map((u) => (
        <div key={u.id} className="rounded-2xl bg-card p-4 text-sm shadow-card">
          <p className="font-bold">{u.name || u.email}</p>
          <p className="text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
          <p className="text-xs text-muted-foreground">{u.orders} orders · {inr(u.spent)} spent · joined {new Date(u.createdAt).toLocaleDateString("en-IN")}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["rider", "manager", "admin"] as const).map((r) => (
              <label key={r} className="flex items-center gap-1.5">
                <input type="checkbox" checked={u.roles.includes(r)} disabled={r === "admin" && u.id === me} onChange={(e) => toggle(u.id, r, e.target.checked)} />{label[r]}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Coupons() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["coupons"], queryFn: async () => (await supabase.from("coupons").select("*").order("created_at")).data ?? [] });
  const [f, setF] = useState({ code: "", pct: 10, max_off: 100, min_order: 0 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["coupons"] });
  const add = async () => {
    const code = f.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code) || f.pct <= 0 || f.pct > 100) { toast.error("Use 3–20 letters/numbers and a 1–100% discount"); return; }
    const { error } = await supabase.from("coupons").upsert({ code, pct: f.pct, max_off: f.max_off, min_order: f.min_order, active: true });
    if (error) toast.error("Could not save"); else { setF({ code: "", pct: 10, max_off: 100, min_order: 0 }); refresh(); }
  };
  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
        <p className="font-bold">Add coupon</p>
        <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CODE" className={input} />
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label>% off<input type="number" value={f.pct} onChange={(e) => setF({ ...f, pct: Number(e.target.value) })} className={input} /></label>
          <label>Max off ₹ (0 = no cap)<input type="number" value={f.max_off} onChange={(e) => setF({ ...f, max_off: Number(e.target.value) })} className={input} /></label>
          <label>Min order ₹<input type="number" value={f.min_order} onChange={(e) => setF({ ...f, min_order: Number(e.target.value) })} className={input} /></label>
        </div>
        <button onClick={add} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save coupon</button>
      </section>
      {data?.map((c) => (
        <div key={c.code} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
          <div className="min-w-0 flex-1"><p className="font-bold">{c.code}</p><p className="text-xs text-muted-foreground">{Number(c.pct)}% off · max {Number(c.max_off) ? inr(Number(c.max_off)) : "no cap"} · min {inr(Number(c.min_order))}</p></div>
          <button onClick={async () => { await supabase.from("coupons").update({ active: !c.active }).eq("code", c.code); refresh(); }} className={`rounded-lg px-2 py-1 text-xs font-bold ${c.active ? "bg-success text-primary-foreground" : "bg-muted"}`}>{c.active ? "Active" : "Paused"}</button>
          <button onClick={async () => { if (confirm(`Delete ${c.code}?`)) { await supabase.from("coupons").delete().eq("code", c.code); refresh(); } }} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></button>
        </div>
      ))}
    </div>
  );
}

function SettingsForm() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [f, setF] = useState<Settings>(defaultSettings);
  useEffect(() => { if (data) setF(data); }, [data]);
  const num = (k: keyof Settings, label: string) => (
    <label className="text-sm">{label}<input type="number" value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} className={input} /></label>
  );
  const save = async () => {
    if (f.open_hour < 0 || f.open_hour > 23 || f.close_hour < 1 || f.close_hour > 24 || f.close_hour <= f.open_hour) { toast.error("Check delivery hours (0–24, close after open)"); return; }
    const { error } = await supabase.from("settings").update({
      delivery_fee: f.delivery_fee, packaging: f.packaging, tax_pct: f.tax_pct, min_order: f.min_order, open_hour: f.open_hour,
      close_hour: f.close_hour, max_km: f.max_km, areas: f.areas.slice(0, 500), eta: f.eta, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast.error("Could not save"); else { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); }
  };
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
      <p className="font-bold">Fees</p>
      <div className="grid grid-cols-2 gap-2">{num("delivery_fee", "Delivery fee ₹")}{num("packaging", "Packaging ₹")}{num("tax_pct", "Tax %")}{num("min_order", "Minimum order ₹")}</div>
      <p className="font-bold">Delivery hours (India time, 24h)</p>
      <div className="grid grid-cols-2 gap-2">{num("open_hour", "Opens at (hour)")}{num("close_hour", "Closes at (hour, 24 = midnight)")}</div>
      <p className="font-bold">Delivery area</p>
      <div className="grid grid-cols-2 gap-2">{num("max_km", "Max distance from store (km)")}{num("eta", "Typical delivery time (min)")}</div>
      <label className="block text-sm">Areas we serve (shown to customers)<textarea rows={2} value={f.areas} onChange={(e) => setF({ ...f, areas: e.target.value })} className={input} /></label>
      <button onClick={save} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save settings</button>
    </section>
  );
}
