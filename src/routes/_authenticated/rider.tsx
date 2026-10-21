import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bike, MapPin, Navigation, Phone, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/cart";
import { VoiceCall, isRinging } from "@/components/VoiceCall";
import { acceptOrder, advanceOrder, shareLocation, LAST_STAGE } from "@/lib/rider.functions";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({
    meta: [
      { title: "Delivery partner — Kash" },
      { name: "description", content: "Accept deliveries, update status and share your location." },
      { property: "og:title", content: "Kash delivery partner" },
      { property: "og:description", content: "Accept deliveries, update status and share your location." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Rider,
});

const nextLabel = ["", "Start packing", "Order ready", "Picked up", "On the way", "Arriving soon", "Delivered"];
const stageName = ["Placed", "Accepted", "Packing", "Ready", "Picked up", "On the way", "Arriving", "Delivered"];
const REJ = "kash-rider-rejected";

function Rider() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const accept = useServerFn(acceptOrder);
  const advance = useServerFn(advanceOrder);
  const share = useServerFn(shareLocation);
  const [rejected, setRejected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [idOk, setIdOk] = useState<Record<string, boolean>>({});
  const last = useRef(0);

  useEffect(() => { try { setRejected(JSON.parse(localStorage.getItem(REJ) || "[]")); } catch { /* ignore */ } }, []);

  const role = useQuery({
    queryKey: ["is-rider", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.rpc("has_role", { _user_id: user!.id, _role: "rider" })).data ?? false,
  });

  const orders = useQuery({
    queryKey: ["rider-orders"],
    enabled: role.data === true,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, lines, total, address, instructions, lat, lng, stage, status, rider_id, created_at, call_at, call_from, store_ok").in("status", ["active", "delivered"]).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!sharing) return;
    if (!navigator.geolocation) { toast.error("Location not supported on this device"); setSharing(false); return; }
    const w = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last.current < 8000) return;
        last.current = Date.now();
        share({ data: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {});
      },
      () => { toast.error("Allow location access to share your position"); setSharing(false); },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [sharing, share]);

  if (role.isLoading) return <div className="mx-auto mt-8 max-w-xl px-4"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!role.data)
    return (
      <main className="mx-auto max-w-sm px-4 py-20 text-center">
        <Bike className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 text-2xl font-extrabold">Not a delivery partner yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account ({user?.email}) hasn't been approved as a delivery partner. Ask the Kash team to approve you.</p>
        <Link to="/" className="mt-4 inline-block font-bold text-primary">Back home</Link>
      </main>
    );

  const all = orders.data ?? [];
  const mine = all.filter((o) => o.rider_id === user?.id && o.status === "active");
  const available = all.filter((o) => !o.rider_id && o.store_ok && o.status === "active" && !rejected.includes(o.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["rider-orders"] });

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    setBusy(null);
  };
  const reject = (id: string) => { const r = [...rejected, id]; setRejected(r); localStorage.setItem(REJ, JSON.stringify(r)); };

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Deliveries</h1>
        <button onClick={() => setSharing(!sharing)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${sharing ? "bg-success text-primary-foreground" : "border bg-card"}`}>
          <Navigation className="h-4 w-4" />{sharing ? "Sharing location" : "Share location"}
        </button>
      </div>
      {mine.length > 0 && !sharing && <p className="rounded-xl bg-secondary p-3 text-sm">Turn on location sharing so customers can see you on the map.</p>}

      <section className="space-y-3">
        <h2 className="font-bold">Your active deliveries</h2>
        {mine.length === 0 && <p className="text-sm text-muted-foreground">None right now.</p>}
        {mine.map((o) => <MyOrder key={o.id} o={o} busy={busy === o.id} idOk={!!idOk[o.id]} setIdOk={(v) => setIdOk({ ...idOk, [o.id]: v })}
          onNext={() => run(o.id, () => advance({ data: { id: o.id, idChecked: !!idOk[o.id] } }), o.stage + 1 === LAST_STAGE ? "Marked delivered" : "Status updated")} />)}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">New requests</h2>
        {orders.isLoading && <div className="skeleton h-24 rounded-2xl" />}
        {!orders.isLoading && available.length === 0 && <p className="text-sm text-muted-foreground">No new orders. This list refreshes automatically.</p>}
        {available.map((o) => (
          <div key={o.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex justify-between font-bold"><span>#{o.id}</span><span>{inr(Number(o.total))}</span></div>
            <p className="mt-1 flex gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{o.address}</p>
            <p className="text-xs text-muted-foreground">{(o.lines as { qty: number; name: string }[]).map((l) => `${l.qty} × ${l.name}`).join(", ")}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => reject(o.id)} className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2.5 font-semibold"><X className="h-4 w-4" />Reject</button>
              <button disabled={busy === o.id} onClick={() => run(o.id, () => accept({ data: { id: o.id } }), "Order accepted")} className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-60">Accept</button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

type RO = { id: string; address: string; instructions: string; lat: number | null; lng: number | null; stage: number; total: number; lines: unknown; call_at: string | null; call_from: string | null };

function MyOrder({ o, busy, idOk, setIdOk, onNext }: { o: RO; busy: boolean; idOk: boolean; setIdOk: (v: boolean) => void; onNext: () => void }) {
  const cust = useQuery({
    queryKey: ["order-customer", o.id],
    queryFn: async () => (await supabase.rpc("order_customer", { _order_id: o.id })).data?.[0] ?? null,
  });
  const [call, setCall] = useState<{ ring: boolean } | null>(null);
  const incoming = !call && isRinging(o.call_at, o.call_from, "rider");
  const finalStep = o.stage + 1 === LAST_STAGE;
  const maps = o.lat && o.lng ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`;
  return (
    <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-card">
      <div className="flex justify-between font-bold"><span>#{o.id}</span><span className="text-primary">{stageName[o.stage]}</span></div>
      <p className="mt-1 text-sm">{cust.data?.full_name || "Customer"}</p>
      <p className="text-sm text-muted-foreground">{o.address}</p>
      {o.instructions && <p className="text-xs text-muted-foreground">Note: {o.instructions}</p>}
      <p className="mt-1 font-semibold">Collect {inr(Number(o.total))} cash</p>
      <div className="mt-2 flex gap-2 text-sm">
        <a href={maps} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold"><Navigation className="h-4 w-4" />Directions</a>
        <button onClick={() => setCall({ ring: true })} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold"><Phone className="h-4 w-4" />Call in app</button>
        {cust.data?.phone && <a href={`tel:${cust.data.phone}`} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold">Phone</a>}
      </div>
      {incoming && <button onClick={() => setCall({ ring: false })} className="mt-2 flex w-full animate-pulse items-center justify-center gap-2 rounded-xl bg-success py-3 font-bold text-primary-foreground"><Phone className="h-4 w-4" />Customer is calling — Answer</button>}
      {call && <VoiceCall orderId={o.id} ring={call.ring} otherName={cust.data?.full_name || "Customer"} onEnd={() => setCall(null)} />}
      {finalStep && (
        <label className="mt-3 flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm">
          <input type="checkbox" checked={idOk} onChange={(e) => setIdOk(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span><ShieldCheck className="mr-1 inline h-4 w-4" />I checked the customer's photo ID and they are 18 or older.</span>
        </label>
      )}
      <button disabled={busy || (finalStep && !idOk)} onClick={onNext} className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Updating…" : finalStep ? "Mark delivered" : nextLabel[o.stage]}
      </button>
    </div>
  );
}
