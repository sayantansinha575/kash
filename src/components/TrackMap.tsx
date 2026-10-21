import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";

const icon = (emoji: string, cls: string) =>
  L.divIcon({ className: "", html: `<div class="${cls}">${emoji}</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); }, [map, pts[0]?.[0], pts[1]?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function TrackMap({ store, home, rider }: { store: [number, number]; home: [number, number]; rider: [number, number] }) {
  return (
    <MapContainer center={store} zoom={14} scrollWheelZoom={false} className="h-64 w-full" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <Polyline positions={[store, home]} pathOptions={{ color: "var(--primary)", dashArray: "6 8", weight: 3 }} />
      <Marker position={store} icon={icon("🏪", "map-pin")} />
      <Marker position={home} icon={icon("🏠", "map-pin")} />
      <Marker position={rider} icon={icon("🛵", "map-pin map-pin-rider")} />
      <Fit pts={[store, home]} />
    </MapContainer>
  );
}
