"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAccess } from "@/app/context/AccessContext";

import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);

const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

export default function ClientMapPage() {
  const router = useRouter();
  const access = useAccess();

  const [clients, setClients] = useState<any[]>([]);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const hasProAccess =
    access?.plan === "pro" ||
    (access?.trial_end &&
      new Date(access.trial_end).getTime() > Date.now());

  // 🔐 LOAD USER
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
  import("leaflet").then((L) => {
    setLeaflet(L);
  });
}, []);


  // 📦 LOAD CLIENTS
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organisation_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.organisation_id) return;

      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("organisation_id", profile.organisation_id);

      setClients(data || []);
    };

    load();
  }, [user]);

  // 🧠 FIX LEAFLET ICON BUG
  useEffect(() => {
  import("leaflet").then((L) => {
    const icon = L.Icon.Default;

    if ((icon as any)._fixed) return;

    delete (icon.prototype as any)._getIconUrl;

    icon.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    });

    (icon as any)._fixed = true;
  });
}, []);

  // ✅ ACTIVE + VALID COORDS
const isMappedClient = (c: any) =>
  c.status !== "inactive" &&
  typeof c.lat === "number" &&
  typeof c.lng === "number";

// ✅ ROUTE OPTIMISATION (same as before)
const getRouteLines = () => {
  const points = clients.filter(isMappedClient);
  if (points.length < 2) return [];

  const ordered = [points[0]];
  const remaining = points.slice(1);

  while (remaining.length) {
    const last = ordered[ordered.length - 1];

    let closestIndex = 0;
    let closestDistance = Infinity;

    remaining.forEach((point, i) => {
      const dist = Math.sqrt(
        Math.pow(point.lat - last.lat, 2) +
        Math.pow(point.lng - last.lng, 2)
      );

      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = i;
      }
    });

    ordered.push(remaining.splice(closestIndex, 1)[0]);
  }

  return ordered.map((c) => [c.lat, c.lng]);
};

// ✅ RISK SCORE
const calculateRiskScore = (client: any) => {
  let score = 0;

  if (client.falls_risk === "high") score += 3;
  else if (client.falls_risk === "medium") score += 1;

  if (client.mobility_level === "bed_bound") score += 3;
  else if (client.mobility_level === "wheelchair") score += 2;

  if (client.cognition === "advanced_dementia") score += 3;
  else if (client.cognition === "moderate") score += 2;

  return score;
};

if (!access) {
  return <div className="h-screen flex items-center justify-center text-white">Loading...</div>;
}

  return (
    <div className="h-screen w-full bg-black">

      {/* 🔙 BACK */}
      <button
        onClick={() => router.push("/clients")}
        className="absolute z-50 top-4 left-4 bg-black/80 px-4 py-2 rounded text-sm"
      >
        ← Back
      </button>

      {/* 🔒 LOCK */}
      {!hasProAccess && (
        <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center text-center p-6">
          <div>
            <p className="text-lg font-semibold mb-2">
              🔒 Map is Pro Feature
            </p>

            <button
              onClick={() => router.push("/upgrade")}
              className="bg-blue-600 px-4 py-2 rounded mt-2"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}
{leaflet && (
      <MapContainer
  center={[53.258, -2.125]}
  zoom={11}
  className="h-full w-full"
>
  <TileLayer
    attribution="&copy; OpenStreetMap"
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />

  {/* ✅ ROUTE LINE */}
  {hasProAccess && clients.filter(isMappedClient).length > 1 && (
    <Polyline positions={getRouteLines()} />
  )}

  {/* ✅ MARKERS */}
  {clients.filter(isMappedClient).map((client) => {
  if (!leaflet) return null;

  const score = calculateRiskScore(client);

  const icon = new leaflet.Icon({
    iconUrl:
      score >= 6
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : score >= 3
        ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    iconSize: [32, 32],
  });

  return (
    <Marker key={client.id} position={[client.lat, client.lng]} icon={icon}>
      <Popup>
        <div className="text-sm space-y-1">

          <p className="font-semibold">
            {client.first_name} {client.last_name}
          </p>

          {client.address && (
            <p className="text-xs text-gray-400">
              📍 {client.address}
            </p>
          )}

          {client.keysafe_access && (
            <p className="text-xs text-yellow-400">
              🔑 {client.keysafe_access}
            </p>
          )}

          {client.phone && (
            <p className="text-xs text-green-400">
              📞 {client.phone}
            </p>
          )}

          <p className="text-xs mt-1">
            Risk: {score >= 6 ? "CRITICAL" : score >= 3 ? "HIGH" : "LOW"}
          </p>

          <button
            onClick={() => router.push(`/clients/${client.id}`)}
            className="text-blue-400 text-xs mt-2"
          >
            Open profile →
          </button>

        </div>
      </Popup>
    </Marker>
  );
})}
</MapContainer>
)}
    </div>
  );
}