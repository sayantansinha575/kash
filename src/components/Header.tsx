import { Link } from "@tanstack/react-router";
import { MapPin, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useLocation } from "@/lib/location";

export function Header() {
  const { lines } = useCart();
  const { user, loading } = useAuth();
  const { loc, setOpen } = useLocation();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="font-display text-2xl font-extrabold text-primary">kash</Link>
        <button onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-1 text-left text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0"><span className="block truncate font-semibold">{loc?.label ?? "Set location"}</span>{loc && <span className="hidden truncate text-xs text-muted-foreground sm:block">{loc.line}</span>}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {!loading && (user ? (
            <Link to="/account" className="rounded-full bg-secondary p-2" aria-label="Account"><User className="h-5 w-5" /></Link>
          ) : (
            <Link to="/auth" className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold">Sign in</Link>
          ))}
          <Link to="/cart" className="relative rounded-full bg-secondary p-2" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">{count}</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function VegMark({ veg }: { veg: boolean }) {
  return (
    <span className={`inline-grid h-4 w-4 place-items-center rounded-sm border-2 ${veg ? "border-veg" : "border-nonveg"}`} aria-label={veg ? "Veg" : "Non-veg"}>
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-veg" : "bg-nonveg"}`} />
    </span>
  );
}
