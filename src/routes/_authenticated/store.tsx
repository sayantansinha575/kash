import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/catalog";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { StoreOrders } from "@/components/admin/StoreOrders";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({
    meta: [
      { title: "Store panel — Kash" },
      { name: "description", content: "Accept orders and manage products and stock." },
      { property: "og:title", content: "Kash store panel" },
      { property: "og:description", content: "Accept orders and manage products and stock." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StorePanel,
});

export function NoAccess({ what }: { what: string }) {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-center">
      <Store className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-3 text-2xl font-extrabold">No access</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account ({user?.email}) doesn't have {what} access. Ask an admin to give it to you.</p>
      <Link to="/" className="mt-4 inline-block font-bold text-primary">Back home</Link>
    </main>
  );
}

function StorePanel() {
  const { user } = useAuth();
  const roles = useRoles(user?.id);
  const [tab, setTab] = useState<"orders" | "products">("orders");
  if (roles.isLoading) return <div className="mx-auto mt-8 max-w-xl px-4"><div className="skeleton h-40 rounded-2xl" /></div>;
  const r = roles.data ?? [];
  if (!r.includes("manager") && !r.includes("admin")) return <NoAccess what="store manager" />;
  const tabCls = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-bold ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`;
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-16">
      <h1 className="text-2xl font-extrabold">Store panel</h1>
      <div className="flex gap-2">
        <button className={tabCls(tab === "orders")} onClick={() => setTab("orders")}>Orders</button>
        <button className={tabCls(tab === "products")} onClick={() => setTab("products")}>Products & stock</button>
      </div>
      {tab === "orders" ? <StoreOrders showAll={false} /> : <ProductsManager canDelete={r.includes("admin")} />}
    </main>
  );
}
