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
  const params = useParams<{ id: string }>();
const id = params?.id as string;

if (!id) return null; 
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
const [visits, setVisits] = useState<any[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);
const [resolvedAlerts, setResolvedAlerts] = useState<any[]>([]);
const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
const [assessmentProgress, setAssessmentProgress] = useState(0);
const [editing, setEditing] = useState(false);
const [preferences, setPreferences] = useState("");
const [goals, setGoals] = useState("");
const [lastUpdated, setLastUpdated] = useState<string | null>(null);
const [latestSummary, setLatestSummary] = useState<any>(null);
const isNewAlert = (created_at: string) => {
  const diff = Date.now() - new Date(created_at).getTime();
  return diff < 1000 * 60 * 60 * 24; // 24 hours
};
const shouldEscalate = (alert: any) => {
  if (!alert.created_at) return false;

  const days = Math.floor(
    (Date.now() - new Date(alert.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return days >= 3 && alert.severity !== "critical";
};

const getAlertAgeDays = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getLiveClinicalPreview = () => {
  const aiAlerts = latestSummary?.alerts || [];
  const dbAlerts = alerts || [];

  const normalisedAI = aiAlerts.map((a: any) => ({
    ...a,
    source: "ai",
    severity: a.severity || "medium",
    message: a.message || a,
  }));

  const combined = [...dbAlerts, ...normalisedAI];

  const unique = combined.filter(
    (a, i, self) =>
      i === self.findIndex((b) => b.message === a.message)
  );

  const order: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const sorted = unique.sort(
    (a, b) => (order[b.severity] || 0) - (order[a.severity] || 0)
  );

  return sorted.slice(0, 4);
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
  contact_number: "",
  keysafe: "",
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
const isPro = plan === "pro" || isTrialActive;
const isTeam = access?.accountType === "team";

const canUseEscalation =
  isTeam && (plan === "pro" || isTrialActive);
const [assessments, setAssessments] = useState<any>(null);
const safeAlerts = alerts || [];

const groupedAlerts = {
  assessments: safeAlerts.filter((a) => a.source === "assessments"),
  visit: safeAlerts.filter((a) => a.source === "visit"),
  diagnosis: safeAlerts.filter((a) => a.source === "diagnosis"),
  flags: safeAlerts.filter((a) => a.source === "flags"),
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
  if (!id) return;

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  // ✅ PREVENT LOOP: only update if changed
  setAlerts((prev) => {
    const prevStr = JSON.stringify(prev);
    const newStr = JSON.stringify(data || []);

    if (prevStr === newStr) return prev; // 🔥 no re-render

    return data || [];
  });
};
const loadResolvedAlerts = async () => {
  if (!id) return;

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id)
    .eq("status", "resolved")
    .order("closed_at", { ascending: false })
    .limit(3);

  setResolvedAlerts(data || []);
};

useEffect(() => {
  if (!id || !client) return;

  const loadAssessment = async () => {
    const { data } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", id)
      .maybeSingle();

    if (!data) return;

    setAssessments(data);

    const autoFlags = generateAutoFlags(data);
    const allFlags = [...new Set([...(data.flags || []), ...autoFlags])];

    const flagAlerts = generateFlagAlerts(allFlags);
    const assessmentAlerts = generateAssessmentAlerts(data);

    const combined = [...assessmentAlerts, ...flagAlerts];

const uniqueAlerts = combined.filter(
  (a, i, self) =>
    i === self.findIndex(
      (b) =>
        b.type === a.type &&
        b.message === a.message
    )
);

    await saveAlerts({
  alerts: uniqueAlerts,
  clientId: id,
});

    const { data: freshAlerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", id)
      .eq("status", "active");

    await removeResolvedActionsFromCarePlan({
      clientId: id,
      activeAlerts: freshAlerts || [],
    });

    await syncTasksWithAlerts({
      clientId: id,
      activeAlerts: freshAlerts || [],
    });

    loadAlerts();
  };

  loadAssessment();
}, [id]);

const calculateRiskScore = () => {
  if (!alerts.length) return 0;

  return alerts.reduce((total: number, alert: any) => {
    let score = 1;

    if (alert.severity === "critical") score = 5;
    if (alert.type === "neglect_risk") score += 5;
    else if (alert.severity === "high") score = 3;
    else if (alert.severity === "medium") score = 2;

    // 🔥 BOOST FLAGS (THE KEY BIT)
    if (alert.source === "flags") {
      score += 2; // flags carry extra weight
    }

    return total + score;
  }, 0);
};
const calculateIgnoredRiskScore = () => {
  return alerts.reduce((total: number, alert: any) => {
    if (!alert.created_at) return total;

    const age = getAlertAgeDays(alert.created_at);

    if (age < 2) return total;

    let weight = 1;

    if (alert.severity === "critical") weight = 5;
    else if (alert.severity === "high") weight = 3;
    else if (alert.severity === "medium") weight = 2;

    return total + weight * age; // 🔥 escalation over time
  }, 0);
};

const checkIgnoredRiskEscalation = async () => {
  if (!id || !alerts.length) return;

  const ignoredScore = calculateIgnoredRiskScore();

  // 🔥 threshold (tune later)
  if (ignoredScore < 15) return;

  // ✅ check if already exists
  const exists = alerts.find(
    (a) => a.type === "neglect_risk" && a.status === "active"
  );

  if (exists) return;

  // 🚨 CREATE ESCALATION ALERT
  const escalationAlert = {
    client_id: id,
    type: "neglect_risk",
    message: "⚠ Ongoing risks are not being addressed",
    severity: "critical",
    source: "system",
    status: "active",
    created_at: new Date().toISOString(),
  };

  await supabase.from("alerts").insert([escalationAlert]);

  console.log("🚨 NEGLECT RISK TRIGGERED");

  setTimeout(() => {
    loadAlerts();
  }, 300);
};
const createEscalationTasks = async () => {
  if (!id || !alerts.length) return;

  // 🔐 ACCESS CONTROL
  if (access?.accountType !== "team") return;
  if (!(plan === "pro" || isTrialActive)) return;

  // 🔍 check if escalation alert exists
  const hasNeglect = alerts.some(
    (a) => a.type === "neglect_risk" && a.status === "active"
  );

  if (!hasNeglect) return;

  const escalationTasks = [
    "🚨 Urgent care plan review required",
    "👩‍⚕️ Senior staff intervention required",
  ];

  // 🔍 get existing tasks
  const { data: existing } = await supabase
    .from("tasks")
    .select("section_title")
    .eq("client_id", id);

  const existingTitles =
    existing?.map((t: any) => t.title) || [];

  // ✅ filter new only
  const newTasks = escalationTasks
    .filter((task) => !existingTitles.includes(task))
    .map((task) => ({
      client_id: id,
      title: task,
      status: "pending",
      priority: "high",
      linked_alert_type: "neglect_risk",
    }));

  if (newTasks.length === 0) return;

  await supabase.from("tasks").insert(newTasks);

  console.log("🚨 Escalation tasks created");
};
const enforceCarePlanFromEscalation = async () => {
  if (!id || !alerts.length) return;

  // 🔐 ACCESS CONTROL
  if (access?.accountType !== "team") return;
  if (!(plan === "pro" || isTrialActive)) return;

  // 🔍 check if neglect risk exists
  const hasNeglect = alerts.some(
    (a) => a.type === "neglect_risk" && a.status === "active"
  );

  if (!hasNeglect) {
    // 🧹 REMOVE safeguarding section if no longer needed
    await supabase
      .from("care_plan_section")
      .delete()
      .eq("client_id", id)
      .eq("section_title", "⚠ Safeguarding & Risk Management");

    return;
  }

  const section = {
    client_id: id,
    section_title: "⚠ Safeguarding & Risk Management",
    care_need: "Risks are not being consistently addressed",
    outcome: "Ensure all identified risks are actively managed and reviewed",
    actions: [
      "Immediate senior staff review required",
      "Update care plan to reflect current risks",
      "Increase monitoring frequency",
      "Document all interventions clearly",
    ],
    priority: "critical",
    system_generated: true,
    updated_at: new Date().toISOString(),
  };

  // 🔁 UPSERT (prevent duplicates)
  await supabase
    .from("care_plan_section")
    .upsert(section, { onConflict: "client_id,title" });

  console.log("🚨 Care plan safeguarding enforced");
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
  if (!alerts.length) {
    return { label: "No data", color: "bg-gray-500" };
  }

  const score = alerts.reduce((total, alert) => {
    let val = 1;

    if (alert.severity === "critical") val = 5;
    else if (alert.severity === "high") val = 3;
    else if (alert.severity === "medium") val = 2;

    if (alert.source === "flags") val += 2;

    return total + val;
  }, 0);

  if (score > 10) return { label: "Escalating", color: "bg-red-600" };
  if (score > 5) return { label: "Monitor closely", color: "bg-yellow-500" };

  return { label: "Stable", color: "bg-green-600" };
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
  contact_number: data.contact_number || "",
  keysafe: data.keysafe || "",
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
  if (!id) return;

  const { data } = await supabase
    .from("visit_notes")
    .select("*")
    .eq("client_id", id)
    .eq("type", "structured_summary")
    .order("created_at", { ascending: false })
    .limit(3);

  if (!data) return;

  const parsed = data
    .map((item) => {
      try {
        return {
          ...item,
          parsed: JSON.parse(item.summary || "{}")
        };
      } catch {
        return null;
      }
    })
    .filter((a): a is any => a !== null);

  setSummaryHistory(parsed);
};

  const loadLatestSummary = async () => {
  if (!id) return;

  const { data } = await supabase
    .from("visit_notes")
    .select("*")
    .eq("client_id", id)
    .eq("type", "structured_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.note) {
    if (data?.summary) {
  setLatestSummary(JSON.parse(data.summary));
}
  }
};

  // LOAD VISITS
  const loadVisits = async () => {
  if (!id) return;

  const { data } = await supabase
    .from("visit_notes")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (data) setVisits(data);
};

  const loadFamilyFeedback = async () => {
  if (!id) return;

  const { data } = await supabase
    .from("family_feedback")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (data) setFamilyFeedback(data);
};


const loadTasks = async () => {
  if (!id) return;

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
  contact_number: form.contact_number,
  keysafe: form.keysafe,
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

  // 🔥 delete dependent data first
  await supabase.from("alert_audit_log").delete().eq("client_id", id);
  await supabase.from("alerts").delete().eq("client_id", id);
  await supabase.from("care_plan_section").delete().eq("client_id", id);
  await supabase.from("tasks").delete().eq("client_id", id);

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
  if (!id) return;

const { data } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", id)
  .maybeSingle();

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
  .eq("section_title", alert.message);

          await logAlertAudit({
            alert,
            action: "resolved",
            previous: { status: "active" },
            next: { status: "resolved" },
            userId,
            source: "visit_auto",
          });

          // 🔥 REMOVE ESCALATION TASKS IF NEGLECT CLEARED
if (alert.type === "neglect_risk") {
  await supabase
    .from("tasks")
    .delete()
    .eq("client_id", id)
    .eq("linked_alert_type", "neglect_risk");
}
        }
      }
    }

    loadAlerts();
    loadResolvedAlerts();

    

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
      (payload) => {
  clearTimeout((window as any).alertsTimeout);

  (window as any).alertsTimeout = setTimeout(() => {
    loadAlerts();
  }, 300);
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
  if (!id) return;

  loadClient();
  loadVisits();
  loadTasks();
  loadAssessmentProgress();
  loadLatestSummary();
  loadSummaryHistory();
  loadFamilyFeedback();
  loadResolvedAlerts(); // ✅ ADD THIS
}, [id]);

    useEffect(() => {
  if (window.location.hash === "#alerts") {
    setTimeout(() => {
      const el = document.getElementById("alerts");

      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        el.classList.add("ring-2", "ring-red-500", "animate-pulse");

        setTimeout(() => {
          el.classList.remove("ring-2", "ring-red-500");
        }, 1500);
      }
    }, 300);
  }
}, []);

useEffect(() => {
  if (!alerts.length) return;

  const runEscalation = async () => {
    // 🔥 STEP 1: standard escalation (your existing logic)
    const toEscalate = alerts.filter(
      (alert) =>
        shouldEscalate(alert) &&
        !alert.escalated
    );

    for (const alert of toEscalate) {
      await supabase
        .from("alerts")
        .update({
          severity: "high",
          escalated: true,
          escalated_at: new Date().toISOString(),
        })
        .eq("id", alert.id);
    }

    // 🔥 STEP 2: ignored risk escalation (NEW)
    // 🔥 STEP 2: ignored risk escalation
if (canUseEscalation) {
  await checkIgnoredRiskEscalation();
}

// 🔥 STEP 3: create tasks from escalation
if (canUseEscalation) {
  await createEscalationTasks();
  await enforceCarePlanFromEscalation();
}

    // 🔄 refresh once
    setTimeout(() => {
      loadAlerts();
    }, 300);
  };

  runEscalation();
}, [alerts]);

if (!client) {
  return <div className="p-6 text-[var(--text)]">Loading client...</div>;
}
  const riskScore = calculateRiskScore();
  const risk = getRiskLevel(riskScore);
  const trend = getRealTrend();
  // 🚨 ENFORCEMENT STATE
const hasNeglectRisk = alerts.some(
  (a) => a.type === "neglect_risk" && a.status === "active"
);

const hasCriticalAlert = alerts.some(
  (a) => a.severity === "critical"
);

const isEnforced =
  canUseEscalation && (hasNeglectRisk || hasCriticalAlert);
  const explainAlert = (type: string) => {
  const map: Record<string, string> = {
    hydration: "Low hydration increases risk of UTIs, confusion, and falls.",
    nutrition: "Poor nutrition can lead to weight loss and slower recovery.",
    mobility: "Reduced mobility increases risk of pressure sores and falls.",
    medication: "Missed medication can destabilise conditions.",
    skin_pressure: "Skin breakdown can lead to serious pressure ulcers.",
  };

  return map[type] || "Monitor closely to prevent deterioration.";
};

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      {/* 🚨 SYSTEM ENFORCEMENT BANNER */}
{canUseEscalation && isEnforced && (
  <div className="bg-red-700 text-white p-4 rounded mb-4 animate-pulse">
    <div className="flex justify-between items-center">

      <div>
        <p className="text-sm font-semibold">
          🚨 Immediate Action Required
        </p>

        <p className="text-xs mt-1">
          {hasNeglectRisk
            ? "Care has not been followed — senior review required"
            : "Critical risks present — review care plan before proceeding"}
        </p>
      </div>

      <button
        onClick={() => router.push(`/clients/${id}/care-plan`)}
        className="bg-white text-red-700 px-3 py-1 rounded text-xs"
      >
        Review Care Plan
      </button>

    </div>
  </div>
)}
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
  📎 Evidence recorded — documents required
  <button
    onClick={() => router.push(`/assessments?client=${id}`)}
    className="ml-2 underline text-black text-xs"
  >
    Upload now
  </button>
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
          className={`text-xs px-2 py-1 rounded mb-1 flex justify-between ${
  a.severity === "critical"
    ? "bg-red-800"
    : a.severity === "high"
    ? "bg-red-500"
    : a.severity === "medium"
    ? "bg-yellow-500"
    : "bg-blue-500"
}`}
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
  <p className="text-xl text-yellow-400 mt-1">
    ⚠ assessment needs completing
  </p>
)}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

  <div className="bg-[var(--card)] p-4 sm:p-5 rounded-xl border border-[var(--border)] flex flex-col gap-4 md:col-span-2">

  {/* 🔹 NAME + ACTIONS */}
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">

  {/* LEFT SIDE */}
  <div className="flex-1">

    {/* 🔹 NAME + ACTION ICONS */}
    <div className="flex items-center justify-between">

      <h1 className="text-xl font-bold">{client.name}</h1>

      {/* ✏️ EDIT + ❌ DELETE */}
      <div className="flex gap-2 ml-3">

         {/* EDIT */}
  <button
    onClick={() => setEditing(true)}
    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"
    title="Edit client"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
    </svg>
  </button>

  {/* DELETE */}
  <button
    onClick={deleteClient}
    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"
    title="Delete client"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-red-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7v12m6-12v12M10 11h4M5 7l1-3h12l1 3" />
    </svg>
  </button>

      </div>

    </div>

    {/* 📍 ADDRESS */}
    <p className="text-sm text-gray-400 mt-1">
      📍 {client.address || "No address"}
    </p>

    {/* 🎂 DOB */}
    <p className="text-xs text-[var(--muted)] mt-1">
      🎂 {client.date_of_birth || "No DOB"}
    </p>

    {/* 🏥 CARE TYPE */}
    <p className="text-sm text-[var(--muted)] mt-1">
      {client.care_type}
    </p>

    {/* ▶ START / CONTINUE ASSESSMENT */}
    <button
      onClick={() => router.push(`/assessments?client=${id}`)}
      className="w-full bg-blue-600 py-2 rounded mt-3 text-sm"
    >
      {assessmentProgress === 0
        ? "Start Assessment"
        : "Continue Assessment"}
    </button>

    {/* 🕒 LAST REVIEWED */}
    <p className="text-[10px] text-gray-500 mt-1">
      Last reviewed: {lastUpdated
        ? new Date(lastUpdated).toLocaleDateString()
        : "—"}
    </p>

    <button
  onClick={() => {
    if (isEnforced) {
      alert("⚠ You must review the care plan before starting a visit");
      router.push(`/clients/${id}/care-plan`);
      return;
    }

    router.push(`/clients/${id}/visit/start`);
  }}
  className={`w-full py-3 rounded mb-6 ${
    isEnforced
      ? "bg-red-800 cursor-not-allowed"
      : "bg-blue-600"
  }`}
>
  {isEnforced ? "🔒 Review Care Plan First" : "Start Visit"}
</button>

    {/* 🧠 TIMELINE */}
    <button
      onClick={() => router.push(`/clients/${id}/timeline`)}
      className="bg-gray-700 px-2 py-1 text-xs rounded mt-2"
    >
      View Timeline (coming soon)
    </button>

  </div>

  {/* RIGHT SIDE — RISK BOX */}
  <div className="sm:ml-4 border border-[var(--border)] rounded p-3 w-full sm:w-[120px] text-center">

    <p className="text-xs text-[var(--muted)] mb-1">
      Risk
    </p>

    <p className="text-sm font-bold">
      {plan === "free" ? "🔒 Locked" : risk.label}
    </p>

    <p className="text-[10px] text-gray-500">
      {plan === "free"
        ? ""
        : `Score: ${riskScore}`}
    </p>
    <p className="text-[10px] text-red-400 mt-1">
  Ignored Risk: {calculateIgnoredRiskScore()}
</p>

    {/* 🔻 TREND (optional but useful) */}
    <p className="text-[10px] mt-1 text-gray-400">
      {plan === "free" ? "" : trend.label}
    </p>

  </div>

</div>


  {/* 🧠 CLINICAL SUMMARY */}
  <div className="bg-[var(--card)] p-5 rounded-lg">
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
<div className="bg-[var(--card)] p-4 rounded-lg mb-4">
  <h2 className="text-sm text-[var(--muted)] mb-2">
    Risk Breakdown
  </h2>

  <div className="grid grid-cols-2 gap-2 text-xs">
    <div>🧠 Assessments: {groupedAlerts.assessments.length}</div>
    <div>📊 Visits: {groupedAlerts.visit.length}</div>
    <div>🧠 Diagnosis: {groupedAlerts.diagnosis.length}</div>
    <div className="text-red-400 font-semibold">
  🚩 Flags: {groupedAlerts.flags.length}
</div>
  </div>
</div>
  
  <div className="bg-[var(--card)] p-5 rounded-lg">

  <div className="flex justify-between items-center mb-3">
    <h2 className="text-sm font-semibold">
      🧠 Risk Insights
    </h2>

    <span className="text-[10px] text-gray-400">
      grouped by source
    </span>
  </div>

  {/* 🔴 FLAGS (TOP PRIORITY) */}
  {groupedAlerts.flags.length > 0 && (
    <div className="mb-3">
      <p className="text-[11px] text-red-400 mb-1">
        🚩 Flags
      </p>

      {limitAlerts(groupedAlerts.flags).map((alert) => (
        <div
          key={alert.id}
          className="flex justify-between text-xs mb-1 px-2 py-1 rounded bg-red-900/40"
        >
          <span>{alert.message}</span>
          <span className="opacity-70">{alert.severity}</span>
        </div>
      ))}
    </div>
  )}

  {/* 🧠 ASSESSMENTS */}
  {groupedAlerts.assessments.length > 0 && (
    <div className="mb-3">
      <p className="text-[11px] text-blue-300 mb-1">
        🧠 Assessments
      </p>

      {limitAlerts(groupedAlerts.assessments).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))}
    </div>
  )}

  {/* 📊 VISITS */}
  {groupedAlerts.visit.length > 0 && (
    <div className="mb-3">
      <p className="text-[11px] text-yellow-300 mb-1">
        📊 Visits
      </p>

      {limitAlerts(groupedAlerts.visit).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))}
    </div>
  )}

  {/* 🧬 DIAGNOSIS */}
  {groupedAlerts.diagnosis.length > 0 && (
    <div>
      <p className="text-[11px] text-purple-300 mb-1">
        🧬 Diagnosis
      </p>

      {limitAlerts(groupedAlerts.diagnosis).map((alert) => (
        <div key={alert.id} className="text-xs mb-1">
          • {alert.message}
        </div>
      ))}
    </div>
  )}

  {/* EMPTY STATE */}
  {alerts.length === 0 && (
    <p className="text-xs text-gray-500">
      No risk insights available
    </p>
  )}

</div>
<div className="bg-[var(--card)] p-5 rounded-lg mt-4">

  <h2 className="text-sm font-semibold mb-2">
    📋 All Active Risks
  </h2>

  {alerts.length === 0 ? (
  <p className="text-xs text-gray-500">No risks</p>
) : (
  (() => {
    const visibleAlerts =
      plan === "free" && !isTrialActive
        ? [
            ...alerts.filter((a) => a.severity === "critical"),
            ...alerts
              .filter((a) => a.severity !== "critical")
              .slice(0, 2),
          ]
        : alerts;

    return visibleAlerts.map((alert) => (
      <div
        key={alert.id}
        onClick={() =>
          setExpandedRiskId(
            expandedRiskId === alert.id ? null : alert.id
          )
        }
        className={`cursor-pointer flex flex-col text-xs py-2 border-b border-[var(--border)]
${alert.severity === "low" ? "opacity-40" : ""}
${alert.created_at && getAlertAgeDays(alert.created_at) >= 4
  ? "bg-red-900/40"
  : alert.created_at && getAlertAgeDays(alert.created_at) >= 2
  ? "bg-yellow-900/30"
  : ""}
`}
      >
        <div className="flex items-center gap-2">
          <span className="truncate">
  {alert.type === "neglect_risk" && "🚨 "}
  {alert.message}
</span>

          {alert.created_at && isNewAlert(alert.created_at) && (
            <span className="text-[9px] text-green-400">
              NEW
            </span>
          )}

          {alert.escalated && (
            <span className="text-[9px] text-red-500">
              ESCALATED
            </span>
          )}
        </div>

        <span
          className={`ml-2 px-2 py-0.5 rounded ${
            alert.severity === "critical"
              ? "bg-red-800"
              : alert.severity === "high"
              ? "bg-red-500"
              : alert.severity === "medium"
              ? "bg-yellow-500"
              : "bg-blue-500"
          }`}
        >
          {alert.severity}
        </span>

        <p>Source: {alert.source || "unknown"}</p>

        <p className="text-gray-500">
          {isPro
            ? explainAlert(alert.type)
            : "🔒 Upgrade to see clinical explanation"}
        </p>

        {alert.section_title && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(
                `/clients/${id}/care-plan#${alert.section_title}`
              );
            }}
            className="text-blue-400 underline text-[11px]"
          >
            View in care plan
          </button>
        )}

        {alert.source !== "visit_auto" && isPro && (
          <button
            onClick={async (e) => {
              e.stopPropagation();

              const { data: userData } =
                await supabase.auth.getUser();
              const userId = userData?.user?.id;

              await supabase
                .from("alerts")
                .update({
                  status: "resolved",
                  closed_at: new Date().toISOString(),
                  resolution_source: "manual",
                  resolved_by: userId,
                })
                .eq("id", alert.id);

              await logAlertAudit({
                alert,
                action: "resolved",
                previous: { status: "active" },
                next: { status: "resolved" },
                userId,
                source: "manual_ui",
              });

              loadAlerts();
              loadResolvedAlerts();
            }}
            className="text-xs bg-green-600 px-2 py-1 rounded mt-1"
          >
            Mark as resolved
          </button>
        )}
      </div>
    ));
  })()
)}
<div className="bg-[var(--card)] p-5 rounded-lg mt-4">

  <h2 className="text-sm font-semibold mb-2 text-green-400">
    ✅ Recently Resolved
  </h2>

  {resolvedAlerts.length === 0 ? (
    <p className="text-xs text-gray-500">
      No recent improvements
    </p>
  ) : (
    (plan === "free" && !isTrialActive
  ? resolvedAlerts.slice(0, 2)
  : resolvedAlerts
).map((alert) => (
      <div
        key={alert.id}
        className="flex justify-between items-center text-xs py-1 border-b border-[var(--border)] opacity-70"
      >
        <span className="truncate">
          {alert.message}
        </span>

        <span className="text-[10px] text-gray-400">
          {alert.closed_at
            ? new Date(alert.closed_at).toLocaleDateString()
            : ""}
        </span>
      </div>
    ))
  )}
  {plan === "free" && !isTrialActive && (
  <div className="text-xs text-center text-gray-400 mt-2">
    🔒 Showing limited risks —{" "}
    <span
      onClick={() => router.push("/upgrade")}
      className="text-blue-400 underline cursor-pointer"
    >
      upgrade to unlock full clinical insights
    </span>
  </div>
)}

</div>
</div>
</div>

  {/* 🔷 MAIN CONTENT GRID */}
<div className="grid md:grid-cols-3 gap-4 mb-6">

  {/* 🧠 CARE PLAN (WIDE) */}
  <div className="bg-[var(--card)] p-5 rounded-lg md:col-span-2">

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
  <div className="bg-[var(--card)] p-5 rounded-lg">
    <h2 className="text-lg font-semibold mb-3">
      Pending Tasks
    </h2>

    {tasks.length === 0 ? (
      <p className="text-gray-500 text-sm">
        No pending tasks
      </p>
    ) : (
      tasks.slice(0, 5).map((task) => (
  <div key={task.id} className="flex justify-between text-sm mb-1">
  <span>
  {task.priority === "high" && "🚨 "}
  • {task.title}
</span>

  {task.linked_alert_type && (
    <span className="text-[10px] text-red-400">
  {task.linked_alert_type}
</span>
  )}
</div>
      ))
    )}
  </div>

</div>

{/* 🧠 LAST VISIT SUMMARY + RISKS */}
<div className="bg-[var(--card)] p-5 rounded-lg mb-6">

  <h2 className="text-lg font-semibold mb-3">
    Last Visit Overview
  </h2>

  {/* 📈 VISIT TREND (LAST 3) */}
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

{/* ✅ NOW SEPARATE BLOCK (OUTSIDE CONDITIONAL) */}
{/* 📊 CLINICAL TRENDS */}
<div className="bg-[var(--card)] p-5 rounded-lg mb-6">

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
  </>
)}
</div>
{/* 🔷 LOWER GRID */}
<div className="grid md:grid-cols-3 gap-4">

  {/* 📝 NOTES */}
  <div className="bg-[var(--card)] p-5 rounded-lg">

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
  <div className="bg-[var(--card)] p-5 rounded-lg md:col-span-2">

    <div className="flex justify-between items-center mb-3">
  <h2 className="text-lg font-semibold">
    Recent Visits
  </h2>

  <button
    onClick={() => router.push(`/clients/${id}/visit`)}
    className="text-xs text-blue-400"
  >
    View All →
  </button>
</div>

      {/* 👨‍👩‍👧 FAMILY FEEDBACK */}
<div className="bg-[var(--card)] p-5 rounded-lg mt-6">

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
  onClick={() => {
    if (!isPro) {
      router.push("/upgrade");
    }
  }}
  className={`text-xs px-3 py-1 rounded mt-4 relative ${
    isPro ? "bg-purple-600 opacity-60 cursor-not-allowed" : "bg-purple-600"
  }`}
>
  Invoice

  <span className="absolute inset-0 flex items-center justify-center text-[10px] bg-black/60 rounded">
    {isPro ? "Coming soon" : "Upgrade required"}
  </span>
</button>
    </div>
  </div>
  </div>

</div>
)}