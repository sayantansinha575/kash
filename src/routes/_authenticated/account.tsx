import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — Kash" },
      { name: "description", content: "Manage your Kash profile and saved addresses." },
      { property: "og:title", content: "Your account — Kash" },
      { property: "og:description", content: "Manage your profile and addresses." },
    ],
  }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const roles = useRoles(user?.id).data ?? [];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name, phone").eq("id", user!.id).maybeSingle()).data,
  });
  useEffect(() => { if (profile.data) { setName(profile.data.full_name ?? ""); setPhone(profile.data.phone ?? ""); } }, [profile.data]);

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await supabase.from("addresses").select("id, label, line").order("created_at")).data ?? [],
  });

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, full_name: name.trim().slice(0, 80), phone: phone.trim().slice(0, 20) });
    if (error) toast.error("Could not save"); else toast.success("Profile saved");
  };
  const addAddress = async () => {
    if (line.trim().length < 8) { toast.error("Enter a full address"); return; }
    const { error } = await supabase.from("addresses").insert({ user_id: user!.id, label: label.trim().slice(0, 20) || "Home", line: line.trim().slice(0, 300) });
    if (error) { toast.error("Could not save address"); return; }
    setLine(""); qc.invalidateQueries({ queryKey: ["addresses"] });
  };
  const del = async (id: string) => { await supabase.from("addresses").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["addresses"] }); };
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); nav({ to: "/auth", replace: true }); };

  const input = "w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary";
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-16">
      <h1 className="text-2xl font-extrabold">Account</h1>
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={input} />
        <button onClick={saveProfile} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save</button>
      </section>
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
        <p className="font-bold">Saved addresses</p>
        {addresses.data?.map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded-lg bg-muted p-2 text-sm">
            <div className="min-w-0 flex-1"><p className="font-semibold">{a.label}</p><p className="text-muted-foreground">{a.line}</p></div>
            <button onClick={() => del(a.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (Home, Work)" className={input} />
        <textarea value={line} onChange={(e) => setLine(e.target.value)} rows={2} placeholder="Flat, building, street, area" className={input} />
        <button onClick={addAddress} className="rounded-lg bg-secondary px-4 py-2 font-bold">Add address</button>
      </section>
      <Link to="/orders" className="block rounded-2xl bg-card p-4 font-semibold shadow-card">Your orders →</Link>
      <Link to="/help" className="block rounded-2xl bg-card p-4 font-semibold shadow-card">Help & support →</Link>
      <Link to="/rider" className="block rounded-2xl bg-card p-4 font-semibold shadow-card">Delivery partner mode →</Link>
      {(roles.includes("manager") || roles.includes("admin")) && <Link to="/store" className="block rounded-2xl bg-card p-4 font-semibold shadow-card">Store panel →</Link>}
      {roles.includes("admin") && <Link to="/admin" className="block rounded-2xl bg-card p-4 font-semibold shadow-card">Admin panel →</Link>}
      <button onClick={signOut} className="w-full rounded-xl border py-3 font-semibold">Sign out</button>
    </main>
  );
}
