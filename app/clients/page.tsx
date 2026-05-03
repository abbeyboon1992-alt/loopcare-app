"use client";
export const dynamic = "force-dynamic";
declare global {
  interface Window {
    google: any;
  }
}
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import { canAccessFeature } from "@/lib/featureAccess";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import { useMap } from "react-leaflet";
import { careTypes } from "@/lib/careTypes";
import diagnoses from "@/data/diagnoses.json";
import { useAccess } from "@/app/context/AccessContext";

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

const Polyline = dynamicImport(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);
function FitBounds({ clients, enabled }: any) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const valid = clients.filter(
  (c: any) =>
    c.status !== "inactive" &&
    typeof c.lat === "number" &&
    typeof c.lng === "number"
);
    if (valid.length === 0) return;

    const bounds = valid.map((c: any) => [c.lat, c.lng]);

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [clients, map, enabled]);

  return null;
}
export default function Clients() {
  const [authLoading, setAuthLoading] = useState(true);
  
  const router = useRouter();
const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};
const [alerts, setAlerts] = useState<any[]>([]);

const access = useAccess();
const hasProAccess = !!(
  access?.plan === "pro" ||
  (access?.trial_end &&
    new Date(access.trial_end).getTime() > Date.now())
);

const [user, setUser] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);

const [mapReady, setMapReady] = useState(false);
const [timeLeft, setTimeLeft] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
const [postcode, setPostcode] = useState("");
const [addressResults, setAddressResults] = useState<any[]>([]);
const [showInactiveModal, setShowInactiveModal] = useState(false);
const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
const [inactiveReason, setInactiveReason] = useState("");
const [loadingAddresses, setLoadingAddresses] = useState(false);
const [search, setSearch] = useState("");
// ✅ helper: only active clients with valid coords
const isActiveMappedClient = (c: any) =>
  c.status !== "inactive" &&
  typeof c.lat === "number" &&
  typeof c.lng === "number";
  const [form, setForm] = useState({
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  care_type: "elderly",
  diagnosis: [] as string[],
  address: "",
  lat: null as number | null,
  lng: null as number | null,
  keysafe_access: "",
});


// LOAD CLIENTS
const loadClients = async () => {
  if (!user) return;

  console.log("SESSION USER:", user);

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("PROFILE RESULT:", profile);
  console.log("PROFILE ERROR:", profileError);
  console.log("ORG ID USED:", profile?.organisation_id);
setProfile(profile);
  if (!profile?.organisation_id) {
  console.log("❌ NO ORG ID — user not linked properly");
  setClients([]); // prevent map crash
  return;
}

  const { data: clientsData, error: clientsError } = await supabase
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
  .eq("organisation_id", profile.organisation_id)
  .order("created_at", { ascending: false });

console.log("CLIENTS RAW:", clientsData);
console.log("CLIENTS ERROR:", clientsError);

setClients(clientsData || []);
  

  const { data: alertData } = await supabase
  .from("alerts")
  .select("*")
  .eq("organisation_id", profile.organisation_id) // ✅ FIX
  .eq("status", "active");

  setAlerts(alertData || []);
};

useEffect(() => {
  if (!user) return;

  loadClients();
}, [user]);

useEffect(() => {
  console.log("ACCESS:", access);
}, [access]);

useEffect(() => {
  const loadUser = async () => {
    const {
  data: { session },
} = await supabase.auth.getSession();

setUser(session?.user);
setAuthLoading(false);
  };

  loadUser();
}, []);


  // ✅ FIX LEAFLET SSR ERROR
  useEffect(() => {
  if (typeof window === "undefined") return;

  import("leaflet").then((L) => {
    const icon = L.Icon.Default;

    // ✅ only run if not already fixed
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

    // ✅ attach flag to SAFE place (not L itself)
    (icon as any)._fixed = true;
  });
}, []);

useEffect(() => {
  setMapReady(true);
}, []);

useEffect(() => {
  if (!access?.trial_end) return;

  const updateCountdown = () => {
    const now = Date.now();

    const end = new Date(access.trial_end as string).getTime();
    if (isNaN(end)) return;

    const diff = end - now; // ✅ FIX ADDED BACK

    if (diff <= 0) {
      setTimeLeft("Expired");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);

    if (days > 0) {
      setTimeLeft(`${days}d ${hours}h`);
    } else {
      setTimeLeft(`${hours}h ${mins}m`);
    }
  };

  updateCountdown();
  const interval = setInterval(updateCountdown, 60000);

  return () => clearInterval(interval);
}, [access?.trial_end]);

// ADD CLIENT
const addClient = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const currentUser = session?.user;
if (!currentUser) return;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!profile) return;

  const { error } = await supabase.from("clients").insert([
    {
      first_name: form.first_name,
      last_name: form.last_name,
      name: `${form.first_name} ${form.last_name}`,
      date_of_birth: form.date_of_birth || null,
      phone: form.phone,
      care_type: form.care_type,
      diagnosis: form.diagnosis,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      keysafe_access: form.keysafe_access,
      organisation_id: profile.organisation_id,
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  setForm({
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  care_type: "elderly",
  diagnosis: [],
  address: "",
  lat: null,
  lng: null,
  keysafe_access: "",
});

  setShowForm(false);
  loadClients();
  // 🔥 get newly created client id
const { data: newClient } = await supabase
  .from("clients")
  .select("id")
  .eq("organisation_id", profile.organisation_id)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
};

const lookupPostcode = async () => {
  if (!postcode.trim()) return alert("Enter postcode or address");

  setLoadingAddresses(true);

  try {
    const res = await fetch(
  `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=gb&q=${encodeURIComponent(postcode)}`
);

    const data = await res.json();

    if (!data || data.length === 0) {
      alert("No addresses found");
      setAddressResults([]);
      return;
    }

    const results = data.map((item: any) => {
  const a = item.address || {};

  const line1 = [
    a.house_number,
    a.road
  ].filter(Boolean).join(" ");

  const line2 = [
    a.city || a.town || a.village,
    a.postcode
  ].filter(Boolean).join(", ");

  return {
    address: [line1, line2].filter(Boolean).join(", "),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };
});

    setAddressResults(results);
  } catch (err) {
    console.error(err);
    alert("Lookup failed");
  }

  setLoadingAddresses(false);
};
const getRouteLines = () => {
  const points = clients.filter(isActiveMappedClient);

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

const calculateRiskScore = (client: any) => {
  let score = 0;

  if (client.falls_risk === "high") score += 3;
  else if (client.falls_risk === "medium") score += 1;

  if (client.mobility_level === "bed_bound") score += 3;
  else if (client.mobility_level === "wheelchair") score += 2;

  if (client.cognition === "advanced_dementia") score += 3;
  else if (client.cognition === "moderate") score += 2;

  // fallback to alerts if no clinical data
  const clientAlerts = alerts.filter(
  (a: any) => a.client_id === client.id
);

  clientAlerts.forEach((a) => {
  if (a.severity === "critical") score += 3;
  else if (a.severity === "high") score += 2;
  else score += 1;
});

  return score;
};

const getRiskBorder = (score: number) => {
  if (score >= 6) return "border-red-500";
  if (score >= 3) return "border-yellow-400";
  return "border-green-500";
};

const getRiskBadge = (score: number) => {
  if (score >= 6)
    return { label: "CRITICAL RISK", color: "bg-red-700" };
  if (score >= 4)
    return { label: "HIGH RISK", color: "bg-orange-600" };
  if (score >= 2)
    return { label: "MEDIUM RISK", color: "bg-yellow-500" };
  return { label: "LOW RISK", color: "bg-green-600" };
};

const handleToggleClick = (clientId: string, currentStatus: string) => {
  const status = currentStatus || "active";

  if (status === "active") {
    // open modal instead of prompt
    setSelectedClientId(clientId);
    setInactiveReason("");
    setShowInactiveModal(true);
  } else {
    // reactivate immediately
    updateClientStatus(clientId, "active", null);
  }
};

const updateClientStatus = async (
  clientId: string,
  newStatus: "active" | "inactive",
  reason: string | null
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (!user) return;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("clients")
    .update({
      status: newStatus,
      inactive_reason: newStatus === "inactive" ? reason : null,
    })
    .eq("id", clientId)
    .eq("organisation_id", profile?.organisation_id);

    await supabase.from("client_status_history").insert([
  {
    client_id: clientId,
    organisation_id: profile?.organisation_id,
    status: newStatus,
    reason: newStatus === "inactive" ? reason : null,
    changed_by: user.id,
  },
]);

  if (error) {
    alert("Failed to update");
    return;
  }

  // instant UI update (no reload)
  setClients((prev: any[]) =>
    prev.map((c) =>
      c.id === clientId
        ? {
            ...c,
            status: newStatus,
            inactive_reason: reason,
          }
        : c
    )
  );

  setShowInactiveModal(false);
};
const isTrialActive =
  !!access?.trial_end &&
  !isNaN(new Date(access.trial_end as string).getTime()) &&
  new Date(access.trial_end as string).getTime() > Date.now();

  const isFreeUser = access?.plan !== "pro" && !isTrialActive;
  

if (authLoading) {
  return <div className="p-6 text-white">Loading...</div>;
}

if (!access) {
  return <div className="p-6 text-white">Loading access...</div>;
}

if (!user) {
  return <div className="p-6 text-white">No user</div>;
}
 return (
  <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">

    {/* 🔒 STICKY UPGRADE BAR */}
    <div className="sticky top-0 z-30 px-6 pt-4">
      {access && (
        <div className="px-4 py-2 rounded-lg flex justify-between items-center text-sm bg-[var(--card)] border border-[var(--border)] shadow-md">
          
          <span className="font-medium">
            {isTrialActive
              ? `⏳ Trial: ${timeLeft} left`
              : access?.plan === "pro"
              ? "✅ Pro Plan Active"
              : "🔓 Free Plan"}
          </span>

          {access?.plan !== "pro" && (
            <button
  type="button"
  onClick={() => window.location.href = "/upgrade"}
  className="bg-blue-600 px-3 py-1 rounded text-xs"
>
  Upgrade
</button>
          )}
        </div>
      )}
    </div>
    <div className="p-6 pt-4">
      <div className="flex justify-between items-center mb-6">
  <div className="flex gap-2">
    <input
  placeholder="Search..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="w-full mt-3 p-3 rounded bg-[var(--card)] text-sm"
/>

    {/* EXISTING ADD CLIENT BUTTON */}
    <button type="button" onClick={() => {
      console.log("CLICK WORKING");
    if (isFreeUser && clients.length >= 1) {
      alert("Free plan allows 1 client only. Upgrade to add more.");
      return;
    }

    setForm({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      phone: "",
      care_type: "elderly",
      diagnosis: [],
      address: "",
      lat: null,
      lng: null,
      keysafe_access: "",
    });

    setShowForm(!showForm);
  }}
  className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
>
  {showForm ? "Close" : "+ Add New"}
</button>

  </div>
</div>

      {/* ADD CLIENT FORM */}
      {showForm && (
        <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">
          <h2 className="mb-4 text-lg">New Client</h2>

          <input
  placeholder="First name"
  value={form.first_name}
  onChange={(e) =>
    setForm({ ...form, first_name: e.target.value })
  }
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

<input
  placeholder="Last name"
  value={form.last_name}
  onChange={(e) =>
    setForm({ ...form, last_name: e.target.value })
  }
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

<input
  type="date"
  value={form.date_of_birth}
  onChange={(e) =>
    setForm({ ...form, date_of_birth: e.target.value })
  }
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

<input
  placeholder="Keysafe / Access Code"
  value={form.keysafe_access}
  onChange={(e) =>
    setForm({ ...form, keysafe_access: e.target.value })
  }
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

<input
  placeholder="Contact number"
  value={form.phone}
  onChange={(e) =>
    setForm({ ...form, phone: e.target.value })
  }
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

  <div className="mb-4">
  <label className="text-sm text-[var(--muted)] mb-1 block">
    Address / Postcode Search
  </label>

  <div className="flex gap-2 mb-2">
    <input
      placeholder="Enter address or postcode"
      value={postcode}
      onChange={(e) => setPostcode(e.target.value)}
      className="flex-1 p-3 rounded bg-[var(--card)]"
    />

    <button type="button" onClick={lookupPostcode}
      className="bg-blue-600 px-4 rounded"
    >
      {loadingAddresses ? "..." : "Find"}
    </button>
  </div>

  {/* ADDRESS RESULTS */}
  {addressResults.length > 0 && (
    <div className="bg-[var(--card)] rounded border border-[var(--border)]-700 max-h-40 overflow-y-auto">
      {addressResults.map((item, i) => (
        <div
          key={i}
          onClick={() => {
            setForm({
              ...form,
              address: item.address,
              lat: item.lat,
              lng: item.lng,
            });
            setAddressResults([]);
          }}
          className="p-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--card)]"
        >
          {item.address}
        </div>
      ))}
    </div>
  )}
{/* ✍️ MANUAL ADDRESS INPUT (FALLBACK) */}
<input
  placeholder="Or enter address manually"
  value={form.address}
  onChange={(e) =>
    setForm({
      ...form,
      address: e.target.value,
      lat: null,   // optional: clear coords if manual
      lng: null,
    })
  }
  className="w-full p-3 rounded bg-[var(--card)] mb-2"
/>
  {/* SELECTED ADDRESS */}
  {form.address && (
    <div className="mt-2 p-3 bg-green-900/20 border border-green-700 rounded text-sm">
      📍 {form.address}
    </div>
  )}
</div>

          <select
            value={form.care_type}
            onChange={(e) =>
              setForm({ ...form, care_type: e.target.value })
            }
            className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
          >
            {Object.keys(careTypes).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <div className="mb-3">
  <p className="mb-2 text-sm text-[var(--muted)]">Diagnosis</p>

  <div className="flex flex-wrap gap-2">
    {diagnoses.map((d: string) => {
      const selected = form.diagnosis.includes(d);

      return (
        <button
          key={d}
          onClick={() => {
            const exists = form.diagnosis.includes(d);

            setForm({
              ...form,
              diagnosis: exists
                ? form.diagnosis.filter((x) => x !== d)
                : [...form.diagnosis, d],
            });
          }}
          className={`px-3 py-2 rounded text-sm border ${
  selected
    ? "bg-blue-600 border-blue-400"
    : "bg-[var(--card)] border-[var(--border)]-700"
}`}
        >
          {d}
        </button>
      );
    })}
  </div>
</div>

          <button type="button" onClick={addClient}
            className="w-full bg-green-600 py-3 rounded"
          >
            Save Client
          </button>
        </div>
      )}

  {/* 🗺️ CLIENT MAP */}
<div
  className={`mb-8 rounded-xl relative h-[300px] ${
    !hasProAccess ? "brightness-75" : ""
  }`}
  style={{ zIndex: 0 }}
>

  {/* 🔒 LOCK OVERLAY */}
  {!hasProAccess && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
      <div className="bg-black/90 text-white px-5 py-5 rounded text-sm text-center max-w-xs shadow-lg pointer-events-auto">

        <p className="font-semibold text-sm mb-2">
          🔒 You're Missing Route Planning
        </p>

        <p className="text-xs text-gray-300 mb-3">
          See all clients on a map, plan efficient visits, and cut travel time.
        </p>

        <p className="text-xs text-red-400 mb-4">
          Without this, you're working blind.
        </p>

        <button
  type="button"
  onClick={() => router.push("/upgrade")}
  className="bg-blue-600 px-3 py-1 rounded text-xs"
>
  Unlock Map & Routes
</button>

      </div>
    </div>
  )}

  {hasProAccess && (
    <div className="mb-2 text-xs text-gray-400">
      Optimised route enabled
    </div>
  )}

  {/* ✅ MAP */}
  {mapReady && (
    <MapContainer
  key="clients-map"
  center={[53.258, -2.125]}
  zoom={11}
  scrollWheelZoom={false}
  dragging={false}
  touchZoom={false}
  doubleClickZoom={false}
  zoomControl={false}
  style={{ pointerEvents: hasProAccess ? "auto" : "none" }}
  attributionControl={false}
  className="h-72 sm:h-80 w-full rounded-lg"
>
      <FitBounds clients={clients} enabled={clients.length > 0} />

      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {clients.length} clients
      </div>

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {hasProAccess && clients.length > 1 && (
        <Polyline positions={getRouteLines()} />
      )}

      {clients.filter(isActiveMappedClient).map((client) => (
        <Marker
          key={client.id}
          position={[client.lat, client.lng]}
          icon={
            new (require("leaflet")).Icon({
              iconUrl:
                calculateRiskScore(client) >= 6
                  ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                  : calculateRiskScore(client) >= 3
                  ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
                  : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
              iconSize: [32, 32],
            })
          }
        >
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
                Risk: {getRiskBadge(calculateRiskScore(client)).label}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )}

</div>

{/* CLIENT LIST */}
<div className="space-y-5 mt-6 relative z-20">
{(clients || [])
  .filter((client: any) =>
    `${client.first_name} ${client.last_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  .map((client: any, index: number) => {
  const isLocked = isFreeUser && index >= 1;
  const assessments = Array.isArray(client.assessments)
    ? client.assessments[0]
    : client.assessments || {};

  const clientAlerts =
    alerts.filter(
      (a: any) => a.client_id === client.id && a.status === "active"
    ) || [];

  const hasAddress = !!client.address;

  const hasMCAAlert = clientAlerts.some((a) => a.type === "mca_missing");
  const hasBestInterestAlert = clientAlerts.some((a) => a.type === "best_interest_missing");
  const hasSafeguarding = clientAlerts.some((a) => a.type === "safeguarding");

  const mcaComplete = assessments.mca_completed === true;
  const bestInterestComplete =
    assessments.best_interest_completed === true ||
    assessments.best_interest_completed === "yes";

  const hasAssessment = Object.keys(assessments).length > 0;

  const isAssessmentComplete = mcaComplete && bestInterestComplete;
  const isAssessmentStarted = hasAssessment && !isAssessmentComplete;

  const progress = !hasAssessment
    ? 0
    : isAssessmentComplete
    ? 100
    : mcaComplete || bestInterestComplete
    ? 50
    : 25;

  const riskScore = calculateRiskScore(client);
  const borderColor = getRiskBorder(riskScore);
  const badge = getRiskBadge(riskScore);

  return (
  <div
  key={client.id}
  className={`bg-[var(--card)] p-4 sm:p-5 rounded-xl border shadow-sm ${
    isLocked ? "opacity-50 border-blue-600" : borderColor
  }`}
  onClick={() => {}}
>
    {/* HEADER */}
<div className="flex justify-between items-start gap-4">

  {/* LEFT SIDE → CLIENT DETAILS */}
  <div className="flex-1 space-y-1">
    {/* NAME */}
    <p className="font-semibold text-base">
      {client.first_name} {client.last_name}
    </p>

    {/* ADDRESS */}
{client.address && (
  <p className="text-xs text-gray-400">
    📍 {client.address}
  </p>
)}

{/* KEYSAFE */}
{client.keysafe_access && (
  <p className="text-xs text-yellow-400">
    🔑 {client.keysafe_access}
  </p>
)}

{/* DOB */}
{client.date_of_birth && (
  <p className="text-xs text-gray-400">
    🎂 {new Date(client.date_of_birth).toLocaleDateString()}
  </p>
)}

{/* PHONE (click to call) */}
{client.phone && (
  <button type="button" onClick={(e) => {
      e.stopPropagation();
      window.location.href = `tel:${client.phone}`;
    }}
    className="text-xs text-green-400 text-left"
  >
    📞 {client.phone}
  </button>
)}
  </div>

  {/* RIGHT SIDE → STACKED ACTIONS */}
  <div className="mt-3 flex gap-2 flex-wrap relative z-[9999]">

    {/* ➡️ OPEN */}
    <button
  type="button"
  onClick={() => {
    if (isLocked) {
      router.push("/upgrade");
    } else {
      window.location.href = `/clients/${client.id}`;
    }
  }}
  style={{ position: "relative", zIndex: 9999, background: "red" }}
  className="w-10 h-10 flex items-center justify-center text-lg rounded-full active:scale-95"
>
  ➡️
</button>

    {/* STATUS */}
    <button type="button" onClick={(e) => {
        e.stopPropagation();
        if (isLocked) {
          router.push("/upgrade");
          return;
        }
        handleToggleClick(client.id, client.status);
      }}
      className={`text-xs px-2 py-1 rounded ${
        client.status === "inactive"
          ? "bg-gray-600"
          : "bg-blue-600"
      }`}
    >
      {client.status === "inactive" ? "Inactive" : "Active"}
    </button>

    {/* RISK */}
    <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
      {badge.label}
    </span>

  </div>
</div>
{isLocked && (
  <div className="mt-2">
    <p className="text-xs text-blue-400 font-medium mb-2">
      🔒 Upgrade to unlock this client
    </p>

    <button
      type="button"
      onClick={() => router.push("/upgrade")}
      className="text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition"
    >
      Upgrade Now
    </button>
  </div>
)}

    {/* ACTIONS */}
    <div className="mt-3 flex gap-2 flex-wrap relative z-[9999]">

      {!hasAssessment && (
        <button
  type="button"
  onClick={() => {
    if (isLocked) {
      router.push("/upgrade");
    } else {
      router.push(`/assessments?client=${client.id}`);
    }
  }}
  className="text-xs bg-blue-600 px-3 py-2 rounded min-h-[36px]"
>
  Start Assessment
</button>
      )}

      {isAssessmentStarted && (
        <button type="button" onClick={() => {
  if (isLocked) {
    window.location.href = "/upgrade";
  } else {
    window.location.href = `/assessments?client=${client.id}`;
  }
}}
          className="text-xs bg-yellow-600 px-2 py-1 rounded"
        >
          Continue Assessment
        </button>
      )}

      {isAssessmentComplete && (
        <span className="text-xs bg-green-600 px-2 py-1 rounded">
          ✔ Assessment Complete
        </span>
      )}
    </div>

    {/* BADGES */}
    <div className="flex flex-wrap gap-2 mt-3">

  {!hasAssessment && (
    <span className="text-xs bg-red-600 px-2 py-1 rounded">
      ⚠️ No Assessment
    </span>
  )}

  {!mcaComplete && hasMCAAlert && (
    <span className="text-xs bg-purple-700 px-2 py-1 rounded">
      🧠 MCA Required
    </span>
  )}

  {!bestInterestComplete && hasBestInterestAlert && (
    <span className="text-xs bg-orange-600 px-2 py-1 rounded">
      ⚖️ Best Interest
    </span>
  )}

  {hasSafeguarding && (
    <span className="text-xs bg-red-800 px-2 py-1 rounded">
      🚨 Safeguarding
    </span>
  )}

</div>
  </div>
);
})}
</div> {/* CLIENT LIST */}
{showInactiveModal && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-[var(--card)] p-6 rounded-lg w-80">
      <h2 className="text-lg font-semibold mb-3 text-white">
        Set Client Inactive
      </h2>

      <textarea
        placeholder="Enter reason..."
        value={inactiveReason}
        onChange={(e) => setInactiveReason(e.target.value)}
        className="w-full p-2 rounded bg-[var(--card)] text-white mb-4"
      />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setShowInactiveModal(false)}
          className="px-3 py-1 bg-gray-600 rounded"
        >
          Cancel
        </button>

        <button type="button" onClick={() => {
            if (!inactiveReason.trim()) {
              alert("Please enter a reason");
              return;
            }

            if (selectedClientId) {
              updateClientStatus(
                selectedClientId,
                "inactive",
                inactiveReason
              );
            }
          }}
          className="px-3 py-1 bg-red-600 rounded"
        >
           Confirm
        </button>
      </div>
    </div>
  </div>
)}
  </div>  {/* closes p-6 pt-4 */}
  </div>  
);
}