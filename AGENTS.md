<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Catalog and coupons live in src/lib/data.ts and are shared by UI and the placeOrder server fn, which re-prices lines server-side; orders are inserted only via that fn (no client INSERT grant) so totals cannot be forged.
- Cart is mirrored to localStorage and, when signed in, to the carts table (merged on sign-in).
- Maps use Leaflet + OpenStreetMap tiles and address search uses Nominatim via server fns (src/lib/geo.functions.ts) — no API key needed; swap for Google Maps/Mapbox if volume grows. TrackMap is lazy-loaded behind ClientOnly because Leaflet touches window at import.
- Delivery partners are users with the 'rider' role in user_roles (checked via has_role); all rider order changes (accept, stage advance, location, delivered + ID check) go through src/lib/rider.functions.ts, and customers follow progress live via realtime on orders.stage/rider_lat/rider_lng.
- In-app voice calls use LiveKit: src/lib/call.functions.ts mints room tokens only for the order's customer or assigned rider while active, and sets orders.call_at/call_from so the other side sees an Answer prompt; src/components/VoiceCall.tsx dynamically imports livekit-client.
- Products, coupons and store settings (fees, hours, delivery radius) live in DB tables; placeOrder reads them server-side. Staff = admin or manager role (is_staff); orders need store_ok (store accept) before riders can take them. Product photos go to the private product-photos bucket with long-lived signed URLs because public buckets are blocked.
