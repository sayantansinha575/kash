import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, MapPin, Search, X, Home } from "lucide-react";
import { toast } from "sonner";
import { searchPlaces, reversePlace, type Place } from "@/lib/geo.functions";
import { useLocation } from "@/lib/location";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function LocationSheet() {
  const { open, setOpen, setLoc } = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = useServerFn(searchPlaces);
  const reverse = useServerFn(reversePlace);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<Place | null>(null);
  const [label, setLabel] = useState("Home");
  const [flat, setFlat] = useState("");

  const saved = useQuery({
    queryKey: ["addresses"],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("addresses").select("id, label, line, lat, lng").order("created_at")).data ?? [],
  });

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await search({ data: { q } }); setResults(r.places); if (r.error) toast.error(r.error); } catch { toast.error("Search failed"); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => { if (!open) { setQ(""); setResults([]); setPicked(null); setFlat(""); } }, [open]);
  if (!open) return null;

  const useGps = () => {
    if (!navigator.geolocation) { toast.error("Location is not supported on this device"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try { const r = await reverse({ data: { lat: p.coords.latitude, lng: p.coords.longitude } }); setPicked(r.place); }
        catch { toast.error("Could not find your address"); }
        setLocating(false);
      },
      (e) => { setLocating(false); toast.error(e.code === 1 ? "Location permission denied. Search for your address instead." : "Could not get your location"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const confirm = async (save: boolean) => {
    if (!picked) return;
    const line = flat.trim() ? `${flat.trim()}, ${picked.line}` : picked.line;
    const place = { ...picked, label: label.trim() || picked.label, line };
    if (save && user) {
      const { error } = await supabase.from("addresses").insert({ user_id: user.id, label: place.label.slice(0, 20), line: line.slice(0, 300), lat: place.lat, lng: place.lng });
      if (error) toast.error("Could not save address"); else qc.invalidateQueries({ queryKey: ["addresses"] });
    }
    setLoc(place); setOpen(false);
  };

  const input = "w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center" onClick={() => setOpen(false)}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{picked ? "Confirm address" : "Choose delivery location"}</h3>
          <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {picked ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-muted p-3 text-sm"><p className="font-semibold">{picked.label}</p><p className="text-muted-foreground">{picked.line}</p></div>
            <input value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="Flat / house no., floor, landmark" className={input} />
            {user && <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Save as (Home, Work)" className={input} />}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => confirm(false)} className="rounded-xl border py-3 font-bold">Use once</button>
              <button onClick={() => (user ? confirm(true) : confirm(false))} className="rounded-xl bg-primary py-3 font-bold text-primary-foreground">{user ? "Save & use" : "Use address"}</button>
            </div>
            <button onClick={() => setPicked(null)} className="w-full text-sm text-primary">Change location</button>
          </div>
        ) : (
          <>
            <button onClick={useGps} disabled={locating} className="mt-4 flex w-full items-center gap-2 rounded-xl border p-3 font-semibold text-primary">
              <Crosshair className="h-5 w-5" />{locating ? "Finding you…" : "Use my current location"}
            </button>
            <label className="mt-3 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, street, landmark" className="w-full bg-transparent outline-none" />
            </label>
            {searching && <div className="skeleton mt-3 h-12 rounded-xl" />}
            <div className="mt-2 space-y-1">
              {results.map((r, i) => (
                <button key={i} onClick={() => setPicked(r)} className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0"><span className="block font-medium">{r.label}</span><span className="block truncate text-xs text-muted-foreground">{r.line}</span></span>
                </button>
              ))}
            </div>
            {saved.data && saved.data.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-sm font-semibold text-muted-foreground">Saved addresses</p>
                {saved.data.map((a) => (
                  <button key={a.id} onClick={() => { setLoc({ label: a.label, line: a.line, lat: a.lat ?? 0, lng: a.lng ?? 0 }); setOpen(false); }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-muted">
                    <Home className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0"><span className="block font-medium">{a.label}</span><span className="block truncate text-xs text-muted-foreground">{a.line}</span></span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
