import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/help")({
  validateSearch: (s) => z.object({ order: z.string().max(40).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Help & support — Kash" },
      { name: "description", content: "Answers to common questions and a way to contact Kash support." },
      { property: "og:title", content: "Help & support — Kash" },
      { property: "og:description", content: "Get help with your Kash order." },
    ],
  }),
  component: Help,
});

const faqs = [
  { q: "Why do I need to show ID?", a: "Tobacco is sold only to adults aged 18 and above. The delivery partner checks a valid government ID before handing over your order." },
  { q: "Can I cancel my order?", a: "Yes, from the tracking page, any time before the delivery partner picks up your order." },
  { q: "What payment methods are accepted?", a: "Cash on delivery for now. Online payments are coming soon." },
  { q: "My order is late. What should I do?", a: "Check the tracking page for the latest status. If it looks stuck, raise a request below and we'll get back to you." },
  { q: "I received the wrong item.", a: "Raise a request below with your order number and what went wrong." },
];
const topics = ["Order is late", "Wrong or missing item", "Payment issue", "Cancel / refund", "Account", "Something else"];

function Help() {
  const { order } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<number | null>(null);
  const [topic, setTopic] = useState(topics[0]!);
  const [orderId, setOrderId] = useState(order ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const tickets = useQuery({
    queryKey: ["tickets"],
    enabled: !!user,
    queryFn: async () => (await supabase.from("support_tickets").select("id, topic, order_id, message, status, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!user) return;
    const m = message.trim();
    if (m.length < 5) { toast.error("Tell us a little more"); return; }
    setSending(true);
    const { error } = await supabase.from("support_tickets").insert({ user_id: user.id, topic, order_id: orderId.trim() || null, message: m.slice(0, 1000) });
    setSending(false);
    if (error) { toast.error("Could not send. Try again."); return; }
    toast.success("Request sent. We'll get back to you soon.");
    setMessage(""); qc.invalidateQueries({ queryKey: ["tickets"] });
  };

  const input = "w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary";
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-16">
      <h1 className="text-2xl font-extrabold">Help & support</h1>
      <section className="divide-y rounded-2xl bg-card shadow-card">
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-2 p-4 text-left font-semibold">
              {f.q}<ChevronDown className={`h-4 w-4 shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-4 pb-4 text-sm text-muted-foreground">{f.a}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
        <p className="font-bold">Contact support</p>
        {user ? (
          <>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={input}>{topics.map((t) => <option key={t}>{t}</option>)}</select>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order number (optional)" className={input} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000} placeholder="Describe the problem" className={input} />
            <button onClick={submit} disabled={sending} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">{sending ? "Sending…" : "Send request"}</button>
          </>
        ) : (
          <Link to="/auth" className="block rounded-xl bg-primary py-3 text-center font-bold text-primary-foreground">Sign in to contact support</Link>
        )}
      </section>

      {tickets.data && tickets.data.length > 0 && (
        <section className="space-y-2">
          <p className="font-bold">Your requests</p>
          {tickets.data.map((t) => (
            <div key={t.id} className="rounded-2xl bg-card p-4 text-sm shadow-card">
              <div className="flex justify-between gap-2"><span className="font-semibold">{t.topic}</span><span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold capitalize">{t.status}</span></div>
              {t.order_id && <p className="text-xs text-muted-foreground">Order #{t.order_id}</p>}
              <p className="mt-1 text-muted-foreground">{t.message}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
