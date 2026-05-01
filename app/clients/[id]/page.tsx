"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logAlertAudit } from "@/lib/alertAudit";
import { careTypes } from "@/lib/careTypes";
import { useAccess } from "@/app/context/AccessContext";
import { generateAssessmentAlerts, generateDiagnosisAlerts, saveAlerts } from "@/lib/alertEngine";
import { removeResolvedActionsFromCarePlan } from "@/lib/carePlanEngine";
import { syncTasksWithAlerts } from "@/lib/alertEngine";
import { generateAutoFlags } from "@/lib/flagEngine";
import { generateFlagAlerts } from "@/lib/flagAlerts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function ClientProfilePage() {
  const params = useParams();
const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
const [visits, setVisits] = useState<any[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);
useEffect(() => {
  console.log("UI ALERTS:", alerts);
}, [alerts]);
const [assessmentProgress, setAssessmentProgress] = useState(0);
const [editing, setEditing] = useState(false);
const [preferences, setPreferences] = useState("");
const [goals, setGoals] = useState("");
const [lastUpdated, setLastUpdated] = useState<string | null>(null);
const [latestSummary, setLatestSummary] = useState<any>(null);
const getLiveClinicalPreview = () => {
  const aiAlerts = latestSummary?.alerts || [];
  const dbAlerts = alerts || [];
useEffect(() => {
  console.log("AI SUMMARY:", latestSummary);
}, [latestSummary]);
  // 🔥 STEP 1 — NORMALISE (AI alerts don’t always have same shape)
  const normalisedAI = aiAlerts.map((a: any) => ({
    ...a,
    source: "ai",
    severity: a.severity || "medium",
    message: a.message || a,
  }));

  // 🔥 STEP 2 — MERGE
  const combined = [...dbAlerts, ...normalisedAI];

  // 🔥 STEP 3 — DEDUPE (by message)
  const unique = combined.filter(
    (a, i, self) =>
      i === self.findIndex(b => b.message === a.message)
  );

  // 🔥 STEP 4 — SORT BY PRIORITY
  const order: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return unique
    .sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0))
    .slice(0, 3); // 🔥 TOP 3 ONLY
};
const [summaryHistory, setSummaryHistory] = useState<any[]>([]);
const [familyFeedback, setFamilyFeedback] = useState<any[]>([]);
const [feedbackNotification, setFeedbackNotification] = useState<any>(null);
const [form, setForm] = useState({
  name: "",
  date_of_birth: "",
  care_type: "",
  diagnosis: [] as string[],
  address: "",
});
const hasEvidenceToUpload = () => {
  return [
    client?.cognition_evidence,
    client?.nutrition_evidence,
    client?.mobility_evidence,
    client?.skin_evidence,
    client?.medication_evidence,
    client?.safeguarding_evidence,
  ].some(Boolean);
};

const [tasks, setTasks] = useState<any[]>([]);
const access = useAccess();
const isTrialActive = access?.isTrialActive || false;
const plan = access?.plan || "free";
const [assessments, setAssessments] = useState<any>(null);
const groupedAlerts = {
  assessments: alerts.filter((a) => a.source === "assessments"),
  visit: alerts.filter((a) => a.source === "visit"),
  diagnosis: alerts.filter((a) => a.source === "diagnosis"),
  flags: alerts.filter((a) => a.source === "flags"), // ✅ ADD THIS
};

const triggerFeedbackNotification = (feedback: any) => {
  setFeedbackNotification(feedback);

  // auto hide after 6 seconds
  setTimeout(() => {
    setFeedbackNotification(null);
  }, 6000);
};

const limitAlerts = (list: any[]) =>
  plan === "free" && !isTrialActive ? list.slice(0, 2) : list;

const buildTrendData = () => {
  return visits
    .slice(0, 7) // last 7 visits
    .reverse()
    .map((v: any) => {
      const scoreMap: Record<string, number> = {
  good: 3,
  adequate: 3,
  fair: 2,
  reduced: 2,
  poor: 1,
  refused: 0,
};

      const moodMap: Record<string, number> = {
        happy: 3,
        content: 2,
        neutral: 2,
        anxious: 1,
        low: 1,
        distressed: 0,
      };

      return {
        date: new Date(v.created_at).toLocaleDateString(),

        hydration: scoreMap[v.hydration as keyof typeof scoreMap] ?? 0,
nutrition: scoreMap[v.nutrition as keyof typeof scoreMap] ?? 0,
mood: moodMap[v.mood as keyof typeof moodMap] ?? 0,

        // 🔥 FUTURE: weight support
        weight: v.weight ?? null,
      };
    });
};

const loadAlerts = async () => {
  // 🔹 DB alerts
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  setAlerts(data || []);
};

useEffect(() => {
  if (!id) return;
if (!client) return;

  const loadAssessment = async () => {
  const { data } = await supabase
    .from("assessments")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();

  if (!data) return;

  setAssessments(data);

  // 🧠 STEP 1 — AUTO FLAGS (FROM DATA)
  const autoFlags = generateAutoFlags(data);

  // 🧠 STEP 2 — MERGE WITH SAVED FLAGS
  const allFlags = [...new Set([...(data.flags || []), ...autoFlags])];

  // 🧠 STEP 3 — FLAG ALERTS
  const flagAlerts = generateFlagAlerts(allFlags);

  // 🧠 STEP 4 — NORMAL ALERTS
  const assessmentAlerts = generateAssessmentAlerts(data);

  // 🧠 STEP 5 — COMBINE EVERYTHING
  const allAlerts = [...assessmentAlerts, ...flagAlerts];

  // 💾 SAVE ALL ALERTS
  await saveAlerts({
    alerts: allAlerts,
    clientId: id as string,
  });

  // 🔄 REFRESH ALERTS
  const { data: freshAlerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id)
    .eq("status", "active");

  // 🔗 CLEAN CARE PLAN
  await removeResolvedActionsFromCarePlan({
    clientId: id as string,
    activeAlerts: freshAlerts || [],
  });

  // 🔗 SYNC TASKS
  await syncTasksWithAlerts({
    clientId: id as string,
    activeAlerts: freshAlerts || [],
  });

  loadAlerts();
};

  loadAssessment();
}, [id, client]);

const calculateRiskScore = () => {
  if (!alerts.length) return 0;

  return alerts.reduce((total: number, alert: any) => {
    let score = 1;

    if (alert.severity === "critical") score = 5;
    else if (alert.severity === "high") score = 3;
    else if (alert.severity === "medium") score = 2;

    // 🔥 BOOST FLAGS (THE KEY BIT)
    if (alert.source === "flags") {
      score += 2; // flags carry extra weight
    }

    return total + score;
  }, 0);
};

const getRiskLevel = (score: number) => {
  const hasCriticalFlag = alerts.some(
    (a) => a.source === "flags" && a.severity === "critical"
  );

  if (hasCriticalFlag) {
    return { label: "Critical Risk", color: "bg-red-800" };
  }

  if (score >= 8) {
    return { label: "High Risk", color: "bg-red-600" };
  }

  if (score >= 4) {
    return { label: "Medium Risk", color: "bg-yellow-500" };
  }

  return { label: "Low Risk", color: "bg-green-600" };
};

const getRealTrend = () => {
  const recentAlerts = alerts;

  const hasCritical = recentAlerts.some(a => a.severity === "critical");
  const hasHigh = recentAlerts.some(a => a.severity === "high");

  if (hasCritical) return { label: "Critical escalation", color: "bg-red-800" };
  if (hasHigh) return { label: "Escalating", color: "bg-red-600" };

  return { label: "Stable", color: "bg-green-600" };

  const midpoint = Math.floor(alerts.length / 2);

  const recent = alerts.slice(0, midpoint);
  const older = alerts.slice(midpoint);

  const scoreSet = (set: any[]) =>
    set.reduce((total, alert) => {
      let score = 1;

if (alert.severity === "critical") score = 5;
else if (alert.severity === "high") score = 3;
else if (alert.severity === "medium") score = 2;

if (alert.source === "flags") {
  score += 2;
}

return total + score;
    }, 0);

  const recentScore = scoreSet(recent);
  const olderScore = scoreSet(older);

  if (recentScore > olderScore) {
    return { label: "Worsening", color: "bg-red-600" };
  }

  if (recentScore < olderScore) {
    return { label: "Improving", color: "bg-green-600" };
  }

  return { label: "Stable", color: "bg-yellow-500" };
};


  // LOAD CLIENT
  const loadClient = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id as string)
      .single();

    if (data) {
  setClient(data);
  setPreferences(data.preferences || "");
setGoals(data.goals || "");
setLastUpdated(data.updated_at || null); // ✅ correct place
  setForm({
  name: data.name,
  date_of_birth: data.date_of_birth || "",
  care_type: data.care_type,
  diagnosis: Array.isArray(data.diagnosis)
    ? data.diagnosis
    : [data.diagnosis].filter(Boolean),
  address: data.address,
});
  const { data: userData } = await supabase.auth.getUser();

if (userData?.user) {
  const user = userData.user; // ✅ FIX

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organisation_id) {
    console.log("❌ No organisation_id yet");
    return;
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("subscription_status")
    .eq("id", profile.organisation_id)
    .maybeSingle();
}
    }
  };

  const loadSummaryHistory = async () => {
  const { data } = await supabase
    .from("visit_notes")
    .select("*")
    .eq("client_id", id)
    .eq("type", "structured_summary")
    .order("created_at", { ascending: false })
    .limit(3);

  if (!data) return;

  const parsed = data.map((item) => {
    try {
      return {
        ...item,
        parsed: JSON.parse(item.note),
      };
    } catch {
      return null;
    }
  }).filter((a): a is any => a !== null);

  setSummaryHistory(parsed);
};

  const loadLatestSummary = async () => {
  const { data } = await supabase
    .from("visit_notes")
    .select("*")
    .eq("client_id", id)
    .eq("type", "structured_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.note) {
    try {
      const parsed = JSON.parse(data.note);
      setLatestSummary(parsed);
    } catch {
      setLatestSummary(null);
    }
  }
};

  // LOAD VISITS
  const loadVisits = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) setVisits(data);
  };

  const loadFamilyFeedback = async () => {
  const { data } = await supabase
    .from("family_feedback") // ✅ YOUR TABLE
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (data) setFamilyFeedback(data);
};


const loadTasks = async () => {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", id)
    .eq("status", "pending");

  if (data) setTasks(data);
};

const generateTasksFromCareType = async () => {
  if (!client) return;

  const careConfig =
    careTypes[client.care_type as keyof typeof careTypes];

  // 🔹 base tasks
  let tasksToAdd: string[] = careConfig?.tasks || [];

  // 🔥 ADD DIAGNOSIS-BASED TASKS
  const diagnosisList = Array.isArray(client.diagnosis)
    ? client.diagnosis
    : [client.diagnosis];

  diagnosisList.forEach((diag: string) => {
    if (!diag) return;

    if (diag.toLowerCase().includes("diabetes")) {
      tasksToAdd.push("Check blood sugar levels");
    }

    if (diag.toLowerCase().includes("dementia")) {
      tasksToAdd.push("Monitor confusion and orientation");
    }

    if (diag.toLowerCase().includes("mobility")) {
      tasksToAdd.push("Ensure mobility aids are within reach");
    }
  });

  // ❌ remove duplicates
  tasksToAdd = [...new Set(tasksToAdd)];

  // ❌ prevent DB duplicates
  const { data: existing } = await supabase
    .from("tasks")
    .select("title")
    .eq("client_id", id);

  const existingTitles =
    existing?.map((t: any) => t.title) || [];

  const newTasks = tasksToAdd
    .filter((task) => !existingTitles.includes(task))
    .map((task) => ({
      client_id: id,
      title: task,
      status: "pending",
    }));

  if (newTasks.length === 0) return;

  await supabase.from("tasks").insert(newTasks);

  loadTasks();
};

const updateClient = async () => {
  const { error } = await supabase
    .from("clients")
    .update({
  name: form.name,
  date_of_birth: form.date_of_birth,
  care_type: form.care_type,
  diagnosis: form.diagnosis,
  address: form.address,
})
    .eq("id", id as string);

  if (error) {
    console.error(error);
    alert("Error updating client");
    return;
  }

  setEditing(false);

  // ✅ reload fresh data
  await loadClient();
};

const deleteClient = async () => {
  const confirmDelete = confirm("Delete this client?");

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) {
  console.log(error);
  alert("Error deleting client");
  return;
}

  router.push("/clients");
};

const loadAssessmentProgress = async () => {
  const { data } = await supabase
    .from("assessments")
    .select("*")
    .eq("client_id", id)
    .single();

  if (!data) return;

  const fields = Object.values(data).filter(
    (v) => typeof v === "string"
  );

  const filled = fields.filter((f) => f !== "").length;

  const percent = Math.round((filled / fields.length) * 100);

  setAssessmentProgress(percent);

  // 🔥 REVIEW CHECK
  if (data.last_reviewed) {
    const diff =
      new Date().getTime() -
      new Date(data.last_reviewed).getTime();

    const days = diff / (1000 * 60 * 60 * 24);

    if (days > 30) {
      setAssessmentProgress(99); // force "not complete" feel
    }
  }
};


useEffect(() => {
  if (!id) return;
  loadAlerts();
}, [id]);

useEffect(() => {
  if (!visits.length) return;

  const autoUpdateAlerts = async () => {
    const last2 =
  plan === "free" && !isTrialActive
    ? visits.slice(0, 2)
    : visits;

    if (last2.length < 2) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const updates: any[] = [];

    // ✅ SKIN IMPROVEMENT
    if (last2.every(v => v.skin === "intact")) {
      updates.push({ type: "skin_pressure", newSeverity: "low" });
    }

    // ✅ HYDRATION
    if (last2.every(v => v.hydration === "adequate")) {
      updates.push({ type: "hydration", newSeverity: "low" });
    }

    // ✅ NUTRITION
    if (last2.every(v => v.nutrition === "adequate")) {
      updates.push({ type: "nutrition", newSeverity: "low" });
    }

    // ✅ MEDICATION
    if (last2.every(v => v.medication === "taken")) {
      updates.push({ type: "medication", newSeverity: "low" });
    }

    if (updates.length === 0) return;

    for (const update of updates) {
      const { data: existingAlerts } = await supabase
        .from("alerts")
        .select("*")
        .eq("client_id", id)
        .eq("type", update.type)
        .eq("status", "active");

      if (!existingAlerts) continue;

      for (const alert of existingAlerts) {

        // 🔥 STEP 1: DOWNGRADE FIRST
        if (alert.severity !== "low") {
          await supabase
            .from("alerts")
            .update({
              previous_priority: alert.severity,
              severity: update.newSeverity,
              downgraded_at: new Date().toISOString(),
              downgraded_by: userId,
              downgrade_reason: "Improved via visit data",
            })
            .eq("id", alert.id);

          await logAlertAudit({
            alert,
            action: "downgraded",
            previous: { severity: alert.severity },
            next: { severity: update.newSeverity },
            userId,
            source: "visit_auto",
          });
        }

        // 🔥 STEP 2: FULL RESOLVE AFTER LOW
        else {
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              closed_at: new Date().toISOString(),
              resolution_source: "visit_auto",
            })
            .eq("id", alert.id);

            // 🔥 REMOVE TASKS LINKED TO THIS ALERT
await supabase
  .from("tasks")
  .delete()
  .eq("client_id", id)
  .eq("title", alert.message);

          await logAlertAudit({
            alert,
            action: "resolved",
            previous: { status: "active" },
            next: { status: "resolved" },
            userId,
            source: "visit_auto",
          });
        }
      }
    }

    loadAlerts();

    const { data: freshAlerts } = await supabase
  .from("alerts")
  .select("*")
  .eq("client_id", id)
  .eq("status", "active");

await removeResolvedActionsFromCarePlan({
  clientId: id as string,
  activeAlerts: freshAlerts || [],
});
await syncTasksWithAlerts({
  clientId: id as string,
  activeAlerts: freshAlerts || [],
});
  };

  autoUpdateAlerts();
}, [visits]);

useEffect(() => {
  if (!client || !id) return;

const runDiagnosisAlerts = async () => {
  if (!client) return;

  const diagnosisAlerts = generateDiagnosisAlerts(client);

  await saveAlerts({
  alerts: diagnosisAlerts,
  clientId: id as string,
});

  loadAlerts();
};

  generateTasksFromCareType();
  runDiagnosisAlerts();
}, [client]);


useEffect(() => {
  if (!id) return;

  const channel = supabase
    .channel("alerts-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "alerts",
        filter: `client_id=eq.${id}`,
      },
      () => {
        loadAlerts(); // refresh on escalation/update
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [id]);

useEffect(() => {
  if (!id) return;

  const channel = supabase
    .channel("family-feedback-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "family_feedback",
        filter: `client_id=eq.${id}`,
      },
      (payload) => {
        console.log("👨‍👩‍👧 NEW FAMILY FEEDBACK:", payload);

        const newFeedback = payload.new;

        // 🔥 INSTANT UI UPDATE
        setFamilyFeedback((prev) => [
          newFeedback,
          ...prev,
        ]);

        // 🔔 TRIGGER NOTIFICATION
        triggerFeedbackNotification(newFeedback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [id]);

useEffect(() => {
  if (id) {
    loadClient();
    loadVisits();
    loadTasks();
    loadAssessmentProgress();
    loadLatestSummary();
    loadSummaryHistory();
    loadFamilyFeedback();

    if (window.location.hash === "#alerts") {
      setTimeout(() => {
        const el = document.getElementById("alerts");

        if (el) {
          el.scrollIntoView({ behavior: "smooth" });

          // ✨ highlight effect
          el.classList.add("ring-2", "ring-red-500");
          el.classList.add("animate-pulse");

          setTimeout(() => {
            el.classList.remove("ring-2", "ring-red-500");
          }, 1500);
        }
      }, 300);
    }
  }
}, [id]);

  if (!client) {
    return <div className="p-6 text-[var(--text)]">Loading client...</div>;
  }
  const riskScore = calculateRiskScore();
  const risk = getRiskLevel(riskScore);
  const trend = getRealTrend();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      {feedbackNotification && (
  <div className="fixed top-4 right-4 bg-indigo-600 text-white p-4 rounded shadow-lg z-50 animate-pulse max-w-sm">

    <p className="text-xs opacity-80">
      👨‍👩‍👧 Family Feedback
    </p>

    <p className="text-sm font-medium mt-1">
      {feedbackNotification.message}
    </p>

  </div>
)}
      {hasEvidenceToUpload() && (
  <div className="bg-yellow-500 p-3 rounded mb-4">
    📎 Evidence recorded — upload documents required
  </div>
)}

{/* 🔴 LIVE CLINICAL PRIORITY (NEW) */}
{(() => {
  const preview = getLiveClinicalPreview();
  if (preview.length === 0) return null;

  return (
    <div className="bg-red-900 p-3 rounded mb-4">
      <p className="text-xs text-red-200 mb-2">
        🚨 Immediate Clinical Priorities
      </p>

      {preview.map((a: any, i: number) => (
        <div
          key={i}
          className="text-xs bg-red-700 px-2 py-1 rounded mb-1 flex justify-between"
        >
          <span>⚠ {a.message}</span>
          <span className="opacity-70">{a.severity}</span>
        </div>
      ))}
    </div>
  );
})()}

      {/* 🔙 BACK */}
      <button
        onClick={() => router.push("/clients")}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Clients
      </button>
{assessmentProgress === 0 && (
  <p className="text-xl text-yellow-00 mt-1">
    ⚠ assessments needs completing
  </p>
)}
      <div className="grid md:grid-cols-3 gap-4 mb-6">

  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg flex flex-col gap-3 md:col-span-2">

  {/* 🔹 NAME + ACTIONS */}
  <div className="flex justify-between items-start">

    <div>
      {editing ? (
        <input
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          className="text-xl font-bold bg-transparent border-b border-[var(--border)]-600 focus:outline-none"
        />
      ) : (
        <h1 className="text-xl font-bold">{client.name}</h1>
      )}

      {editing ? (
  <input
    type="date"
    value={form.date_of_birth}
    onChange={(e) =>
      setForm({ ...form, date_of_birth: e.target.value })
    }
    className="text-sm mt-1 bg-[var(--card)] border border-[var(--border)]-600 rounded px-2 py-1"
  />
) : (
  <p className="text-xs text-[var(--muted)]">
    🎂 {client.date_of_birth || "No DOB recorded"}
  </p>
)}

      {editing ? (
        <select
  value={form.care_type}
  onChange={(e) =>
    setForm({ ...form, care_type: e.target.value })
  }
  className="text-sm bg-[var(--card)] text-white border border-[var(--border)]-600 rounded px-2 py-1 mt-1 focus:outline-none"
>
  <option value="">Select care type</option>

  {Object.keys(careTypes).map((type) => (
    <option
      key={type}
      value={type}
      className="bg-[var(--card)] text-white"
    >
      {type.replace("_", " ").toUpperCase()}
    </option>
  ))}
</select>
      ) : (
        <p className="text-[var(--muted)] text-sm">
          {client.care_type}
        </p>
      )}
    </div>

    {/* ACTIONS */}
    <div className="flex gap-2">
      {editing ? (
        <>
          <button
            onClick={updateClient}
            className="bg-green-600 px-2 py-1 text-xs rounded"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="bg-gray-600 px-2 py-1 text-xs rounded"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 px-2 py-1 text-xs rounded"
          >
            Edit
          </button>
          <button
            onClick={deleteClient}
            className="bg-red-600 px-2 py-1 text-xs rounded"
          >
            Delete
          </button>
        </>
      )}
    </div>
  </div>

  {/* 📍 ADDRESS */}
  <div className="text-sm text-gray-300">
  {editing ? (
    <input
      value={form.address}
      onChange={(e) =>
        setForm({ ...form, address: e.target.value })
      }
      placeholder="Enter address"
      className="w-full bg-[var(--card)] border border-[var(--border)]-600 rounded px-2 py-1"
    />
  ) : (
    <>📍 {client.address || "No address recorded"}</>
  )}
</div>

  {/* 🔥 PRIORITY */}
  <span className={`w-fit px-2 py-1 text-xs rounded ${
    client.priority === "high"
      ? "bg-red-700"
      : client.priority === "medium"
      ? "bg-yellow-600"
      : "bg-green-600"
  }`}>
    {client.priority?.toUpperCase() || "NORMAL"}
  </span>

  {/* 📊 assessments STATUS (NEW LOCATION) */}
  <div>
    <p className="text-xs text-[var(--muted)] mb-1">
      assessments Status
    </p>

    <div className="w-full bg-[var(--card)] rounded-full h-2">
      <div
        className="bg-gradient-to-r from-blue-500 to-green-400 h-2 rounded-full"
        style={{ width: `${assessmentProgress}%` }}
      />
    </div>

    <p className="text-xs text-[var(--muted)] mt-1">
      {assessmentProgress}% complete
    </p>
  </div>
  <div className="flex gap-2 mt-2">

  <button
  onClick={() => router.push(`/assessments?client=${id}`)}
  className="bg-blue-600 px-2 py-1 text-xs rounded"
>
  {assessmentProgress === 0
  ? "Start assessments"
  : "Update assessments"}
</button>

  <button
    onClick={async () => {
      await supabase
        .from("assessments")
        .update({
          last_reviewed: new Date().toISOString(),
        })
        .eq("client_id", id);

      loadAssessmentProgress();
    }}
    className="bg-green-600 px-2 py-1 text-xs rounded"
  >
    Reviewed
  </button>

</div>

</div>

  {/* 🚨 RISK (PRO LOCKED) */}
  <div
    onClick={() => {
  if (plan === "free") {
    router.push("/upgrade");
  }
}}
     className={`bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg cursor-pointer relative z-0 ${
      plan === "free" ? "opacity-60 blur-[1px]" : ""
    }`}
  >
    <h2 className="text-sm text-[var(--muted)] mb-1">Risk Level</h2>

    <p className="text-lg font-bold">
      {plan === "free" ? "🔒 Locked" : risk.label}
    </p>

    <p className="text-sm text-[var(--muted)]">
      {plan === "free" ? "Upgrade to view score" : `Score: ${riskScore}`}
    </p>

    <div className="mt-2 text-xs text-gray-500">
      {plan === "free" ? "Trend locked" : `Trend: ${trend.label}`}
    </div>
  </div>

  {/* 🧠 CLINICAL SUMMARY */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
    <h2 className="text-sm text-[var(--muted)] mb-2">
      Clinical Overview
    </h2>
    {client.diagnosis && (
  <p className="text-xs text-blue-300 mb-2">
    🧠 Diagnosis: {Array.isArray(client.diagnosis)
      ? client.diagnosis.join(", ")
      : client.diagnosis}
  </p>
)}

    <div className="text-sm space-y-1">

      <p>
        💧 Hydration:{" "}
        <span className={`font-medium ${
          assessments?.hydration === "poor" ? "text-red-400" : ""
        }`}>
          {assessments?.hydration || "-"}
        </span>
      </p>

      <p>
        🍽 Nutrition:{" "}
        <span className={`font-medium ${
          assessments?.nutrition === "poor" ? "text-red-400" : ""
        }`}>
          {assessments?.nutrition || "-"}
        </span>
      </p>

      <p>
        🚶 Mobility:{" "}
        <span className="font-medium">
          {assessments?.mobility || "-"}
        </span>
      </p>

      <p>
        🧴 Skin:{" "}
        <span className={`font-medium ${
          assessments?.skin === "breakdown" ? "text-red-400" : ""
        }`}>
          {assessments?.skin || "-"}
        </span>
      </p>

    </div>

    <button
      onClick={() => router.push(`/assessments?client=${id}`)}
      className="mt-3 text-xs text-blue-400"
    >
      Review assessments
    </button>
  </div>

  {/* 🚨 ACTIVE RISKS */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">

    <div className="flex justify-between items-center mb-3">
      <h2 className="text-lg font-semibold">Active Risks</h2>

      {plan === "free" && (
        <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">
          Limited
        </span>
      )}
    </div>

    {alerts.length === 0 && (
      <p className="text-gray-500 text-sm">
        No current risks
      </p>
    )}

    {alerts.slice(0, plan === "free" ? 2 : 10).map((alert) => (
      <div
        key={alert.id}
        className="flex justify-between items-center border-b border-[var(--border)]-700 py-2"
      >
        <p className="text-sm">{alert.message}</p>

        <span className={`text-xs px-2 py-1 rounded ${
          alert.severity === "critical"
            ? "bg-red-700"
            : alert.severity === "high"
            ? "bg-red-500"
            : alert.severity === "medium"
            ? "bg-yellow-500"
            : "bg-blue-500"
        }`}>
          {alert.severity}
        </span>
      </div>
    ))}
    {plan === "free" && alerts.length > 2 && (
  <p className="text-xs text-yellow-400 mt-2">
    Showing 2 of {alerts.length} risks — upgrade to view all
  </p>
)}
{/* 🔥 GROUPED ALERTS */}
<div className="grid md:grid-cols-4 gap-4 mt-6">

  {/* 🚨 assessments */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
    <h2 className="text-sm font-semibold mb-2">
      🚨 assessments Risks
    </h2>

    {groupedAlerts.assessments.length === 0 ? (
      <p className="text-xs text-gray-500">None</p>
    ) : (
      limitAlerts(groupedAlerts.assessments).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))
    )}
  </div>

  {/* 📊 VISIT */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
    <h2 className="text-sm font-semibold mb-2">
      📊 Visit Risks
    </h2>

    {groupedAlerts.visit.length === 0 ? (
      <p className="text-xs text-gray-500">None</p>
    ) : (
      limitAlerts(groupedAlerts.visit).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))
    )}
  </div>

  {/* 🧠 DIAGNOSIS */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
    <h2 className="text-sm font-semibold mb-2">
      🧠 Diagnosis Risks
    </h2>

    {groupedAlerts.diagnosis.length === 0 ? (
      <p className="text-xs text-gray-500">None</p>
    ) : (
      limitAlerts(groupedAlerts.diagnosis).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))
    )}
  </div>
  {/* 🚩 FLAGS */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
  <h2 className="text-sm font-semibold mb-2">
    🚩 Flag Risks
  </h2>

  {groupedAlerts.flags.length === 0 ? (
    <p className="text-xs text-gray-500">None</p>
  ) : (
    limitAlerts(groupedAlerts.flags).map((alert) => (
  <div
    key={alert.id}
    className={`text-xs mb-1 px-2 py-1 rounded flex justify-between ${
      alert.severity === "critical"
        ? "bg-red-700"
        : alert.severity === "high"
        ? "bg-red-500"
        : alert.severity === "medium"
        ? "bg-yellow-500"
        : "bg-blue-500"
    }`}
  >
    <span>🚩 {alert.message}</span>
    <span className="opacity-70">{alert.severity}</span>
  </div>
))
  )}
</div>

</div>
  </div>
 </div>
  {/* 🔷 MAIN CONTENT GRID */}
<div className="grid md:grid-cols-3 gap-4 mb-6">

  {/* 🧠 CARE PLAN (WIDE) */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg md:col-span-2">

    <button
  onClick={() => {
    if (!id) {
      console.log("NO ID — BLOCKING NAV");
      return;
    }

    console.log("NAVIGATING TO:", `/clients/${id}/visit/start`);

    router.push(`/clients/${id}/visit/start`);
  }}
  className="w-full bg-green-600 py-3 rounded-lg text-lg mb-4 relative z-50"
>
  ▶ Start Visit
</button>

    <h2 className="text-lg font-semibold mb-3">
      Care Plan Summary
    </h2>

    <p className="text-sm text-[var(--muted)]">Preferences</p>
    <p className="text-sm mb-2">
      {preferences || "Not recorded"}
    </p>

    <p className="text-sm text-[var(--muted)]">Goals</p>
    <p className="text-sm">
      {goals || "Not set"}
    </p>

    <button
      onClick={() => router.push(`/clients/${id}/care-plan`)}
      className="mt-3 text-sm text-blue-400"
    >
      View Care Plan →
    </button>

    <button
  onClick={() => router.push(`/family-access/${id}`)}
  className="w-full bg-indigo-600 py-3 rounded mt-3"
>
  👨‍👩‍👧 Family Portal Access
</button>
  </div>

  {/* 📋 TASKS (NORMAL WIDTH) */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
    <h2 className="text-lg font-semibold mb-3">
      Pending Tasks
    </h2>

    {tasks.length === 0 ? (
      <p className="text-gray-500 text-sm">
        No pending tasks
      </p>
    ) : (
      tasks.slice(0, 5).map((task) => (
        <div key={task.id} className="text-sm mb-1">
          • {task.title}
        </div>
      ))
    )}
  </div>

</div>

{/* 🧠 LAST VISIT SUMMARY + RISKS */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">

  <h2 className="text-lg font-semibold mb-3">
    Last Visit Overview
  </h2>

  {/* 📈 VISIT TREND (LAST 3) */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">

  <h2 className="text-lg font-semibold mb-3">
    Visit Trend (Last 3)
  </h2>

  {summaryHistory.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No visit history available
    </p>
  ) : (
    <div className="space-y-4">
      {summaryHistory.map((entry) => {
        const s = entry.parsed;

        return (
          <div
            key={entry.id}
            className="border border-[var(--border)]-700 rounded p-3"
          >
            <p className="text-xs text-[var(--muted)] mb-1">
              {new Date(entry.created_at).toLocaleString()}
            </p>

            <p className="text-sm text-gray-300 mb-2">
              {s.summary}
            </p>

            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(s.risks || {})
                .filter(([_, val]) => val === true)
                .map(([key]) => (
                  <span
                    key={key}
                    className="text-xs bg-red-600 px-2 py-1 rounded"
                  >
                    {key.replace("_", " ").toUpperCase()}
                  </span>
                ))}

              {Object.values(s.risks || {}).every(v => !v) && (
                <span className="text-xs bg-green-600 px-2 py-1 rounded">
                  No risks
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--muted)]">
              Alerts: {s.alerts?.length || 0}
            </p>

            {s.needs_follow_up && (
              <span className="inline-block mt-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded">
                Follow-up required
              </span>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>

{/* ✅ NOW SEPARATE BLOCK (OUTSIDE CONDITIONAL) */}
{/* 📊 CLINICAL TRENDS */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">

  <h2 className="text-lg font-semibold mb-4">
    Clinical Trends
  </h2>

  {visits.length < 2 ? (
    <p className="text-gray-500 text-sm">
      Not enough data for trends
    </p>
  ) : (
    <div className="space-y-6">

      {/* 💧 HYDRATION */}
      <div>
        <p className="text-xs text-[var(--muted)] mb-2">
          Hydration Trend
        </p>

        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buildTrendData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 3]} />
              <Tooltip />
              <Line type="monotone" dataKey="hydration" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-gray-500 mt-1">
          0 = refused • 1 = poor • 2 = fair • 3 = good
        </p>
      </div>

      {/* 🙂 MOOD */}
      <div>
        <p className="text-xs text-[var(--muted)] mb-2">
          Mood Trend
        </p>

        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buildTrendData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 3]} />
              <Tooltip />
              <Line type="monotone" dataKey="mood" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-gray-500 mt-1">
          0 = distressed • 1 = low/anxious • 2 = neutral/content • 3 = happy
        </p>
      </div>

      {/* ⚖️ WEIGHT */}
      <div>
        <p className="text-xs text-[var(--muted)] mb-2">
          Weight Trend
        </p>

        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buildTrendData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="weight" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )}
</div>

  {!latestSummary ? (
    <p className="text-gray-500 text-sm">
      No visit summary available
    </p>
  ) : (
    <>
      {/* 📝 SUMMARY */}
      <p className="text-sm text-gray-300 mb-3">
        {latestSummary.summary}
      </p>

      {latestSummary.needs_follow_up && (
  <div className="bg-red-700 text-white px-2 py-1 rounded text-xs mt-2">
    ⚠ Follow-up required (auto-detected)
  </div>
)}

      {/* ⚠️ RISKS */}
      <div className="mb-3">
        <p className="text-xs text-[var(--muted)] mb-1">Risks</p>

        <div className="flex flex-wrap gap-2">
          {Object.entries(latestSummary.risks || {})
            .filter(([_, val]) => val === true)
            .map(([key]) => (
              <span
                key={key}
                className="text-xs bg-red-600 px-2 py-1 rounded"
              >
                {key.replace("_", " ").toUpperCase()}
              </span>
            ))}

          {Object.values(latestSummary.risks || {}).every(v => !v) && (
            <span className="text-xs bg-green-600 px-2 py-1 rounded">
              No active risks
            </span>
          )}
        </div>
      </div>

      {/* 📋 TASKS COMPLETED */}
      <div className="mb-3">
        <p className="text-xs text-[var(--muted)] mb-1">Tasks Completed</p>

        {latestSummary.tasks_completed?.length ? (
          <div className="text-xs text-gray-300">
            {latestSummary.tasks_completed.join(", ")}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No tasks recorded
          </p>
        )}
      </div>

      {/* 🚨 ALERTS */}
      <div className="mb-2">
        <p className="text-xs text-[var(--muted)] mb-1">Alerts</p>

        {latestSummary.alerts?.length ? (
          latestSummary.alerts.map((a: any, i: number) => (
            <div
              key={i}
              className="text-xs bg-red-700 px-2 py-1 rounded mb-1"
            >
              {a.message}
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-500">
            No alerts
          </p>
        )}
      </div>

      {/* 🔥 FOLLOW UP FLAG */}
      {latestSummary.needs_follow_up && (
        <div className="mt-3 text-xs bg-yellow-500 text-black px-2 py-1 rounded inline-block">
          ⚠️ Follow-up required
        </div>
      )}
    </>
  )}
</div>

{/* 🔷 LOWER GRID */}
<div className="grid md:grid-cols-3 gap-4">

  {/* 📝 NOTES */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">

    <div className="flex gap-2 mb-3">
      <button
        onClick={() => router.push(`/clients/${id}/notes`)}
        className="bg-[var(--card)] px-3 py-2 rounded text-sm w-full"
      >
        📝 Notes
      </button>
    </div>

    <p className="text-xs text-[var(--muted)] mb-1">
      Latest Notes
    </p>

    {(plan === "free" && !isTrialActive
  ? visits.slice(0, 2)
  : visits
).map((v) => (
      <div key={v.id} className="text-xs text-gray-300 mb-1 line-clamp-2">
        {v.notes || "No notes"}
      </div>
    ))}
  </div>

  {/* 🕒 RECENT VISITS (WIDE) */}
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg md:col-span-2">

    <div className="flex justify-between items-center mb-3">
      <h2 className="text-lg font-semibold">
        Recent Visits
      </h2>

      {/* 👨‍👩‍👧 FAMILY FEEDBACK */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mt-6">

  <h2 className="text-lg font-semibold mb-3">
    Family Feedback
  </h2>

  {familyFeedback.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No feedback yet
    </p>
  ) : (
    familyFeedback.map((f) => (
      <div
        key={f.id}
        className="border-b border-[var(--border)]-700 py-2"
      >
        <p className="text-sm">{f.message}</p>

        <p className="text-xs text-[var(--muted)]">
          {new Date(f.created_at).toLocaleString()}
        </p>
      </div>
    ))
  )}

</div>

      <button
        onClick={() => router.push(`/clients/${id}/invoice`)}
        className="text-xs bg-purple-600 px-2 py-1 rounded"
      >
        Invoice
      </button>
    </div>

    {visits.length === 0 ? (
      <p className="text-gray-500 text-sm">
        No visits yet
      </p>
    ) : (
      visits.map((v) => (
        <div
          key={v.id}
          onClick={() => router.push(`/clients/${id}/visit/${v.id}`)}
          className="border-b border-[var(--border)]-700 py-2 cursor-pointer hover:bg-[#334155]"
        >
          <p className="text-xs">
            {new Date(v.created_at).toLocaleString()}
          </p>

          <p className="text-xs text-[var(--muted)]">
            {v.mood} • {v.hydration}
          </p>
        </div>
      ))
    )}
  </div>

</div>
</div>
  );
}