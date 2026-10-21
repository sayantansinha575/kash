import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { categories, type Dish } from "@/lib/data";
import { productsQuery, toDish, useSettings, hoursLabel, isOpenNow } from "@/lib/catalog";
import { useCart, inr } from "@/lib/cart";
import { Customize } from "@/components/Customize";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kash — Cigarettes delivered in minutes" },
      { name: "description", content: "Order cigarettes with live tracking. 18+ only, ID checked on delivery." },
      { property: "og:title", content: "Kash — Cigarette delivery" },
      { property: "og:description", content: "Cigarettes delivered fast. 18+ only." },
    ],
  }),
  component: Home,
});

type Sort = "relevance" | "low" | "high";

function Home() {
  const { lines } = useCart();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("relevance");
  const [custom, setCustom] = useState<Dish | null>(null);
  const products = useQuery(productsQuery);
  const settings = useSettings();
  const loading = products.isLoading;
  const menu = useMemo(() => (products.data ?? []).map(toDish), [products.data]);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim().toLowerCase()), 250); return () => clearTimeout(t); }, [q]);

  const list = useMemo(() => {
    let r = menu.filter((d) => !dq || d.name.toLowerCase().includes(dq) || d.category.toLowerCase().includes(dq) || d.desc.toLowerCase().includes(dq));
    if (cat) r = r.filter((d) => d.category === cat || (cat === "Menthol" && d.veg));
    const by: Record<Sort, (a: Dish, b: Dish) => number> = {
      relevance: (a, b) => Number(b.available) - Number(a.available),
      low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price,
    };
    return [...r].sort(by[sort]);
  }, [menu, dq, cat, sort]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28">
      <section className="pt-6">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Out of smokes? <span className="text-primary">Delivered in minutes.</span></h1>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{settings.eta} min · {hoursLabel(settings)} · Min order {inr(Number(settings.min_order))}{!isOpenNow(settings) && <span className="ml-1 font-semibold text-destructive">· Closed now</span>}</p>
        <div className="sticky top-14 z-20 -mx-4 mt-4 bg-background/95 px-4 py-2 backdrop-blur">
          <label className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-card">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands or types" className="w-full bg-transparent outline-none" />
          </label>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">Shop by type</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button key={c.name} onClick={() => setCat(cat === c.name ? null : c.name)} className="flex shrink-0 flex-col items-center gap-2">
              <img src={c.image} alt={c.name} width={72} height={72} loading="lazy" className={`h-18 w-18 rounded-full object-cover shadow-card ${cat === c.name ? "ring-2 ring-primary" : ""}`} />
              <span className="text-sm font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button className={chip(sort === "low")} onClick={() => setSort(sort === "low" ? "relevance" : "low")}>Price: low to high</button>
          <button className={chip(sort === "high")} onClick={() => setSort(sort === "high" ? "relevance" : "high")}>Price: high to low</button>
        </div>
        <h2 className="mb-3 text-lg font-bold">{list.length} products</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)
            : list.map((d) => (
                <div key={d.id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card shadow-card ${d.available ? "" : "opacity-60"}`}>
                  <div className="relative">
                    <img src={d.image} alt={d.name} width={944} height={704} loading="lazy" className="aspect-square w-full object-cover" />
                    {d.veg && <span className="absolute left-2 top-2 rounded bg-card px-1.5 py-0.5 text-xs font-semibold">Menthol</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                    <h3 className="truncate text-sm font-bold sm:text-base">{d.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{d.desc}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-sm font-bold">{inr(d.price)}<span className="text-xs font-normal text-muted-foreground">/10</span></span>
                      <button disabled={!d.available} onClick={() => setCustom(d)} className="shrink-0 rounded-lg border px-3 py-1 text-xs font-extrabold text-primary disabled:text-muted-foreground">
                        {d.available ? "ADD" : "Sold out"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
        </div>
        {!loading && list.length === 0 && <p className="py-16 text-center text-muted-foreground">No matches. Try "menthol" or "kings".</p>}
      </section>

      {count > 0 && (
        <Link to="/cart" className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-5xl items-center justify-between rounded-xl bg-primary px-5 py-3.5 font-bold text-primary-foreground shadow-card">
          <span>{count} item{count > 1 ? "s" : ""} added</span><span>View cart →</span>
        </Link>
      )}
      {custom && <Customize dish={custom} restaurantId="kash" onClose={() => setCustom(null)} />}
    </main>
  );
}
