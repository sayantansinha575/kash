import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Issues a LiveKit token for the order's private voice room. Only the order's customer
// or its assigned delivery partner can join, and only while the order is active.
export const getCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().min(3).max(40), ring: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id, user_id, rider_id, status").eq("id", data.orderId).maybeSingle();
    if (!o || o.status !== "active" || !o.rider_id) throw new Error("Calls are available once a delivery partner is on the way");
    const side = o.user_id === context.userId ? "customer" : o.rider_id === context.userId ? "rider" : null;
    if (!side) throw new Error("Order not found");

    const url = process.env["LIVEKIT_URL"], key = process.env["LIVEKIT_API_KEY"], secret = process.env["LIVEKIT_API_SECRET"];
    if (!url || !key || !secret) throw new Error("Calling is not set up yet");
    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(key, secret, { identity: `${side}-${context.userId}`, name: side === "rider" ? "Delivery partner" : "Customer", ttl: "30m" });
    at.addGrant({ room: `order-${o.id}`, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });
    const token = await at.toJwt();

    if (data.ring) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders").update({ call_at: new Date().toISOString(), call_from: side }).eq("id", o.id);
    }
    return { url, token, side };
  });
