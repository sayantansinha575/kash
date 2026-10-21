import { useEffect, useState } from "react";

export function AgeGate() {
  const [show, setShow] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { if (localStorage.getItem("kash-age-ok") !== "1") setShow(true); }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/80 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center">
        <h2 className="text-2xl font-extrabold">Are you 18 or older?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tobacco products are sold only to adults. A valid ID is checked on delivery.</p>
        {denied ? (
          <p className="mt-5 font-semibold text-destructive">Sorry, you must be 18+ to use this service.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => setDenied(true)} className="rounded-xl border py-3 font-bold">No</button>
            <button onClick={() => { localStorage.setItem("kash-age-ok", "1"); setShow(false); }} className="rounded-xl bg-primary py-3 font-bold text-primary-foreground">Yes, I'm 18+</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function HealthWarning() {
  return (
    <div className="bg-foreground py-1.5 text-center text-xs font-bold uppercase tracking-wide text-background">
      Warning: Smoking causes cancer · Tobacco kills
    </div>
  );
}
