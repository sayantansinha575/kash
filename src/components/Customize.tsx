import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Dish } from "@/lib/data";
import { useCart, inr } from "@/lib/cart";

export function Customize({ dish, restaurantId, onClose }: { dish: Dish; restaurantId: string; onClose: () => void }) {
  const { add, lines } = useCart();
  const [size, setSize] = useState(0);
  const [extras, setExtras] = useState<number[]>([]);
  const [spice, setSpice] = useState("Medium");
  const unit = dish.price + (dish.sizes?.[size]?.price ?? 0) + extras.reduce((s, i) => s + (dish.extras?.[i]?.price ?? 0), 0);

  const confirm = () => {
    if (lines.length && lines[0]?.restaurantId !== restaurantId) toast("Cart updated");
    const notes = [
      ...(dish.sizes ? [dish.sizes[size]?.name ?? ""] : []),
      ...(dish.spicy ? [`${spice} spice`] : []),
      ...extras.map((i) => dish.extras?.[i]?.name ?? ""),
    ];
    add({ restaurantId, dishId: dish.id, name: dish.name, veg: dish.veg, unit, notes });
    toast.success(`${dish.name} added`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{dish.name}</h3>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {dish.sizes && (
          <Group title="Pack size">{dish.sizes.map((s, i) => (
            <Row key={s.name} label={s.name} price={s.price} checked={size === i} onChange={() => setSize(i)} type="radio" />
          ))}</Group>
        )}
        {dish.spicy && (
          <Group title="Spice level">{["Mild", "Medium", "Hot"].map((s) => (
            <Row key={s} label={s} checked={spice === s} onChange={() => setSpice(s)} type="radio" />
          ))}</Group>
        )}
        {dish.extras && (
          <Group title="Extras">{dish.extras.map((e, i) => (
            <Row key={e.name} label={e.name} price={e.price} checked={extras.includes(i)} type="checkbox"
              onChange={() => setExtras((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))} />
          ))}</Group>
        )}
        <button onClick={confirm} className="mt-5 w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground">Add item · {inr(unit)}</button>
      </div>
    </div>
  );
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-4"><p className="mb-2 text-sm font-semibold text-muted-foreground">{title}</p><div className="space-y-1">{children}</div></div>
);
const Row = ({ label, price, checked, onChange, type }: { label: string; price?: number; checked: boolean; onChange: () => void; type: "radio" | "checkbox" }) => (
  <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-muted">
    <span className="flex items-center gap-2"><input type={type} checked={checked} onChange={onChange} className="accent-primary" />{label}</span>
    {price ? <span className="text-sm">+{inr(price)}</span> : null}
  </label>
);
