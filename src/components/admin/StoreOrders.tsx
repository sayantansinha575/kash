import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/cart";
import { storeAcceptOrder, staffCancelOrder } from "@/lib/admin.functions";

const stageName = ["Placed", "Partner assigned", "Packing", "Ready", "Picked up", "On the way", "Arriving", "Delivered"];

export function StoreOrders({ showAll }: { showAll: boolean }) {
  const qc = useQueryClient();
  const accept = useServerFn(storeAcceptOrder);
  const cancel = useServerFn(staffCancelOrder);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const { data, isLoading } = useQuery({
    queryKey: ["staff-orders", filter],
    refetchInterval: 6000,
    queryFn: async () => {
      let q = supabase.from("orders").select("id, lines, total, address, instructions, status, stage, store_ok, rider_id, created_at").order("created_at", { ascending: false }).limit(100);
      if (filter === "active") q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["staff-orders"] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(null);
  };
  const incoming = (data ?? []).filter((o) => o.status === "active" && !o.store_ok);
  const rest = (data ?? []).filter((o) => !(o.status === "active" && !o.store_ok));

  return (
    <div className="space-y-4">
      {showAll && (
        <div className="flex gap-2">
          {(["active", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-card"}`}>{f === "active" ? "Active" : "All orders"}</button>)}
        </div>
      )}
      <section className="space-y-2">
        <h2 className="font-bold">Incoming ({incoming.length})</h2>
        {isLoading && <div className="skeleton h-24 rounded-2xl" />}
        {!isLoading && incoming.length === 0 && <p className="text-sm text-muted-foreground">No new orders. This list refreshes automatically.</p>}
        {incoming.map((o) => (
          <div key={o.id} className="rounded-2xl border-2 border-primary bg-card p-4 shadow-card">
            <div className="flex justify-between font-bold"><span>#{o.id}</span><span>{inr(Number(o.total))}</span></div>
            <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
            <ul className="mt-1 text-sm">{(o.lines as { key: string; qty: number; name: string; notes: string[] }[]).map((l) => <li key={l.key}>{l.qty} × {l.name}{l.notes.length ? ` (${l.notes.join(", ")})` : ""}</li>)}</ul>
            <p className="mt-1 text-sm text-muted-foreground">{o.address}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={busy === o.id} onClick={() => confirm("Reject and cancel this order?") && run(o.id, () => cancel({ data: { id: o.id } }), "Order rejected")} className="flex-1 rounded-xl border py-2.5 font-semibold">Reject</button>
              <button disabled={busy === o.id} onClick={() => run(o.id, () => accept({ data: { id: o.id } }), "Order accepted — sent to delivery partners")} className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground">Accept</button>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">{filter === "active" ? "In progress" : "Other orders"}</h2>
        {rest.map((o) => (
          <div key={o.id} className="rounded-2xl bg-card p-3 text-sm shadow-card">
            <div className="flex justify-between font-bold"><span>#{o.id}</span><span>{inr(Number(o.total))}</span></div>
            <p className="text-muted-foreground">
              {o.status === "active" ? (o.rider_id ? stageName[o.stage] : "Waiting for a delivery partner") : o.status === "delivered" ? "Delivered" : "Cancelled"} · {new Date(o.created_at).toLocaleString("en-IN")}
            </p>
            {o.status === "active" && o.stage < 4 && <button disabled={busy === o.id} onClick={() => confirm("Cancel this order?") && run(o.id, () => cancel({ data: { id: o.id } }), "Cancelled")} className="mt-1 text-xs font-semibold text-destructive">Cancel order</button>}
          </div>
        ))}
      </section>
    </div>
  );
}
