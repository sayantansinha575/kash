import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Place = { label: string; line: string; lat: number; lng: number };
const UA = "KashDelivery/1.0 (support@kash.app)";

type Nom = { display_name: string; lat: string; lon: string; name?: string };
const toPlace = (r: Nom): Place => ({
  label: r.name || r.display_name.split(",")[0] || "Pinned location",
  line: r.display_name,
  lat: Number(r.lat),
  lng: Number(r.lon),
});

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(data.q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (!res.ok) { console.error("search failed", res.status, await res.text()); return { places: [] as Place[], error: "Search unavailable" }; }
    return { places: ((await res.json()) as Nom[]).map(toPlace), error: null };
  });

export const reversePlace = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data }) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (!res.ok) return { place: { label: "Current location", line: `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`, lat: data.lat, lng: data.lng } };
    const r = (await res.json()) as Nom;
    return { place: { ...toPlace(r), lat: data.lat, lng: data.lng } };
  });
