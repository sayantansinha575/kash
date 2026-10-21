import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Your orders — Kash" },
      { name: "description", content: "Your Kash order history." },
      { property: "og:title", content: "Your orders — Kash" },
      { property: "og:description", content: "Your Kash order history." },
    ],
  }),
  component: Orders,
});

function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, total, created_at, status, lines").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-5">
      <h1 className="text-2xl font-extrabold">Your orders</h1>
      {isLoading && [0, 1].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      {data?.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Package className="mx-auto h-10 w-10" />
          <p className="mt-2">No orders yet.</p>
          <Link to="/" className="mt-4 inline-block font-bold text-primary">Start shopping</Link>
        </div>
      )}
      {data?.map((o) => {
        const lines = (o.lines as { name: string; qty: number }[]) ?? [];
        return (
          <Link key={o.id} to="/track/$id" params={{ id: o.id }} className="block rounded-2xl bg-card p-4 shadow-card">
            <div className="flex justify-between gap-2 font-bold"><span>#{o.id}</span><span>{inr(Number(o.total))}</span></div>
            {o.status === "cancelled" && <span className="text-xs font-semibold text-destructive">Cancelled</span>}{o.status === "delivered" && <span className="text-xs font-semibold text-success">Delivered</span>}
            <p className="truncate text-sm text-muted-foreground">{lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</p>
            <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
          </Link>
        );
      })}
    </main>
  );
}
