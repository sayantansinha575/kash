import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, imageOf, type ProductRow } from "@/lib/catalog";
import { inr } from "@/lib/cart";
import type { Option } from "@/lib/data";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const blank: ProductRow = { id: "", name: "", description: "", price: 0, category: "Regular", menthol: false, available: true, image_url: null, image_key: "r1", sizes: [{ name: "Pack of 10", price: 0 }, { name: "Pack of 20", price: 0 }], extras: [{ name: "Matchbox", price: 2 }, { name: "Lighter", price: 20 }], sort: 99 };

export function ProductsManager({ canDelete }: { canDelete: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(productsQuery);
  const [edit, setEdit] = useState<ProductRow | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  const toggle = async (p: ProductRow) => {
    const { error } = await supabase.from("products").update({ available: !p.available }).eq("id", p.id);
    if (error) toast.error("Could not update"); else { toast.success(p.available ? "Marked out of stock" : "Back in stock"); refresh(); }
  };
  const del = async (p: ProductRow) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error("Could not delete"); else refresh();
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setEdit({ ...blank })} className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground"><Plus className="h-4 w-4" />Add product</button>
      {isLoading && <div className="skeleton h-24 rounded-2xl" />}
      {data?.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
          <img src={imageOf(p)} alt={p.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.category} · {inr(Number(p.price))}/10 · {(p.sizes as Option[]).length} pack sizes</p>
          </div>
          <button onClick={() => toggle(p)} className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${p.available ? "bg-success text-primary-foreground" : "bg-muted"}`}>{p.available ? "In stock" : "Out of stock"}</button>
          <button onClick={() => setEdit(p)} className="shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold">Edit</button>
          {canDelete && <button onClick={() => del(p)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></button>}
        </div>
      ))}
      {edit && <Editor p={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
    </div>
  );
}

function OptionsEditor({ label, value, onChange }: { label: string; value: Option[]; onChange: (v: Option[]) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{label}</p>
      {value.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input value={o.name} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" className={input} />
          <input type="number" min={0} value={o.price} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} className={`${input} w-28`} />
          <button onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...value, { name: "", price: 0 }])} className="text-sm font-semibold text-primary">+ Add</button>
    </div>
  );
}

function Editor({ p, onClose, onSaved }: { p: ProductRow; onClose: () => void; onSaved: () => void }) {
  const isNew = !p.id;
  const [f, setF] = useState<ProductRow>(p);
  const [sizes, setSizes] = useState<Option[]>((p.sizes as Option[]) ?? []);
  const [extras, setExtras] = useState<Option[]>((p.extras as Option[]) ?? []);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProductRow>(k: K, v: ProductRow[K]) => setF({ ...f, [k]: v });

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image"); return; }
    setBusy(true);
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Upload failed"); setBusy(false); return; }
    const { data } = await supabase.storage.from("product-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (data?.signedUrl) set("image_url", data.signedUrl);
    setBusy(false);
  };

  const save = async () => {
    if (f.name.trim().length < 2 || f.price <= 0) { toast.error("Enter a name and price"); return; }
    setBusy(true);
    const row = {
      name: f.name.trim().slice(0, 80), description: f.description.trim().slice(0, 200), price: Number(f.price), category: f.category.trim() || "Regular",
      menthol: f.menthol, available: f.available, image_url: f.image_url, image_key: f.image_key, sort: Number(f.sort) || 0,
      sizes: sizes.filter((s) => s.name.trim()), extras: extras.filter((s) => s.name.trim()),
    };
    const id = isNew ? f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) + "-" + Math.random().toString(36).slice(2, 6) : p.id;
    const { error } = isNew ? await supabase.from("products").insert({ id, ...row }) : await supabase.from("products").update(row).eq("id", id);
    setBusy(false);
    if (error) toast.error("Could not save"); else { toast.success("Saved"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-foreground/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-xl font-extrabold">{isNew ? "New product" : "Edit product"}</h2><button onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="flex items-center gap-3">
          <img src={imageOf(f)} alt="" className="h-20 w-20 rounded-lg object-cover" />
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"><Upload className="h-4 w-4" />{busy ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Product name" className={input} />
        <input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description" className={input} />
        <div className="flex gap-2">
          <label className="flex-1 text-sm">Price (pack of 10)<input type="number" min={0} value={f.price} onChange={(e) => set("price", Number(e.target.value))} className={input} /></label>
          <label className="flex-1 text-sm">Type<input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Kings, Menthol…" className={input} /></label>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.menthol} onChange={(e) => set("menthol", e.target.checked)} />Menthol</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.available} onChange={(e) => set("available", e.target.checked)} />In stock</label>
        </div>
        <OptionsEditor label="Pack sizes (extra price over pack of 10)" value={sizes} onChange={setSizes} />
        <OptionsEditor label="Add-ons" value={extras} onChange={setExtras} />
        <button disabled={busy} onClick={save} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">Save</button>
      </div>
    </div>
  );
}
