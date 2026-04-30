"use client";

export const dynamic = "force-dynamic";

declare global {
  interface Window {
    google: any;
  }
}

import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import { useMap } from "react-leaflet";
import { careTypes } from "@/lib/careTypes";
import diagnoses from "@/data/diagnoses.json";
import { useAccess } from "@/app/context/AccessContext";

// ✅ FIXED NAME (no conflict with export const dynamic)
const MapContainer = dynamicImport(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamicImport(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamicImport(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamicImport(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// ---------- MAP HELPER ----------
function FitBounds({ clients, enabled }: any) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const valid = clients.filter(
      (c: any) => typeof c.lat === "number" && typeof c.lng === "number"
    );

    if (!valid.length) return;

    map.fitBounds(
      valid.map((c: any) => [c.lat, c.lng]),
      { padding: [50, 50] }
    );
  }, [clients, map, enabled]);

  return null;
}

// ---------- MAIN ----------
export default function Clients() {
  const router = useRouter();
  const access = useAccess();

  // ✅ ALL HOOKS FIRST
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    care_type: "elderly",
    diagnosis: [] as string[],
    address: "",
    lat: null as number | null,
    lng: null as number | null,
    keysafe_access: "",
  });

  // ---------- AUTH LOAD ----------
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
      setAuthLoading(false);
    };

    loadUser();
  }, []);

  // ---------- LOAD CLIENTS ----------
  useEffect(() => {
    if (!user) return;

    const loadClients = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organisation_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.organisation_id) {
        setClients([]);
        return;
      }

      setProfile(profile);

      const { data: clientsData } = await supabase
        .from("clients")
        .select(`
          *,
          assessments (
            dnacpr,
            allergies,
            mca_completed,
            best_interest_completed
          )
        `)
        .eq("organisation_id", profile.organisation_id);

      setClients(clientsData || []);

      const { data: alertData } = await supabase
        .from("alerts")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("status", "active");

      setAlerts(alertData || []);
    };

    loadClients();
  }, [user]);

  // ---------- LEAFLET FIX ----------
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

    setMapReady(true);
  }, []);

  // ---------- SAFETY RETURNS ----------
  if (authLoading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6 text-white">No user</div>;
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen p-6 text-white">

      <h1 className="text-2xl mb-4">Clients</h1>

      {/* MAP */}
      {mapReady && (
        <MapContainer
          center={[53.258, -2.125]}
          zoom={11}
          className="h-64 w-full rounded-lg mb-6"
        >
          <FitBounds clients={clients} enabled={clients.length > 0} />

          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {clients
            .filter(
              (c) =>
                typeof c.lat === "number" &&
                typeof c.lng === "number"
            )
            .map((client) => (
              <Marker key={client.id} position={[client.lat, client.lng]}>
                <Popup>{client.first_name}</Popup>
              </Marker>
            ))}
        </MapContainer>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => router.push(`/clients/${client.id}`)}
            className="p-4 bg-gray-800 rounded cursor-pointer"
          >
            {client.first_name} {client.last_name}
          </div>
        ))}
      </div>

    </div>
  );
}