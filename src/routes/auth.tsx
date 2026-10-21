import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Kash" },
      { name: "description", content: "Sign in or create your Kash account." },
      { property: "og:title", content: "Sign in — Kash" },
      { property: "og:description", content: "Sign in or create your Kash account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { if (user) nav({ to: "/", replace: true }); }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
      if (error) toast.error(error.message); else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) toast.error(error.message);
  };

  const input = "w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary";

  if (sent)
    return (
      <main className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Check your email</h1>
        <p className="mt-2 text-muted-foreground">We sent a confirmation link to {email}. Open it to finish signing up.</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-extrabold">{mode === "in" ? "Welcome back" : "Create account"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your cart, addresses and orders, on every device.</p>
      <button onClick={google} className="mt-6 w-full rounded-xl border bg-card py-3 font-semibold shadow-card">Continue with Google</button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
        <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={input} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-sm text-primary">
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
