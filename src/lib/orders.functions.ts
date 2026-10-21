import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { storeCoords } from "@/lib/data";
import { toDish, defaultSettings, isOpenNow, hoursLabel, km, type ProductRow, type Settings } from "@/lib/catalog";

const input = z.object({
  lines: z.array(z.object({ dishId: z.string().max(50), qty: z.number().int().min(1).max(50), notes: z.array(z.string().max(60)).max(10) })).min(1).max(30),
  coupon: z.string().max(20).nullable(),
  address: z.string().trim().min(8).max(300),
  instructions: z.string().max(200),
  idempotencyKey: z.string().min(8).max(64),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { data: st }] = await Promise.all([
      supabaseAdmin.from("products").select("*"),
      supabaseAdmin.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const s = (st as Settings | null) ?? defaultSettings;
    if (!isOpenNow(s)) throw new Error(`We deliver ${hoursLabel(s)}. Please order during delivery hours.`);
    if (data.lat != null && data.lng != null && km(storeCoords, [data.lat, data.lng]) > Number(s.max_km))
      throw new Error(`Sorry, this address is outside our ${s.max_km} km delivery area`);
    const menu = ((rows ?? []) as ProductRow[]).map(toDish);

    // Re-price every line from the catalog; never trust client prices.
    const priced = data.lines.map((l) => {
      const dish = menu.find((d) => d.id === l.dishId);
      if (!dish) throw new Error("A product in your cart no longer exists");
      if (!dish.available) throw new Error(`${dish.name} is out of stock`);
      let unit = dish.price;
      for (const n of l.notes) {
        const opt = dish.sizes?.find((x) => x.name === n) ?? dish.extras?.find((e) => e.name === n);
        if (!opt) throw new Error(`Invalid option for ${dish.name}`);
        unit += Number(opt.price);
      }
      return { key: `${dish.id}|${l.notes.join(",")}`, restaurantId: "kash", dishId: dish.id, name: dish.name, veg: dish.veg, unit, qty: l.qty, notes: l.notes };
    });
    const items = priced.reduce((a, l) => a + l.unit * l.qty, 0);
    const minOrder = Number(s.min_order), fee = Number(s.delivery_fee), packaging = Number(s.packaging);
    if (items < minOrder) throw new Error(`Minimum order is ₹${minOrder}`);
    const code = data.coupon?.toUpperCase() ?? null;
    const { data: c } = code ? await supabaseAdmin.from("coupons").select("*").eq("code", code).eq("active", true).maybeSingle() : { data: null };
    const discount = c && items >= Number(c.min_order) ? Math.min((items * Number(c.pct)) / 100, Number(c.max_off) || Infinity) : 0;
    const taxes = Math.round((items - discount) * (Number(s.tax_pct) / 100) * 100) / 100;
    const total = Math.round((items - discount + fee + packaging + taxes) * 100) / 100;

    const { data: existing } = await supabaseAdmin.from("orders").select("id").eq("idempotency_key", data.idempotencyKey).eq("user_id", context.userId).maybeSingle();
    if (existing) return { id: existing.id };

    const id = `KS${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
    const { error } = await supabaseAdmin.from("orders").insert({
      id, user_id: context.userId, lines: priced, item_total: items, discount, delivery_fee: fee, packaging, taxes, total,
      coupon: discount > 0 ? code : null, address: data.address, instructions: data.instructions, idempotency_key: data.idempotencyKey, lat: data.lat, lng: data.lng,
    });
    if (error) throw new Error("Could not place order. Please try again.");
    await supabaseAdmin.from("carts").upsert({ user_id: context.userId, lines: [], updated_at: new Date().toISOString() });
    return { id };
  });

// Public coupon lookup: returns only the terms of one active code.
export const checkCoupon = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().trim().min(2).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("coupons").select("pct, max_off, min_order").eq("code", data.code.toUpperCase()).eq("active", true).maybeSingle();
    return c ? { pct: Number(c.pct), max: Number(c.max_off), min: Number(c.min_order) } : null;
  });

// Legacy demo timing (kept for old local orders); real orders use the stage column.
export const STEP_MS = 8000;

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id, stage, status").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!o) throw new Error("Order not found");
    if (o.status !== "active") throw new Error("This order can no longer be cancelled");
    if (o.stage >= 4) throw new Error("Your order has already been picked up");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", o.id).eq("user_id", context.userId);
    if (error) throw new Error("Could not cancel. Please try again.");
    return { ok: true };
  });
