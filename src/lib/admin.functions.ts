import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcCtx = { supabase: { rpc: (fn: "is_staff" | "has_role", args: Record<string, string>) => PromiseLike<{ data: boolean | null }> }; userId: string };
async function assertStaff(ctx: unknown) {
  const c = ctx as RpcCtx;
  const { data } = await c.supabase.rpc("is_staff", { _user_id: c.userId });
  if (!data) throw new Error("Only store staff can do this");
}
async function assertAdmin(ctx: unknown) {
  const c = ctx as RpcCtx;
  const { data } = await c.supabase.rpc("has_role", { _user_id: c.userId, _role: "admin" });
  if (!data) throw new Error("Only admins can do this");
}
const idInput = z.object({ id: z.string().min(3).max(40) });

export const storeAcceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("orders").update({ store_ok: true }).eq("id", data.id).eq("status", "active").select("id");
    if (!rows?.length) throw new Error("This order is no longer active");
    return { ok: true };
  });

export const staffCancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", data.id).eq("status", "active").select("id");
    if (!rows?.length) throw new Error("This order is no longer active");
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: auth }, { data: profiles }, { data: roles }, { data: orders }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, full_name, phone"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("orders").select("user_id, total, status"),
    ]);
    return (auth?.users ?? []).map((u) => {
      const p = profiles?.find((x) => x.id === u.id);
      const mine = (orders ?? []).filter((o) => o.user_id === u.id && o.status !== "cancelled");
      return {
        id: u.id, email: u.email ?? "", name: p?.full_name ?? "", phone: p?.phone ?? "", createdAt: u.created_at,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
        orders: mine.length, spent: mine.reduce((s, o) => s + Number(o.total), 0),
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "manager", "rider"]), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.on) throw new Error("You can't remove your own admin access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = data.on
      ? await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" })
      : await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    if (error) throw new Error("Could not update role");
    return { ok: true };
  });
