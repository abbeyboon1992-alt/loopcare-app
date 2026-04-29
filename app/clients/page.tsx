"use client";
declare global {
  interface Window {
    google: any;
  }
}
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { canAccessFeature } from "@/lib/featureAccess";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { careTypes } from "@/lib/careTypes";
import diagnoses from "@/data/diagnoses.json";
import { useMap } from "react-leaflet";
import { useAccess } from "@/app/context/AccessContext";
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

export default function Clients() {
  
  const router = useRouter();
const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};
const [alerts, setAlerts] = useState<any[]>([]);
const access = useAccess();

const [user, setUser] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);
console.log("ACCESS:", access);
const [mapReady, setMapReady] = useState(false);
const [timeLeft, setTimeLeft] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
const [postcode, setPostcode] = useState("");
const [addressResults, setAddressResults] = useState<any[]>([]);
const [showInactiveModal, setShowInactiveModal] = useState(false);
const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
const [inactiveReason, setInactiveReason] = useState("");
const [openAllergies, setOpenAllergies] = useState<string | null>(null);
const [openKeysafe, setOpenKeysafe] = useState<string | null>(null);
const [loadingAddresses, setLoadingAddresses] = useState(false);
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


// LOAD CLIENTS
const loadClients = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("SESSION USER:", user);

  if (!user) {
    console.log("❌ NO USER");
    return;
  }

  // ✅ SAVE USER
  setUser(user);

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
  loadClients();
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

  const user = session?.user;

  if (!user) return;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return;

  const { error } = await supabase.from("clients").insert([
    {
      first_name: form.first_name,
      last_name: form.last_name,
      name: `${form.first_name} ${form.last_name}`,
      date_of_birth: form.date_of_birth || null,
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
  if (!postcode) return alert("Enter postcode");

  setLoadingAddresses(true);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=UK&format=json`
    );

    const data = await res.json();

    if (!data.length) {
      alert("No addresses found");
      setAddressResults([]);
      return;
    }

    const results = data.slice(0, 5).map((item: any) => ({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));

    setAddressResults(results);
  } catch (err) {
    console.error(err);
    alert("Lookup failed");
  }

  setLoadingAddresses(false);
};
const getRouteLines = () => {
  const points = clients
    .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
    .map((c) => [c.lat, c.lng]);

  return points;
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

  score += clientAlerts.length;

  return score;
};

const getRiskBorder = (score: number) => {
  if (score >= 6) return "border-red-500";
  if (score >= 3) return "border-yellow-400";
  return "border-green-500";
};

const getRiskBadge = (score: number) => {
  if (score >= 6)
    return { label: "CRITICAL", color: "bg-red-700" };
  if (score >= 4)
    return { label: "HIGH", color: "bg-orange-600" };
  if (score >= 2)
    return { label: "MEDIUM", color: "bg-yellow-500" };
  return { label: "LOW", color: "bg-green-600" };
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
  
  function FitBounds({ clients }: any) {
  const map = useMap();

  useEffect(() => {
    const valid = clients.filter(
  (c: any) => typeof c.lat === "number" && typeof c.lng === "number"
);

    if (valid.length === 0) return;

    const bounds = valid.map((c: any) => [c.lat, c.lng]);

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [clients, map]);

  return null;
}

if (!user || !profile || !access) {
  return <div className="p-6 text-white">Loading...</div>;
}
  return (
  <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 pt-12">

  {(!user || !profile) ? (
  <div className="p-6 text-white">Loading...</div>
) : (
    <>

    {/* ✅ SAFE LOADING STATE (INSIDE JSX) */}

      <div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl font-bold text-white">Clients</h1>

  <div className="flex gap-2">
    
    {/* ✅ LOGOUT BUTTON (SOLO ONLY) */}
    {access?.accountType === "solo" && (
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 rounded text-sm"
      >
        Logout
      </button>
    )}

    {/* EXISTING ADD CLIENT BUTTON */}
    <button
      onClick={() => {
        setForm({
          first_name: "",
          last_name: "",
          date_of_birth: "",
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
      {showForm ? "Close" : "+ Add Client"}
    </button>

  </div>
</div>
      {access?.trial_end && access.plan === "free" && (
  <div
    className={`mb-4 p-4 rounded flex justify-between items-center ${
      isTrialActive
        ? "bg-yellow-600 text-black"
        : "bg-red-700 text-white"
    }`}
  >

    {isTrialActive ? (
      <span>
        ⏳ Trial active — {timeLeft} remaining
      </span>
    ) : (
      <span>
        🚫 Trial ended — upgrade to unlock routes, alerts & full care planning
      </span>
    )}

    <button
      onClick={(e) => {
  e.stopPropagation();
  router.push("/upgrade");
}}
      className="bg-black text-white px-4 py-2 rounded text-sm font-semibold"
    >
      Upgrade
    </button>

  </div>
)}


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

  <div className="mb-4">
  <label className="text-sm text-[var(--muted)] mb-1 block">
    Postcode Lookup
  </label>

  <div className="flex gap-2 mb-2">
    <input
      placeholder="Enter postcode"
      value={postcode}
      onChange={(e) => setPostcode(e.target.value)}
      className="flex-1 p-3 rounded bg-[var(--card)]"
    />

    <button
      onClick={lookupPostcode}
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

          <button
  onClick={addClient}
            className="w-full bg-green-600 py-3 rounded"
          >
            Save Client
          </button>
        </div>
      )}
{/* 🗺️ CLIENT MAP */}
<div
  className={`mb-6 rounded-lg overflow-hidden relative ${
  access?.plan === "free" ? "blur-[2px] brightness-75" : ""
}`}
>

  {/* 🔒 LOCK OVERLAY */}
  {access?.plan === "free" && !isTrialActive&& (
   <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-none">
      <div className="bg-black/90 text-white px-5 py-5 rounded text-sm text-center max-w-xs shadow-lg">

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
  onClick={(e) => {
    e.stopPropagation();
    router.push("/upgrade");
  }}
  className="bg-blue-600 px-4 py-2 rounded text-xs"
>
    Unlock Map & Routes
  </button>

</div>
    </div>
  )}

  {mapReady && clients.length > 0 && (
    <MapContainer
      key={`clients-map-${clients.length}`}
      center={[53.258, -2.125]}
      zoom={11}
      className="h-64 w-full rounded-lg"
    >
      <FitBounds clients={clients} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
{!isTrialActive && access?.plan === "free" && getRouteLines().length > 1 && (
  <Polyline
  positions={getRouteLines() as any}
    pathOptions={{
      color: "#60a5fa",
      weight: 3,
      opacity: 0.6,
      dashArray: "6,6",
    }}
  />
)}
      {clients
        .filter(
  (c) => typeof c.lat === "number" && typeof c.lng === "number"
)
        .map((client) => (
          <Marker key={client.id} position={[client.lat, client.lng]}>
            <Popup>
  <div className="cursor-pointer">
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/clients/${client.id}`);
      }}
      className="text-blue-400 underline text-sm mb-1"
    >
      Open client
    </button>

    {client.date_of_birth && !isNaN(new Date(client.date_of_birth).getTime()) && (
      <p className="text-xs text-[var(--muted)]">
        🎂 {new Date(client.date_of_birth).toLocaleDateString()} (
        {Math.floor(
          (Date.now() - new Date(client.date_of_birth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
        )} yrs)
      </p>
    )}

    <p className="text-xs mt-1">Tap to open</p>
  </div>
</Popup>
          </Marker>
        ))}
    </MapContainer>
  )}
</div>
      {/* CLIENT LIST */}
      <div className="space-y-3">
  {[...clients]
  .sort((a, b) => {
    const scoreA = calculateRiskScore(a);
    const scoreB = calculateRiskScore(b);
    return scoreB - scoreA;
  })
  .map((client) => {
     const assessments = Array.isArray(client.assessments)
    ? client.assessments[0]
    : client.assessments;
    const mcaComplete = assessments?.mca_completed === true;

const bestInterestComplete =
  assessments?.best_interest_completed === true ||
  assessments?.best_interest_completed === "yes";

const hasAssessment = !!assessments;

const isAssessmentComplete =
  mcaComplete && bestInterestComplete;

const isAssessmentStarted =
  hasAssessment && !isAssessmentComplete;

const progress = !hasAssessment
  ? 0
  : isAssessmentComplete
  ? 100
  : mcaComplete || bestInterestComplete
  ? 50
  : 25;

    const riskScore = calculateRiskScore(client);
    const borderColor = getRiskBorder(riskScore);
    const clientAlerts = alerts.filter(
  (a: any) => a.client_id === client.id && a.status === "active"
);


    return (
      <div
  key={client.id}
  onClick={() => {
  if (!client.id) return;
  router.push(`/clients/${client.id}`);
}}
  className={`bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg cursor-pointer hover:bg-[#334155] border ${
    access?.plan === "pro" ? borderColor : "border-transparent"
  } ${(client.status ?? "active") === "inactive" ? "opacity-50" : ""}`}
  
>
        {/* 🔹 TOP ROW */}
        <div className="flex justify-between items-center">

          <p className="font-semibold">
            {client.first_name} {client.last_name}
          </p>

          <div className="flex items-center gap-2">

            {/* TOGGLE */}
<button
  onClick={(e) => {
    e.stopPropagation();
    handleToggleClick(client.id, client.status);
  }}
  className={`text-xs px-2 py-1 rounded ${
    (client.status ?? "active") === "inactive"
      ? "bg-green-600"
      : "bg-red-600"
  }`}
>
  {(client.status ?? "active") === "inactive"
    ? "Activate"
    : "Set Inactive"}
</button>

            {/* RISK BADGE */}
            {(() => {
  const badge = getRiskBadge(riskScore);
  return (
    <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
      {badge.label}
    </span>
  );
})()}

          </div>
        </div>

        {/* 📍 ADDRESS */}
        {client.address && (
          <p className="text-sm text-[var(--muted)]">
            {client.address}
          </p>
        )}

        {client.keysafe_access && (
  <div className="relative">
    <span
      onClick={(e) => {
        e.stopPropagation(); // 🚫 stop opening client page
        setOpenKeysafe(
          openKeysafe === client.id ? null : client.id
        );
      }}
      className="text-xs bg-blue-600 px-2 py-1 rounded cursor-pointer"
    >
      🔑 Key Safe
    </span>

    {openKeysafe === client.id && (
      <div className="absolute z-50 mt-2 bg-[var(--card)] p-3 rounded shadow-lg text-xs w-40">
        <p className="font-semibold mb-1">Access Code</p>

        <p className="text-white tracking-widest text-sm">
          {client.keysafe_access}
        </p>
      </div>
    )}
  </div>
)}

        {/* CARE TYPE */}
        <p className="text-sm text-[var(--muted)]">
          {client.care_type}
        </p>

        {/* DIAGNOSIS */}
        {client.diagnosis && (
          <p className="text-xs text-gray-500 mt-1">
            {Array.isArray(client.diagnosis)
              ? client.diagnosis.join(", ")
              : client.diagnosis}
          </p>
        )}

        {/* 🚨 TAGS */}
        {!hasAssessment && (
  <span className="text-xs bg-red-600 px-2 py-1 rounded">
    ⚠️ No Assessment
  </span>
)}

{isAssessmentStarted && (
  <span className="text-xs bg-yellow-600 px-2 py-1 rounded">
    🧠 Incomplete Assessment
  </span>
)}
        <div className="flex gap-2 mt-2 flex-wrap">
{mcaComplete && bestInterestComplete && (
  <span className="text-xs bg-green-600 px-2 py-1 rounded">
    ✅ Capacity Complete
  </span>
)}
          {assessments?.dnacpr && (
  <span className="text-xs bg-red-700 px-2 py-1 rounded">
    DNACPR
  </span>
)}

{assessments?.allergies && (
  <div className="relative">
    <span
      onClick={(e) => {
        e.stopPropagation(); // 🚫 STOP opening client page
        setOpenAllergies(
          openAllergies === client.id ? null : client.id
        );
      }}
      className="text-xs bg-yellow-600 px-2 py-1 rounded cursor-pointer"
    >
      Allergies
    </span>

    {openAllergies === client.id && (
      <div className="absolute z-50 mt-2 bg-[var(--card)] p-3 rounded shadow-lg text-xs w-64">
        <p className="font-semibold mb-1">Allergies</p>

        <p className="text-gray-300">
          {assessments.allergies}
        </p>
      </div>
    )}
  </div>
)}

{!mcaComplete &&
  clientAlerts.some((a) => a.type === "mca_missing") && (
  <span className="text-xs bg-purple-700 px-2 py-1 rounded">
    🧠 MCA Required
  </span>
)}

{!bestInterestComplete &&
  clientAlerts.some((a) => a.type === "best_interest_missing") && (
  <span className="text-xs bg-orange-600 px-2 py-1 rounded">
    ⚖️ Best Interest
  </span>
)}

{clientAlerts.some((a) => a.type === "safeguarding") && (
  <span className="text-xs bg-red-800 px-2 py-1 rounded">
    🚨 Safeguarding
  </span>
)}
        </div>
        <div className="mt-2">
  <div className="flex justify-between text-xs mb-1 text-[var(--muted)]">
    <span>Assessment</span>
    <span>{progress}%</span>
  </div>

  <div className="w-full bg-gray-700 rounded h-2">
    <div
      className={`h-2 rounded ${
        progress === 100
          ? "bg-green-600"
          : progress >= 50
          ? "bg-yellow-500"
          : "bg-blue-500"
      }`}
      style={{ width: `${progress}%` }}
    />
  </div>
</div>
<div className="mt-3">
  {access && canAccessFeature(
  "assessments",
  access?.plan,
  access.accountType,
  isTrialActive
) ? (
    <>
      {!hasAssessment && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/assessments?client=${client.id}`);
          }}
          className="text-xs bg-blue-500 px-3 py-1 rounded"
        >
          Start Assessment
        </button>
      )}

      {isAssessmentStarted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/assessments?client=${client.id}`);
          }}
          className="text-xs bg-yellow-500 text-black px-3 py-1 rounded"
        >
          Continue Assessment
        </button>
      )}

      {isAssessmentComplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/assessments?client=${client.id}`);
          }}
          className="text-xs bg-green-600 px-3 py-1 rounded"
        >
          View Assessment
        </button>
      )}
    </>
  ) : (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push("/upgrade");
      }}
      className="text-xs bg-yellow-500 text-black px-3 py-1 rounded"
    >
      🔒 Upgrade for Assessments
    </button>
  )}
</div>
        {/* INACTIVE REASON */}
        {(client.status ?? "active") === "inactive" && client.inactive_reason && (
          <p className="text-xs text-red-400 mt-2">
            Reason: {client.inactive_reason}
          </p>
        )}

      </div>
    );
  })}

{clients.length === 0 && (
  <p className="text-gray-500 mt-6">
    No clients yet
  </p>
)}

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
        <button
          onClick={() => setShowInactiveModal(false)}
          className="px-3 py-1 bg-gray-600 rounded"
        >
          Cancel
        </button>

        <button
          onClick={() => {
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
          </>
        )
      }
  </div>
);
}