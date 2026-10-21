import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useState } from "react";
import { Check, Phone, LifeBuoy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { loadOrders, inr, type Order } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { storeCoords } from "@/lib/data";
import { cancelOrder, STEP_MS } from "@/lib/orders.functions";
import { VoiceCall, isRinging } from "@/components/VoiceCall";

const TrackMap = lazy(() => import("@/components/TrackMap"));

export const Route = createFileRoute("/track/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Tracking order ${params.id} — Kash` },
      { name: "description", content: "Live status of your Kash order." },
      { property: "og:title", content: "Track your Kash order" },
      { property: "og:description", content: "Follow your order to your doorstep." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Track,
});

const steps = ["Order placed", "Partner assigned", "Packing your order", "Ready for pickup", "Picked up", "On the way", "Arriving soon", "Delivered"];
type O = Order & { lat: number | null; lng: number | null; stage: number | null; riderLat: number | null; riderLng: number | null; riderId: string | null; storeOk?: boolean; callAt?: string | null | undefined; callFrom?: string | null | undefined };
type Row = { id: string; lines: unknown; total: number; address: string; instructions: string; created_at: string; status: string; lat: number | null; lng: number | null; stage: number; rider_lat: number | null; rider_lng: number | null; rider_id: string | null; call_at?: string | null; call_from?: string | null; store_ok?: boolean };
const fromRow = (d: Row): O => ({ id: d.id, restaurantId: "kash", lines: d.lines as Order["lines"], total: Number(d.total), address: d.address, instructions: d.instructions, payment: "cod", createdAt: new Date(d.created_at).getTime(), status: d.status as Order["status"], lat: d.lat, lng: d.lng, stage: d.stage, riderLat: d.rider_lat, riderLng: d.rider_lng, riderId: d.rider_id, storeOk: d.store_ok ?? true, callAt: d.call_at, callFrom: d.call_from });

function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function Track() {
  const { id } = Route.useParams();
  const cancel = useServerFn(cancelOrder);
  const [order, setOrder] = useState<O | null | undefined>(undefined);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [call, setCall] = useState<{ ring: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!alive) return;
      if (data) setOrder(fromRow(data as Row));
      else { const o = loadOrders().find((x) => x.id === id); setOrder(o ? { ...o, lat: null, lng: null, stage: null, riderLat: null, riderLng: null, riderId: null } : null); }
    });
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (p) => { if (alive) setOrder(fromRow(p.new as Row)); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (!order?.riderId) return;
    supabase.rpc("order_rider_name", { _order_id: order.id }).then(({ data }) => setRiderName(data ?? null));
  }, [order?.riderId, order?.id]);

  const legacy = order ? order.stage === null : false;
  const cancelled = order?.status === "cancelled";
  const done = order ? cancelled || !legacy || Math.floor((now - order.createdAt) / STEP_MS) >= steps.length - 1 : false;
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done]);

  if (order === undefined) return <div className="mx-auto mt-8 max-w-xl px-4"><div className="skeleton h-72 rounded-2xl" /></div>;
  if (order === null)
    return <main className="py-24 text-center"><h1 className="text-2xl font-bold">Order not found</h1><Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link></main>;

  const step = legacy ? Math.min(Math.floor((now - order.createdAt) / STEP_MS), steps.length - 1) : Math.min(order.stage ?? 0, steps.length - 1);
  const home: [number, number] = order.lat && order.lng ? [order.lat, order.lng] : [storeCoords[0] + 0.012, storeCoords[1] + 0.01];
  const live = !legacy && order.riderLat != null && order.riderLng != null;
  const rider: [number, number] = live ? [order.riderLat!, order.riderLng!] : storeCoords;
  const delivered = step === steps.length - 1;
  const eta = step < 4 ? Math.ceil(10 + km(storeCoords, home) * 3) : Math.max(1, Math.ceil(km(rider, home) * 3));
  const canCancel = !cancelled && step < 4;
  const waiting = !legacy && !order.riderId;

  const doCancel = async () => {
    if (!confirm("Cancel this order?")) return;
    setCancelling(true);
    try { await cancel({ data: { id: order.id } }); setOrder({ ...order, status: "cancelled" }); toast.success("Order cancelled"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not cancel"); }
    setCancelling(false);
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-16">
      <div className={`rounded-2xl p-5 shadow-card ${cancelled ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
        <p className="text-sm opacity-90">Order #{order.id} · Keep your ID ready</p>
        <h1 className="text-2xl font-extrabold">{cancelled ? "Order cancelled" : delivered ? "Delivered" : !legacy && !order.storeOk ? "Waiting for the store to confirm…" : waiting ? "Finding a delivery partner…" : steps[step]}</h1>
        {!delivered && !cancelled && <p className="mt-1 font-semibold">Arriving in ~{eta} min</p>}
      </div>

      {!cancelled && !delivered && (
        <section className="relative overflow-hidden rounded-2xl shadow-card">
          {!live && step >= 4 && <span className="absolute left-3 top-3 z-[500] rounded-md bg-foreground px-2 py-0.5 text-xs font-bold text-background">Waiting for rider's location</span>}
          <ClientOnly fallback={<div className="skeleton h-64" />}>
            <Suspense fallback={<div className="skeleton h-64" />}>
              <TrackMap store={storeCoords} home={home} rider={rider} />
            </Suspense>
          </ClientOnly>
        </section>
      )}

      {(legacy ? step >= 2 : !!order.riderId) && !delivered && !cancelled && (
        <section className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary font-bold">{(riderName || "DP").slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{riderName || "Your delivery partner"}</p>
            <p className="truncate text-sm text-muted-foreground">Kash delivery partner</p>
          </div>
          <button onClick={() => legacy ? toast("Calling is available for new orders") : setCall({ ring: true })} className="flex shrink-0 items-center gap-1 rounded-xl bg-success px-3 py-2 text-sm font-bold text-primary-foreground"><Phone className="h-4 w-4" />Call</button>
        </section>
      )}

      {!call && !legacy && !cancelled && !delivered && isRinging(order.callAt, order.callFrom, "customer") && (
        <button onClick={() => setCall({ ring: false })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-success p-4 font-bold text-primary-foreground animate-pulse"><Phone className="h-5 w-5" />Your delivery partner is calling — Answer</button>
      )}
      {call && <VoiceCall orderId={order.id} ring={call.ring} otherName={riderName || "Delivery partner"} onEnd={() => setCall(null)} />}

      {!cancelled && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i <= step ? "bg-success text-primary-foreground" : "border bg-muted"}`}>{i <= step && <Check className="h-3.5 w-3.5" />}</span>
                <span className={i <= step ? "font-semibold" : "text-muted-foreground"}>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-1 rounded-2xl bg-card p-4 text-sm shadow-card">
        {order.lines.map((l) => <p key={l.key} className="text-muted-foreground">{l.qty} × {l.name}{l.notes.length ? ` (${l.notes.join(", ")})` : ""}</p>)}
        <p className="pt-2">Deliver to: {order.address}</p>
        <p className="flex justify-between border-t pt-2 font-bold"><span>Total · Cash on delivery</span><span>{inr(order.total)}</span></p>
      </section>

      {canCancel && (
        <button onClick={doCancel} disabled={cancelling} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive py-3 font-semibold text-destructive disabled:opacity-60"><XCircle className="h-4 w-4" />{cancelling ? "Cancelling…" : "Cancel order"}</button>
      )}
      <Link to="/help" search={{ order: order.id }} className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-3 font-semibold"><LifeBuoy className="h-4 w-4" />Need help?</Link>
    </main>
  );
}
