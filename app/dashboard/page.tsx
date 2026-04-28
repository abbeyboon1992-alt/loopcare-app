"use client";
import { useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { MapContainerProps } from "react-leaflet";
import { Area } from "recharts";
import { useAccess } from "@/app/context/AccessContext";
import { canAccessFeature } from "@/lib/featureAccess";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
// 🔥 Dynamic map (no SSR crash)
const MapContainer = dynamic<MapContainerProps>(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
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

const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);

export default function DashboardPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const access = useAccess();

if (!access) {
  return null; // prevents undefined access
}

// ✅ tell TS it's safe from here
const plan = access.plan;
const accountType = access.accountType;

if (!canAccessFeature("teamDashboard", access.plan,
  access.accountType,
  access.isTrialActive
)) {
  return (
    <div className="p-6 text-center">
      <p className="mb-4">Upgrade to access dashboard</p>
      <button
        onClick={() => router.push("/upgrade")}
        className="bg-yellow-500 px-4 py-2 rounded"
      >
        Upgrade
      </button>
    </div>
  );
}
  const [route, setRoute] = useState<any[]>([]);
  const [assessmentStats, setAssessmentStats] = useState({
  highRisk: 0,
  safeguarding: 0,
  overdue: 0,
});

const [assessmentsData, setAssessmentsData] = useState<any[]>([]);
const [clinicalAlerts, setClinicalAlerts] = useState<
  { message: string; client_id: string }[]
>([]);

const [trendData, setTrendData] = useState<any[]>([]);
const [insights, setInsights] = useState<any>({
  improving: 0,
  declining: 0,
});

const [aiSummary, setAiSummary] = useState<string>("");

// 🧠 AI SUMMARY GENERATOR
const generateAISummary = () => {
  if (!alerts.length) return "All clients currently stable.";

  const high = alerts.filter(a => a.severity === "high").length;
  const critical = alerts.filter(a => a.severity === "critical").length;

  const declining = insights.declining;
  const improving = insights.improving;

  let summary = "";

  if (critical > 0) {
    summary += `${critical} critical cases require urgent action. `;
  }

  if (declining > improving) {
    summary += `Overall trend worsening across clients. `;
  }

  if (improving > declining) {
    summary += `Care outcomes improving across multiple clients. `;
  }

  if (high > 0) {
    summary += `${high} high-risk issues still active. `;
  }

  return summary || "Care environment stable.";
};

const generateClinicalAlerts = (assessments: any[]) => {
  const alerts: { message: string; client_id: string }[] = [];

  assessments.forEach((a) => {
    // 🚨 NEWS2
    if (a.news2_score >= 7) {
      alerts.push({
        message: "🚨 Emergency NEWS2 score detected",
        client_id: a.client_id,
      });
    } else if (a.news2_score >= 5) {
      alerts.push({
        message: "⚠️ Urgent clinical review required (NEWS2)",
        client_id: a.client_id,
      });
    }

    // 🥤 MUST
    if (a.must_score >= 2) {
      alerts.push({
        message: "🚨 High malnutrition risk (MUST)",
        client_id: a.client_id,
      });
    }

    // 🛏️ Waterlow
    if (a.waterlow_score >= 20) {
      alerts.push({
        message: "🚨 Very high pressure sore risk",
        client_id: a.client_id,
      });
    }

    // 🧠 Frailty
    if (a.frailty_score >= 7) {
      alerts.push({
        message: "🚨 Severe frailty risk",
        client_id: a.client_id,
      });
    }

    // ⚖️ Safeguarding
    if (a.safeguarding === "concern") {
      alerts.push({
        message: "🚨 Active safeguarding concern",
        client_id: a.client_id,
      });
    }

    // 💊 Medication review overdue
    if (a.medication_review_date) {
      const diff =
        Date.now() - new Date(a.medication_review_date).getTime();

      if (diff > 1000 * 60 * 60 * 24 * 180) {
        alerts.push({
          message: "⚠️ Medication review overdue",
          client_id: a.client_id,
        });
      }
    }

    // 📅 MDT overdue
    if (a.mdt_last_meeting) {
      const diff =
        Date.now() - new Date(a.mdt_last_meeting).getTime();

      if (diff > 1000 * 60 * 60 * 24 * 365) {
        alerts.push({
          message: "⚠️ MDT review overdue",
          client_id: a.client_id,
        });
      }
    }
  });

  return alerts;
};

  useEffect(() => {
  const L = require("leaflet");
  delete (L.Icon.Default.prototype as any)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
  setAiSummary(generateAISummary());
}, [alerts]);

  useEffect(() => {
  const channel = supabase
    .channel("alerts-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "alerts",
      },
      (payload) => {
        setAlerts((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  const loadData = async () => {
  // 🔥 GET USER ORG ID FIRST
  const { data: userData } = await supabase.auth.getUser();

const { data: profile } = await supabase
  .from("user_profiles")
  .select("organisation_id")
  .eq("user_id", userData?.user?.id)
  .single();

const orgId = profile?.organisation_id;

  // 🔥 PLAN
  let planType: "free" | "pro" = "free";

  if (orgId) {
    const { data: org } = await supabase
      .from("organisations")
      .select("subscription_status")
      .eq("id", orgId)
      .single();

    if (org?.subscription_status === "active") {
      planType = "pro";
    }
  }


  // 🔥 ALERT HISTORY (TRENDS)
  const { data: history } = await supabase
    .from("alerts")
    .select("client_id, severity, status, created_at, type")
    .order("created_at", { ascending: true });

  if (history) {
    setTrendData(history);

    const improving = history.filter(
      (a: any) =>
        a.status === "resolved" &&
        (a.type?.includes("improving") || a.severity === "low")
    ).length;

    const declining = history.filter(
      (a: any) =>
        a.status === "active" &&
        (a.severity === "high" || a.severity === "critical")
    ).length;

    setInsights({ improving, declining });
  }

  // 🔥 CLIENTS + ACTIVE ALERTS
  const { data: clientsData } = await supabase.from("clients").select("*");
  const { data: visitData } = await supabase
  .from("visit_notes")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(50);

if (visitData) setVisits(visitData);

  const { data: alertsData } = await supabase
    .from("alerts")
    .select("*")
    .eq("status", "active");

  // 🔥 assessments STATS
  let stats = {
    highRisk: 0,
    safeguarding: 0,
    overdue: 0,
  };

  let assessments: any[] = [];

if (orgId) {
  const { data } = await supabase
    .from("assessments")
    .select("*")
    .eq("organisation_id", orgId);

  if (data) {
    assessments = data;
    setAssessmentsData(data);
      stats.highRisk = assessments.filter((a) => a.risk_score >= 10).length;

      stats.safeguarding = assessments.filter(
        (a) => a.safeguarding === "concern"
      ).length;

      stats.overdue = assessments.filter((a) => {
        if (!a.last_reviewed) return false;

        return (
          new Date().getTime() -
            new Date(a.last_reviewed).getTime() >
          30 * 86400000
        );
      }).length;
    }
  }

  const clinical = generateClinicalAlerts(assessments);
setClinicalAlerts(clinical);

  if (clientsData) setClients(clientsData);
  if (alertsData) setAlerts(alertsData);

  if (alertsData) {
  setAlerts(alertsData);
  setAiSummary(generateAISummary());
}

  setAssessmentStats(stats);
};

  // ✅ CLEAN RISK FUNCTION
  const calculateRisk = (client: any) => {
    const clientAlerts = alerts.filter(a => a.client_id === client.id);

    return clientAlerts.reduce((total, alert) => {
      return total + (
  alert.severity === "critical" ? 4 :
  alert.severity === "high" ? 3 :
  alert.severity === "medium" ? 2 :
  1
);
    }, 0);
  };

  const calculateTrend = (clientId: string) => {
  const clientHistory = trendData.filter(
    (a: any) => a.client_id === clientId
  );

  if (clientHistory.length < 2) return 0;

  const recent = clientHistory.slice(-5);

  let score = 0;

  recent.forEach((a: any) => {
    if (a.status === "resolved") score += 1;
    if (a.severity === "high" || a.severity === "critical") score -= 1;
  });

  return score;
};

const buildChartData = () => {
  const map: Record<string, any> = {};

  trendData.forEach((a: any) => {
    const date = new Date(a.created_at).toLocaleDateString();

    if (!map[date]) {
      map[date] = {
        date,
        risk: 0,
      };
    }

    const score =
      a.severity === "critical"
        ? 4
        : a.severity === "high"
        ? 3
        : a.severity === "medium"
        ? 2
        : 1;

    if (a.status === "resolved") {
      map[date].risk -= 1; // improving reduces risk
    } else {
      map[date].risk += score;
    }
  });

  return Object.values(map);
};

const chartData = useMemo(() => {
  const data = buildChartData();
  return data.length ? data : [{ date: "No data", risk: 0 }];
}, [trendData]);

const getTrendColor = (trend: number) => {
  if (trend > 1) return "green";
  if (trend < -1) return "red";
  return "orange";
};

// 🔥 PRIORITY SORTING
const getPriorityClients = () => {
  return [...clients]
    .map((client) => {
      const risk = calculateRisk(client);
      const trend = calculateTrend(client.id);

      const assessments = assessmentsData.find(
        (a) => a.client_id === client.id
      );

      let clinicalBoost = 0;

      if (assessments) {
        if (assessments.news2_score >= 5) clinicalBoost += 5;
        if (assessments.must_score >= 2) clinicalBoost += 4;
        if (assessments.waterlow_score >= 15) clinicalBoost += 4;
        if (assessments.safeguarding === "concern") clinicalBoost += 6;
        if (assessments.frailty_score >= 7) clinicalBoost += 3;
      }

      return {
        ...client,
        risk,
        trend,
        priorityScore:
          risk +
          clinicalBoost +
          (trend < 0 ? 3 : 0), // worsening boost
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5);
};

// 📋 COMPLIANCE CHECK
const getComplianceIssues = () => {
  if (!assessmentsData.length) return null;

  const missingMCA = assessmentsData.filter(
    a => a.capacity !== "has capacity" && !a.mca_completed
  ).length;

  const missingBI = assessmentsData.filter(
    a => a.best_interest_required === "yes" && !a.best_interest_completed
  ).length;

  return {
    missingMCA,
    missingBI,
  };
};

// 🧠 VISIT INTELLIGENCE
const getVisitInsights = () => {
  if (!visits.length) return null;

  const missedMeds = visits.filter(v => v?.medication === "missed")
  const poorNutrition = visits.filter(v => v?.nutrition === "poor").length;
  const falls = visits.filter(v => v?.fall === true).length;

  return {
    missedMeds,
    poorNutrition,
    falls,
  };
};

const escalateToGP = async (clientId: string, reason: string) => {
  await supabase.from("referrals").insert({
    client_id: clientId,
    referral_type: "GP",
    details: reason,
    status: "pending",
  });

  alert("GP referral created");
};

const mapAlertToSection = (type: string) => {
  if (!type) return "clinical";

  if (type.includes("hydration") || type.includes("nutrition"))
    return "nutrition";

  if (type.includes("fall") || type.includes("mobility"))
    return "mobility";

  if (type.includes("medication"))
    return "medication";

  if (type.includes("toileting") || type.includes("continence"))
    return "toileting";

  if (type.includes("mental") || type.includes("behaviour"))
    return "mental";

  if (type.includes("safeguarding"))
    return "safeguarding";

  return "clinical";
};

const openAssessmentSection = (clientId: string, section: string) => {
  router.push(`/assessments?client=${clientId}&section=${section}`);
};

  // 🎯 ROUTE OPTIMISATION
  const optimiseRoute = () => {
    const withCoords = clients.filter(c => c && c.lat != null && c.lng != null)
    if (withCoords.length === 0) return;

    let remaining = [...withCoords];
    let ordered: any[] = [];

    let current = remaining.shift();
    if (!current) return;

    ordered.push(current);

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDist = Infinity;

      remaining.forEach((c, i) => {
        const dist =
          Math.pow(c.lat - current.lat, 2) +
          Math.pow(c.lng - current.lng, 2);

        if (dist < minDist) {
          minDist = dist;
          nearestIndex = i;
        }
      });

      current = remaining.splice(nearestIndex, 1)[0];
      ordered.push(current);
    }

    setRoute(ordered);
  };

  const createIcon = (color: string) => {
  const L = require("leaflet");

  return new L.DivIcon({
    className: "",
    html: `
      <div style="
        background:${color};
        width:18px;
        height:18px;
        border-radius:50%;
        border:3px solid white;
      "></div>
    `,
  });
};

const getColor = (score: number) => {
  if (score >= 6) return "red";
  if (score >= 4) return "orange";
  if (score >= 2) return "yellow";
  return "green";
};

const FitBounds = ({ clients }: { clients: any[] }) => {
  const { useMap } = require("react-leaflet");
  const map = useMap();

  useEffect(() => {
    if (!clients.length) return;

    const bounds = clients.map((c: any) => [c.lat, c.lng]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [clients]);

  return null;
};

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 pt-24">

      <h1 className="text-2xl font-bold mb-4">
        🗺️ Care Dashboard
      </h1>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl mb-6 shadow-lg">
  <h2 className="font-semibold text-white mb-2">
    🧠 AI Care Summary
  </h2>

  <p className="text-sm text-white/90">
    {aiSummary || "Analysing care data..."}
  </p>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6 flex flex-wrap gap-3">

  <button
    onClick={() => router.push("/clients")}
    className="bg-blue-600 px-4 py-2 rounded text-sm"
  >
    👥 View Clients
  </button>

  <button
    onClick={() => router.push("/assessments")}
    className="bg-purple-600 px-4 py-2 rounded text-sm"
  >
    🧾 New assessments
  </button>

  <button
    onClick={() => router.push("/alerts")}
    className="bg-red-600 px-4 py-2 rounded text-sm"
  >
    🚨 Manage Alerts
  </button>

</div>

      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl shadow">
  <p className="text-sm text-[var(--muted)]">High Risk Clients</p>
  <p className="text-2xl font-bold text-red-400">
    {assessmentStats.highRisk}
  </p>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl shadow">
  <p className="text-sm text-[var(--muted)]">Safeguarding Alerts</p>
  <p className="text-2xl font-bold text-yellow-400">
    {assessmentStats.safeguarding}
  </p>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl shadow">
  <p className="text-sm text-[var(--muted)]">Overdue Reviews</p>
  <p className="text-2xl font-bold text-blue-400">
    {assessmentStats.overdue}
  </p>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6 border border-red-500/30">
  <h2 className="font-semibold mb-2">🚨 Clinical Priority Alerts</h2>

  {clinicalAlerts.length === 0 && (
    <p className="text-[var(--muted)] text-sm">
      No immediate clinical risks detected
    </p>
  )}

  {clinicalAlerts.slice(0, 6).map((alert: any, i) => (
    <div
      key={i}
      className="flex justify-between items-center text-sm text-red-400 mb-1"
    >
      <span>• {alert.message}</span>

      <button
        onClick={() => {
          const target = alert;
          if (!target) return;
          openAssessmentSection(target.client_id, "clinical");
        }}
        className="text-xs bg-blue-600 px-2 py-1 rounded"
      >
        Review
      </button>
    </div>
  ))}
</div>

{plan === "pro" ? (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <h2 className="font-semibold mb-2">
  🧠 Smart Insights (AI Care Intelligence)
</h2>
<p className="text-sm text-[var(--muted)]">
  Detects improving vs declining clients automatically
</p>

    <p>📈 Improving: {insights.improving}</p>
    <p>📉 Declining: {insights.declining}</p>

    <p className="mt-2 text-sm text-[var(--muted)]">
      Based on alert resolution & severity trends
    </p>
  </div>
) : (
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 opacity-50 blur-sm relative">
    <h2 className="font-semibold mb-2">🧠 Smart Insights</h2>
    <p>📈 Improving: --</p>
    <p>📉 Declining: --</p>

    <div className="absolute inset-0 flex items-center justify-center">
      <span className="bg-yellow-600 px-3 py-1 rounded">
        🔒 Pro Feature
      </span>
    </div>
  </div>
)}

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6">
  <h2 className="font-semibold mb-2">
    📋 Compliance & Legal Checks
  </h2>

  {(() => {
    const c = getComplianceIssues();
    if (!c) return <p className="text-[var(--muted)]">No data</p>;

    return (
      <div className="text-sm text-gray-300 space-y-1">
        <p>⚖️ Missing MCA: {c.missingMCA}</p>
        <p>🧾 Missing Best Interest: {c.missingBI}</p>
      </div>
    );
  })()}
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6">
  <h2 className="font-semibold mb-2">⚡ System Health</h2>

  <div className="w-full bg-[var(--card)] rounded-full h-3">
    <div
      className="bg-green-500 h-3 rounded-full"
      style={{
        width: `${Math.max(
          10,
          100 - assessmentStats.highRisk * 10
        )}%`,
      }}
    />
  </div>

  <p className="text-sm text-[var(--muted)] mt-2">
    Overall care stability based on active risks
  </p>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6">
  <h2 className="font-semibold mb-3">🚨 Live Alerts Feed</h2>

  {alerts.length === 0 && (
    <p className="text-[var(--muted)] text-sm">
      No active alerts — all clients stable 👍
    </p>
  )}

  {alerts.slice(0, 5).map((alert: any) => {
    const color =
      alert.severity === "critical"
        ? "bg-red-600"
        : alert.severity === "high"
        ? "bg-orange-500"
        : alert.severity === "medium"
        ? "bg-yellow-500"
        : "bg-green-500";

    return (
      <div
  key={alert.id}
  className="flex items-start gap-3 bg-[var(--card)] p-3 rounded mb-2 border border-white/5"
>
  {/* severity dot */}
  <div className={`w-3 h-3 mt-1 rounded-full ${color}`} />

  <div className="flex-1">
    <p className="text-sm font-medium">
      {alert.message}
    </p>

    <p className="text-xs text-[var(--muted)]">
      {new Date(alert.created_at).toLocaleString()}
    </p>

    {/* 🔥 ACTION BUTTONS */}
    <div className="flex gap-2 mt-2 flex-wrap">

      <button
        onClick={() => router.push(`/clients/${alert.client_id}`)}
        className="text-xs bg-blue-600 px-2 py-1 rounded"
      >
        View
      </button>

      <button
        onClick={() =>
          openAssessmentSection(
  alert.client_id,
  mapAlertToSection(alert.type)
)
        }
        className="text-xs bg-purple-600 px-2 py-1 rounded"
      >
        Open Section
      </button>

      <button
        onClick={() =>
          escalateToGP(alert.client_id, alert.message)
        }
        className="text-xs bg-red-600 px-2 py-1 rounded"
      >
        Escalate
      </button>

    </div>
  </div>
</div>
  );
  })}
  </div>

{plan === "pro" ? (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <h2 className="font-semibold mb-2">
  📊 Risk Trends (Early Warning System)
</h2>
<p className="text-sm text-[var(--muted)]">
  See deterioration before it becomes a safeguarding issue
</p>

    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />

          <defs>
  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
  </linearGradient>
</defs>

<Line
  type="monotone"
  dataKey="risk"
  stroke="#3b82f6"
  strokeWidth={4}
  dot={false}
/>

<Area
  type="monotone"
  dataKey="risk"
  stroke="none"
  fill="url(#riskGradient)"
/>
        </LineChart>
      </ResponsiveContainer>
    </div>

    <p className="text-sm text-[var(--muted)] mt-2">
      Tracks overall care risk trends over time
    </p>
  </div>
) : (
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 opacity-50 blur-sm relative">
    <h2 className="font-semibold mb-2">📊 Risk Trend</h2>

    <div className="h-[250px] flex items-center justify-center text-[var(--muted)]">
      Graph locked
    </div>

    <div className="absolute inset-0 flex items-center justify-center">
      <span className="bg-yellow-600 px-3 py-1 rounded">
        🔒 Pro Feature
      </span>
    </div>
  </div>
)}

      {plan !== "pro" && (
        <div className="bg-yellow-600 p-3 rounded mb-4">
          🔒 Upgrade to Pro to unlock maps & route planning
        </div>
      )}

      {/* 🗺️ MAP */}
      {plan !== "pro" && (
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 opacity-50 blur-sm relative">
    <h2 className="font-semibold mb-2">
      🗺️ Client Map & Risk Zones
    </h2>

    <p className="text-sm text-[var(--muted)]">
      Visualise high-risk clients and plan visits efficiently
    </p>

    <div className="h-[200px] flex items-center justify-center">
      Map preview locked
    </div>

    <div className="absolute inset-0 flex items-center justify-center">
      <span className="bg-yellow-600 px-3 py-1 rounded">
        🔒 Upgrade to unlock live map
      </span>
    </div>
  </div>
)}
      {plan === "pro" && clients.some(c => c.lat && c.lng) && (
        <div className="h-[350px] rounded-xl overflow-hidden mb-6 shadow-lg border border-[#334155]">

          <MapContainer
            center={[53.2587, -2.127] as [number, number]}
            zoom={10}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds clients={clients.filter((c: any) => c.lat && c.lng)} />

            {clients.map((client: any) => {

  const clientChartData = trendData
    .filter((t: any) => t.client_id === client.id)
    .map((t: any) => ({
      date: new Date(t.created_at).toLocaleDateString(),
      risk:
        t.severity === "critical"
          ? 4
          : t.severity === "high"
          ? 3
          : t.severity === "medium"
          ? 2
          : 1,
    }));
              if (!client.lat || !client.lng) return null;

              const risk = calculateRisk(client);
              const color = getColor(risk);

              return (
                <Marker
                  key={client.id}
                  position={[Number(client.lat), Number(client.lng)]}
                  icon={createIcon(color)}
                >
                  <Popup>
                    <div>
                      <p><strong>{client.name}</strong></p>
                      <p>Risk Score: {risk}</p>
                      {plan === "pro" && (
  <p>
    Trend:{" "}
    {(() => {
      const t = calculateTrend(client.id);
      if (t > 0) return "📈 Improving";
      if (t < 0) return "📉 Declining";
      return "➖ Stable";
    })()}
  </p>
)}

{plan === "pro" && clientChartData.length > 0 && (
  <div className="mt-2 h-[120px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={clientChartData}>
        <Line
          type="monotone"
          dataKey="risk"
          stroke="#22c55e"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

                      <button
                        onClick={() => router.push(`/clients/${client.id}`)}
                        className="mt-2 bg-blue-600 px-2 py-1 rounded"
                      >
                        View
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {route.length > 0 && (
  <Polyline
    positions={route.map((c: any) => [c.lat, c.lng])}
    pathOptions={{ color: "blue", weight: 4 }}
  />
)}
          </MapContainer>

        </div>
      )}

      {/* 🚗 ROUTE */}
      {plan === "pro" && (
  <h2 className="font-semibold mb-2">
    🚗 Smart Route Optimisation
  </h2>
)}
      {plan === "pro" && (
        <button
          onClick={optimiseRoute}
          className="bg-blue-600 px-4 py-2 rounded mb-4"
        >
          Optimise Route
        </button>
      )}

      {route.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">🚗 Route Order</h2>

          {route.map((c: any, i) => (
            <div key={c.id} className="bg-[var(--card)] p-3 rounded mb-2">
              {i + 1}. {c.name}
            </div>
          ))}
        </div>
      )}

      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6">
  <h2 className="font-semibold mb-3">
    🎯 Top Priority Clients
  </h2>

  <p className="text-sm text-[var(--muted)] mb-3">
    Ranked by risk + deterioration trend
  </p>

  {getPriorityClients().map((client: any, index: number) => {
    const trendColor = getTrendColor(client.trend);

    return (
      <div
        key={client.id}
        onClick={() => router.push(`/clients/${client.id}`)}
        className="flex items-center justify-between bg-[var(--card)] p-3 rounded mb-2 cursor-pointer hover:bg-[var(--card)] transition"
      >
        <div>
          <p className="font-semibold">
            {index + 1}. {client.name}
          </p>

          <p className="text-xs text-[var(--muted)]">
            Risk: {client.risk}
          </p>
        </div>

        {(() => {
  const a = assessmentsData.find(
    (x) => x.client_id === client.id
  );
  if (!a) return null;

  return (
    <div className="text-xs mt-1 text-[var(--muted)]">
      {a.news2_score >= 5 && "🚨 NEWS2 "}
      {a.must_score >= 2 && "🥤 MUST "}
      {a.waterlow_score >= 15 && "🛏️ Waterlow "}
      {a.safeguarding === "concern" && "⚖️ SG "}
    </div>
  );
})()}

        <div
          className="text-sm font-semibold"
          style={{ color: trendColor }}
        >
          {client.trend > 0 && "📈"}
          {client.trend < 0 && "📉"}
          {client.trend === 0 && "➖"}
        </div>
      </div>
    );
  })}
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-xl mb-6">
  <h2 className="font-semibold mb-2">
    🏥 Visit Insights
  </h2>

  {(() => {
    const v = getVisitInsights();
    if (!v) return <p className="text-[var(--muted)]">No visit data yet</p>;

    return (
      <div className="text-sm text-gray-300 space-y-1">
        <p>💊 Missed meds: {v.missedMeds}</p>
        <p>🍽️ Poor nutrition: {v.poorNutrition}</p>
        <p>🚨 Falls recorded: {v.falls}</p>
      </div>
    );
  })()}
</div>

      {/* 🚨 HIGH RISK */}
      <h2 className="text-xl font-bold mb-3">
        🚨 High Risk Clients
      </h2>

      {clients
  .filter(c => calculateRisk(c) >= 4)
  .map(client => {
    const trend = calculateTrend(client.id);
    const trendColor = getTrendColor(trend);

    return (
      <div
        key={client.id}
        onClick={() => router.push(`/clients/${client.id}`)}
        className="bg-red-900/40 border border-red-500 p-4 rounded-xl mb-3 cursor-pointer hover:scale-[1.01] transition"
      >
        <p className="font-semibold">{client.name}</p>
        <p className="text-sm text-gray-300 mt-1">
  Risk Score: {calculateRisk(client)}
</p>

        {plan === "pro" && (
          <p style={{ color: trendColor }}>
            {trend > 0 && "📈 Improving"}
            {trend < 0 && "📉 Declining"}
            {trend === 0 && "➖ Stable"}
          </p>
        )}
      </div>
    );
  })}
    </div>
  );
}