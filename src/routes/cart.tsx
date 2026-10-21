import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart, inr } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { placeOrder, checkCoupon } from "@/lib/orders.functions";
import { useSettings, isOpenNow, hoursLabel } from "@/lib/catalog";
import { useLocation } from "@/lib/location";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Kash" },
      { name: "description", content: "Review your order, apply coupons and check out." },
      { property: "og:title", content: "Your cart — Kash" },
      { property: "og:description", content: "Review your order and check out." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, setQty, clear } = useCart();
  const { user } = useAuth();
  const { loc, setOpen: openLoc } = useLocation();
  const nav = useNavigate();
  const place = useServerFn(placeOrder);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [terms, setTerms] = useState<{ pct: number; max: number; min: number } | null>(null);
  const settings = useSettings();
  const check = useServerFn(checkCoupon);
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [adult, setAdult] = useState(false);
  const busy = useRef(false);
  const idem = useRef<string | null>(null);

  useEffect(() => { if (loc) setAddress(loc.line); }, [loc]);

  if (!lines.length)
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-muted-foreground">Your favourite brands are a tap away.</p>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground">Browse products</Link>
      </main>
    );

  const r = { fee: Number(settings.delivery_fee), minOrder: Number(settings.min_order) };
  const items = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  const c = applied ? terms : null;
  const discount = c && items >= c.min ? Math.min((items * c.pct) / 100, c.max || Infinity) : 0;
  const packaging = Number(settings.packaging);
  const taxes = (items - discount) * (Number(settings.tax_pct) / 100);
  const closed = !isOpenNow(settings);
  const total = items - discount + r.fee + packaging + taxes;
  const belowMin = items < r.minOrder;

  const apply = async () => {
    const k = code.trim().toUpperCase();
    if (k.length < 2) return;
    const cp = await check({ data: { code: k } }).catch(() => null);
    if (!cp) { toast.error("Invalid coupon"); return; }
    if (items < cp.min) { toast.error(`Add ${inr(cp.min - items)} more to use ${k}`); return; }
    setTerms(cp); setApplied(k); toast.success(`${k} applied`);
  };

  const submit = async () => {
    if (busy.current) return;
    if (address.trim().length < 8) { toast.error("Enter a full delivery address"); return; }
    busy.current = true; setPlacing(true);
    idem.current ??= crypto.randomUUID();
    try {
      const res = await place({ data: {
        lines: lines.map((l) => ({ dishId: l.dishId, qty: l.qty, notes: l.notes })),
        coupon: applied, address, instructions, idempotencyKey: idem.current,
        lat: loc && loc.lat ? loc.lat : null, lng: loc && loc.lng ? loc.lng : null,
      } });
      clear();
      nav({ to: "/track/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
      busy.current = false; setPlacing(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-16">
      <h1 className="text-2xl font-extrabold">Checkout</h1>
      <section className="rounded-2xl bg-card p-4 shadow-card">
        {lines.map((l) => (
          <div key={l.key} className="flex items-start gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.name}</p>
              {l.notes.length > 0 && <p className="text-xs text-muted-foreground">{l.notes.join(" · ")}</p>}
            </div>
            <div className="flex shrink-0 items-center rounded-lg border text-primary">
              <button className="p-1.5" onClick={() => setQty(l.key, l.qty - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></button>
              <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
              <button className="p-1.5" onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase"><Plus className="h-4 w-4" /></button>
            </div>
            <span className="w-16 shrink-0 text-right text-sm">{inr(l.unit * l.qty)}</span>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-card">
        <p className="mb-2 font-bold">Coupon</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Try KASH10" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 uppercase outline-none focus:border-primary" />
          <button onClick={apply} className="rounded-lg bg-secondary px-4 font-bold">Apply</button>
        </div>
        {applied && <p className="mt-2 text-sm text-success">{applied} applied — you save {inr(discount)}</p>}
      </section>

      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
        <p className="font-bold">Delivery address</p>
        <button onClick={() => openLoc(true)} className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 text-left text-sm">
          <span className="min-w-0 truncate font-semibold">{loc ? loc.label : "Choose on map / search"}</span><span className="shrink-0 text-primary">Change</span>
        </button>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Flat, building, street, area" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" />
        <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions (e.g. don't ring the bell)" className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" />
        {user && <Link to="/account" className="text-sm text-primary">Manage saved addresses</Link>}
      </section>

      <section className="space-y-1.5 rounded-2xl bg-card p-4 text-sm shadow-card">
        <p className="mb-1 text-base font-bold">Bill details</p>
        <Line k="Item total" v={inr(items)} />
        {discount > 0 && <Line k="Discount" v={`−${inr(discount)}`} />}
        <Line k="Delivery fee" v={r.fee ? inr(r.fee) : "Free"} />
        <Line k="Packaging" v={inr(packaging)} />
        <Line k="Taxes (5%)" v={inr(taxes)} />
        <div className="flex justify-between border-t pt-2 text-base font-bold"><span>To pay</span><span>{inr(total)}</span></div>
      </section>

      <section className="rounded-2xl bg-card p-4 text-sm shadow-card">
        <p className="font-bold">Payment</p>
        <label className="mt-2 flex items-center gap-2"><input type="radio" checked readOnly className="accent-primary" />Cash on delivery</label>
        <p className="mt-1 text-xs text-muted-foreground">Online payments coming soon.</p>
      </section>

      <label className="flex items-start gap-2 rounded-2xl bg-secondary p-4 text-sm"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 accent-primary" /><span>I confirm I am 18 or older and will show a valid government ID to the delivery partner.</span></label>
      {user ? (
        <button onClick={submit} disabled={placing || belowMin || closed || !adult} className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-60">
          {closed ? `Closed now · we deliver ${hoursLabel(settings)}` : belowMin ? `Add ${inr(r.minOrder - items)} more to order` : placing ? "Placing order…" : `Place order · ${inr(total)}`}
        </button>
      ) : (
        <Link to="/auth" className="block w-full rounded-xl bg-primary py-4 text-center font-bold text-primary-foreground">Sign in to place order</Link>
      )}
    </main>
  );
}

const Line = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>
);
