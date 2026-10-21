import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Place } from "@/lib/geo.functions";

type Ctx = { loc: Place | null; setLoc: (p: Place) => void; open: boolean; setOpen: (o: boolean) => void };
const LocCtx = createContext<Ctx>({ loc: null, setLoc: () => {}, open: false, setOpen: () => {} });
const KEY = "kash-loc";

export function LocationProvider({ children }: { children: ReactNode }) {
  const [loc, setLocState] = useState<Place | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) setLocState(JSON.parse(v)); } catch {} }, []);
  const setLoc = (p: Place) => { setLocState(p); localStorage.setItem(KEY, JSON.stringify(p)); };
  return <LocCtx.Provider value={{ loc, setLoc, open, setOpen }}>{children}</LocCtx.Provider>;
}
export const useLocation = () => useContext(LocCtx);
