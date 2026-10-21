import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Stages: 0 placed, 1 confirmed (rider accepted), 2 packing, 3 ready, 4 picked up, 5 on the way, 6 arriving, 7 delivered.
export const LAST_STAGE = 7;

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "rider" }) => PromiseLike<{ data: boolean | null }> }; userId: string };
async function assertRider(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "rider" });
  if (!data) throw new Error("Only delivery partners can do this");
}

const idInput = z.object({ id: z.string().min(3).max(40) });

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertRider(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("orders")
      .update({ rider_id: context.userId, stage: 1 })
      .eq("id", data.id).eq("status", "active").eq("store_ok", true).is("rider_id", null).select("id");
    if (error || !rows?.length) throw new Error("This order was already taken or cancelled");
    return { ok: true };
  });

export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(3).max(40), idChecked: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRider(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders").select("stage, status, rider_id").eq("id", data.id).maybeSingle();
    if (!o || o.rider_id !== context.userId) throw new Error("Order not found");
    if (o.status !== "active") throw new Error("This order is no longer active");
    const next = o.stage + 1;
    if (next > LAST_STAGE) throw new Error("Already delivered");
    if (next === LAST_STAGE && !data.idChecked) throw new Error("Check the customer's ID before marking delivered");
    const patch = next === LAST_STAGE
      ? { stage: next, status: "delivered", id_checked: true, delivered_at: new Date().toISOString() }
      : { stage: next };
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.id).eq("stage", o.stage);
    if (error) throw new Error("Could not update. Try again.");
    return { stage: next };
  });

export const shareLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRider(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("orders")
      .update({ rider_lat: data.lat, rider_lng: data.lng, rider_at: new Date().toISOString() })
      .eq("rider_id", context.userId).eq("status", "active");
    return { ok: true };
  });
