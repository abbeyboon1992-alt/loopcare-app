"use client";

import { processVisit } from "@/lib/visitProcessor";
import { useParams } from "next/navigation";
import { careTypes } from "@/lib/careTypes";
import { useState, useEffect, useRef } from "react";
import { useAccess } from "@/app/context/AccessContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { masterTasks } from "@/data/masterTasks";
import carePlanPrompts from "@/data/carePlanPrompts.json";

export default function VisitSessionPage() {
  const router = useRouter();
  const params = useParams();
const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
const [visitSlot, setVisitSlot] = useState<"morning" | "lunch" | "tea" | "bed">("morning");
const [tasksFromDB, setTasksFromDB] = useState<any[]>([]);
const access = useAccess();
const plan = access?.plan || "free";
const isPro = plan === "pro";

const [useMasterTasks, setUseMasterTasks] = useState(!isPro);
const [client, setClient] = useState<any>(null);
const [timerOn, setTimerOn] = useState(false);
const [seconds, setSeconds] = useState(0);
const [alerts, setAlerts] = useState<any[]>([]);
const [showCancel, setShowCancel] = useState(false);
const [cancelReason, setCancelReason] = useState("");
const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
const [assessments, setAssessments] = useState<any>(null);
const [familyFeedback, setFamilyFeedback] = useState<any[]>([]);
const [showOverride, setShowOverride] = useState(false);
const [missedTasks, setMissedTasks] = useState<any[]>([]);
const [overrideReason, setOverrideReason] = useState("");
const hasSavedVisit = useRef(false);
const careType = client?.care_type as keyof typeof careTypes | undefined;
const config = careType ? careTypes[careType] : undefined;
const getGuidance = () => {
  if (!client || !config) return [];

  let base = [...config.guidance];

  const diagnosisList: string[] = client.diagnosis || [];

  if (diagnosisList.includes("Dementia")) {
    base.push("Speak slowly and clearly");
    base.push("Offer reassurance if confused");
  }

  if (diagnosisList.includes("Autism")) {
    base.push("Avoid sudden changes in routine");
    base.push("Use clear, direct communication");
  }

  return base;
};

const getBaseAlerts = () => {
  if (!config?.alerts) return [];

  return Object.values(config.alerts).map((a: any) => ({
    message: a.message,
    type: "base",
  }));
};

const getPromptsForTask = (taskName: string) => {
  return carePlanPrompts
    .filter((p: any) => p.task_name === taskName)
    .map((p: any) => p.prompt_text);
};

const mapTaskToSection = (title: string) => {
  const t = title.toLowerCase();

  if (t.includes("fluid") || t.includes("hydration"))
    return "Nutrition & Hydration";

  if (t.includes("meal") || t.includes("nutrition"))
    return "Nutrition & Hydration";

  if (t.includes("mobility") || t.includes("falls"))
    return "Mobility & Moving";

  if (t.includes("medication") || t.includes("insulin"))
    return "Medication Support";

  if (t.includes("bowel") || t.includes("toilet"))
    return "Personal Care (ADLs)";

  if (t.includes("skin") || t.includes("pressure"))
    return "Personal Care (ADLs)";

  if (t.includes("pain") || t.includes("breathing"))
    return "Medical Conditions & Overview";

  if (t.includes("emotional") || t.includes("reassurance"))
    return "Emotional Wellbeing";

  if (t.includes("cognition") || t.includes("confusion"))
    return "Cognitive Wellbeing";

  if (t.includes("safeguard"))
    return "Risks & Safety";

  return "General";
};

const getMasterTasksOnly = () => {
  if (!client) return [];

  const diagnosisListLower = Array.isArray(client.diagnosis)
    ? client.diagnosis.map((d: string) => (d || "").toLowerCase())
    : [];

  const careTypeLower = client.care_type?.toLowerCase();

  const filtered = masterTasks.filter((task: any) => {
    if (task.always) return true;

    if (task.care_types?.includes(careTypeLower)) return true;

    if (task.diagnosis) {
      return task.diagnosis.some((d: string) =>
        diagnosisListLower.some((cd: string) =>
          cd.includes(d.toLowerCase())
        )
      );
    }

    return false;
  });

  return filtered.map((task: any) => ({
    title: task.name,
    category: mapTaskToSection(task.name),
    priority: "medium",
    source: "master",
    prompts: getPromptsForTask(task.name),
  }));
};

const getTasks = () => {
  if (!client) return [];

  // 🔒 FREE USERS → ONLY MASTER TASKS
  if (!isPro) {
    return getMasterTasksOnly();
  }

  let tasks: any[] = [];

  // ✅ AUTO TASKS (PRIMARY SOURCE)
const autoTasks = getAutoTasksFromObservations();

tasks.push(
  ...autoTasks.map((t) => ({
    title: t.title,
    category: mapTaskToSection(t.title),
    priority: "high",
    source: "auto",
    prompts: getPromptsForTask(t.title),
    reasoning: t.reason, // 🔥 NEW
  }))
);

// 🔒 ASSESSMENT ENFORCEMENT (ONLY CRITICAL)
if (assessments?.hydration === "poor") {
  tasks.push({
    title: "Monitor fluid intake closely",
    category: "Nutrition & Hydration",
    priority: "high",
    source: "assessment_required",
    prompts: [],
    reasoning: "Assessment indicates dehydration risk",
  });
}

if (assessments?.mobility === "high risk") {
  tasks.push({
    title: "Observe mobility",
    category: "Mobility & Moving",
    priority: "high",
    source: "assessment_required",
    prompts: [],
    reasoning: "Assessment indicates high falls risk",
  });
}

  // 1️⃣ CARE PLAN TASKS (PRIMARY)
  if (tasksFromDB.length > 0) {
  tasks.push(
    ...tasksFromDB.map((t) => ({
      title: t.title, // ✅ FIXED
      category: mapTaskToSection(t.title),
      priority: t.priority || "medium",
      source: "care_plan",
      prompts: getPromptsForTask(t.title),
    }))
  );
}

// 🟢 OPTIONAL MASTER TASKS (PRO ONLY)
if (useMasterTasks) {
  const master = getMasterTasksOnly();

  master.forEach((task) => {
    const exists = tasks.some(
      (t) => t.title.toLowerCase() === task.title.toLowerCase()
    );

    if (!exists) {
      tasks.push({
        ...task,
        priority: "low",
      });
    }
  });
}

  // 🔥 REMOVE DUPLICATES (important)
  const uniqueTasks = tasks.filter(
  (task, index, self) =>
    index ===
    self.findIndex(
      (t) =>
        t.title.toLowerCase() === task.title.toLowerCase() &&
        t.category === task.category
    )
);

  // 🔥 SORT BY PRIORITY
  const order: Record<string, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  return uniqueTasks.sort(
    (a, b) => (order[a.priority] || 3) - (order[b.priority] || 3)
  );
};
const getGroupedTasks = () => {
const tasks = getTasks();

  return tasks.reduce<Record<string, any[]>>((acc, task) => {
    const key = task.category || "Other";

    if (!acc[key]) acc[key] = [];
    acc[key].push(task);

    return acc;
  }, {});
};
  const [step, setStep] = useState(1);
  const [recording, setRecording] = useState(false);
const [transcript, setTranscript] = useState("");
const [autoAddedTasks, setAutoAddedTasks] = useState<
  { title: string; reason: string }[]
>([]);
  const [data, setData] = useState<{
  tasks: string[];
  hydration: string;
  nutrition: string;
  mood: string;
  mobility: string;
  toileting: string;
  medication: string;
  medication_reason: string;

  // ✅ NEW FIELDS
  pain: string;
  breathing: string;
  cognition: string;
  skin: string;
  safeguarding: string;

  notes: string;
}>({
  tasks: [],
  hydration: "",
  nutrition: "",
  mood: "",
  mobility: "",
  toileting: "",
  medication: "",
  medication_reason: "",

  // ✅ MUST ALSO ADD DEFAULT VALUES
  pain: "",
  breathing: "",
  cognition: "",
  skin: "",
  safeguarding: "",

  notes: "",
});

useEffect(() => {
  const loadClient = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id as string)
      .maybeSingle()
    
    const { data: assessments } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", id)
  .maybeSingle();

setAssessments(assessments);

    if (data) {
      setClient(data);
    }

    // ✅ LOAD TASKS FROM DATABASE
const { data: tasks } = await supabase
  .from("visit_tasks")
  .select("*")
  .eq("client_id", id)
  .eq("status", "pending");

if (tasks) {
  setTasksFromDB(tasks);
}
  };

  if (id) loadClient();
}, [id]);

useEffect(() => {
  if (!id) return;

  const loadAlerts = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", id)
      .eq("status", "active");

    if (data) setAlerts(data);
  };

  loadAlerts();
}, [id]);

useEffect(() => {
  if (!id) return;

  const loadFeedback = async () => {
    const { data } = await supabase
      .from("family_feedback")
      .select("*")
      .eq("client_id", id)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (data) setFamilyFeedback(data);
  };

  loadFeedback();
}, [id]);

useEffect(() => {
  let interval: any;

  if (timerOn) {
    interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  }

  return () => clearInterval(interval);
}, [timerOn]);

  const toggleTask = (task: string) => {
  setData((prev: any) => {
    const exists = prev.tasks.includes(task);

    let updated;

    if (exists) {
      updated = prev.tasks.filter((t: string) => t !== task);
    } else {
      updated = [...prev.tasks, task];
    }

    return {
      ...prev,
      tasks: updated,
    };
  });
};
  useEffect(() => {
  if (!activeVisitId) return;

  const channel = supabase
    .channel("alerts-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "alerts",
        filter: `client_id=eq.${id}`
      },
      (payload) => {
        setLiveAlerts((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [activeVisitId]);

useEffect(() => {
  const autoTasks = getAutoTasksFromObservations();

  setAutoAddedTasks(autoTasks);

  const autoTitles = autoTasks.map((t) => t.title);

  setData((prev) => {
    const cleaned = prev.tasks.filter(
      (t) =>
        !autoAddedTasks.map((a) => a.title).includes(t)
    );

    return {
      ...prev,
      tasks: Array.from(new Set([
        ...cleaned,
        ...autoTitles
      ])),
    };
  });
}, [
  data.hydration,
  data.nutrition,
  data.mobility,
  data.medication,
  data.toileting,
  data.mood,
  data.cognition,
  data.skin,
  data.pain,
  data.breathing,
  data.safeguarding,
]);

  const formatTime = () => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

  const startVoice = () => {
  const SpeechRecognition =
    (window as any).webkitSpeechRecognition ||
    (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser");
    return;
  }

const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => setRecording(true);

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    setTranscript(text);
    setData((prev) => ({ ...prev, notes: text }));
  };

  recognition.onend = () => setRecording(false);

  recognition.start();
};

const getAutoTasksFromObservations = () => {
  const autoTasks: { title: string; reason: string }[] = [];

  // 💧 HYDRATION
  if (data.hydration === "poor" || data.hydration === "refused") {
    autoTasks.push({
      title: "Encourage fluid intake",
      reason: "Low fluid intake",
    });
  }

  if (data.hydration === "none") {
    autoTasks.push({
      title: "Urgent hydration intervention",
      reason: "No fluid intake",
    });
  }

  // 🍽️ NUTRITION
  if (data.nutrition === "poor" || data.nutrition === "none") {
    autoTasks.push({
      title: "Encourage meals and monitor intake",
      reason: "Poor nutrition",
    });
  }

  // 💊 MEDICATION
  if (data.medication === "refused" || data.medication === "missed") {
    autoTasks.push({
      title: "Review medication compliance",
      reason: "Medication not taken",
    });
  }

  // 🚶 MOBILITY
  if (data.mobility === "fall") {
    autoTasks.push({
      title: "Implement falls prevention measures",
      reason: "Fall occurred",
    });
  }

  if (data.mobility === "unsteady" || data.mobility === "decline") {
    autoTasks.push({
      title: "Assist with mobility and prevent falls",
      reason: "Mobility decline/unsteady",
    });
  }

  // 🚽 TOILETING
  if (data.toileting === "diarrhoea" || data.toileting === "constipated") {
    autoTasks.push({
      title: "Monitor bowel movements",
      reason: "Bowel issue",
    });
  }

  // 🧠 COGNITION
  if (data.cognition === "confused" || data.cognition === "very_confused") {
    autoTasks.push({
      title: "Monitor cognition",
      reason: "Confusion observed",
    });
  }

  // 😟 MOOD
  if (data.mood === "low" || data.mood === "distressed") {
    autoTasks.push({
      title: "Provide emotional reassurance",
      reason: "Low/distressed mood",
    });
  }

  // 🧴 SKIN
  if (data.skin !== "intact") {
    autoTasks.push({
      title: "Check skin condition",
      reason: "Skin concern",
    });
  }

  // 😖 PAIN
  if (data.pain === "moderate" || data.pain === "high") {
    autoTasks.push({
      title: "Assess pain level",
      reason: "Pain reported",
    });
  }

  // 🫁 BREATHING
  if (data.breathing !== "normal") {
    autoTasks.push({
      title: "Monitor breathing",
      reason: "Breathing concern",
    });
  }

  // 🚨 SAFEGUARDING
  if (data.safeguarding === "concern") {
    autoTasks.push({
      title: "Check safety and wellbeing",
      reason: "Safeguarding concern",
    });
  }

  return autoTasks;
};

const getClinicalAlerts = () => {
  if (!client) return [];


  // ⚡ mimic backend rules (light version only for UI preview)

  const results: any[] = [];

  const hydration =
  data.hydration === "adequate"
    ? "good"
    : data.hydration === "reduced"
    ? "poor"
    : data.hydration;

if (hydration === "poor" || hydration === "refused") {
    results.push({
      type: "hydration_low",
      severity: "high",
      message: "Low fluid intake",
    });
  }

  if (data.hydration === "none") {
    results.push({
      type: "hydration_critical",
      severity: "critical",
      message: "No fluid intake",
    });
  }

  if (hydration === "good") {
  results.push({
    type: "hydration_good",
    severity: "low",
    message: "Hydration adequate",
  });
}

  if (data.medication === "refused") {
    results.push({
      type: "medication_refused",
      severity: "high",
      message: "Medication refused",
    });
  }

  if (data.mobility === "fall") {
    results.push({
      type: "falls_event",
      severity: "critical",
      message: "Fall occurred",
    });
  }

  if (data.toileting === "diarrhoea") {
    results.push({
      type: "bowel_risk",
      severity: "medium",
      message: "Diarrhoea — monitor hydration",
    });
  }

  return results;
};

const generateVisitSummary = () => {
  const alerts = getClinicalAlerts();

  const risks: any = {
    hydration: data.hydration === "poor" || data.hydration === "refused",
    falls: data.mobility === "fall",
    medication: data.medication === "refused" || data.medication === "missed",
    bowel: data.toileting === "diarrhoea",
  };

  const needs_follow_up =
    alerts.length > 0 ||
    Object.values(risks).some((r) => r === true);

  return {
    summary: `
Visit duration: ${Math.floor(seconds / 60)} minutes.
Tasks completed: ${data.tasks.join(", ") || "none"}.
Hydration: ${data.hydration || "not recorded"}, 
Nutrition: ${data.nutrition || "not recorded"}, 
Mood: ${data.mood || "not recorded"}, 
Mobility: ${data.mobility || "not recorded"}, 
Toileting: ${data.toileting || "not recorded"}, 
Medication: ${data.medication || "not recorded"}.
${alerts.length ? "Concerns: " + alerts.map((a) => a.message).join(", ") : ""}
${data.notes ? "Notes: " + data.notes : ""}
    `.trim(),

    alerts,
    risks,
    tasks_completed: data.tasks,
    needs_follow_up,
  };
};

const clientId = id as string;
const userId = "temp-user";

// 🔴 CHECK REQUIRED TASKS BEFORE FINISH
const finishVisitCore = async () => {

  await processVisit({
  clientId,
  userId,
  visitId: activeVisitId,
  data: {
    ...data,
    duration: seconds,
    autoTasks: autoAddedTasks, // ✅ ADD THIS
  },
});

  await fetch("/api/update-careplan-from-visit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: id,
    data,
    autoTasks: autoAddedTasks, // ✅ ADD
  }),
});

  await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: id,
      visitId: activeVisitId,
      observations: data,
      diagnosis: client.primary_diagnosis,
    }),
  });

  await fetch("/api/sync-assessments-from-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: id,
      visit_id: activeVisitId,
    }),
  });

  await supabase.from("family_updates").insert({
    client_id: id,
    visit_id: activeVisitId,
    type: "visit_summary",
    update: "TEST UPDATE",
  });

  setStep(5);
};

const continueFinishWithOverride = async () => {
  if (!overrideReason) {
    alert("Select a reason");
    return;
  }

  await supabase.from("visit_overrides").insert({
    client_id: id,
    visit_id: activeVisitId,
    reason: overrideReason,
    missed_tasks: missedTasks.map((t) => t.title),
  });

  setShowOverride(false);

  await finishVisitCore();
};

const handleFinish = async () => {
  if (hasSavedVisit.current) return;

  const requiredTasks = getTasks().filter(
    (t: any) => t.source === "assessment_required"
  );

  const completedTasks = data.tasks || [];

  const missedRequired = requiredTasks.filter(
    (t: any) =>
      !completedTasks.some(
        (ct: string) =>
          ct.toLowerCase() === t.title.toLowerCase()
      )
  );

  if (missedRequired.length > 0) {
    setMissedTasks(missedRequired);
    setShowOverride(true);
    return;
  }

  await finishVisitCore();
};


 const handleCancelVisit = async () => {
  if (!cancelReason) {
    alert("Please select a reason");
    return;
  }

  try {
    const { data: activeVisit } = await supabase
      .from("active_visits")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("ACTIVE VISIT RESULT:", activeVisit);

    let visitId = activeVisitId;

if (!visitId && activeVisit) {
  visitId = activeVisit.id;
}

    if (activeVisit) {
      visitId = activeVisit.id;

      await supabase
        .from("active_visits")
        .delete()
        .eq("id", activeVisit.id);
    }

    // 🔥 ALWAYS RUN INSERT (even if no active visit)
    const { error } = await supabase
      .from("visit_cancellations")
      .insert({
        visit_id: visitId,
        client_id: id,
        reason: cancelReason,
      });

    if (error) {
  console.error("❌ CANCEL INSERT ERROR:", error);
  alert("Failed to save cancellation");
  return;
}

console.log("✅ CANCEL INSERT SUCCESS:", {
  visitId,
  client_id: id,
  reason: cancelReason,
});

    console.log("✅ CANCEL SAVED");

    setShowCancel(false);
    router.push(`/clients/${id}`);

  } catch (err) {
    console.error("❌ CANCEL ERROR:", err);
    alert("Error cancelling visit");
  }
};

if (!client || !config) {
  return <div className="p-6 text-[var(--text)]">Loading visit...</div>;
}

const combinedAlerts = [
  ...alerts,
  ...liveAlerts,
  ...getClinicalAlerts(),
];

const resolveAlert = async (alertId: string) => {
  await supabase
    .from("alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  // refresh
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id)
    .eq("status", "active");

  if (data) setAlerts(data);
};

const createConcernFromAlert = async (alert: any) => {
  const { error } = await supabase
    .from("concern_records")
    .insert({
      client_id: id,
      alert_id: alert.id,
      description: alert.message,
      priority: alert.severity,
      status: "open",
    });

  if (!error) {
    await resolveAlert(alert.id);
  }
};

  return (
    
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      {showOverride && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-[var(--card)] p-6 rounded-lg w-full max-w-md">

      <h2 className="text-lg font-semibold mb-3">
        ⚠️ Required checks not completed
      </h2>

      <p className="text-sm mb-3 text-[var(--muted)]">
        The following required checks were not completed:
      </p>

      <ul className="text-sm mb-4">
        {missedTasks.map((t, i) => (
          <li key={i}>• {t.title}</li>
        ))}
      </ul>

      <p className="text-sm mb-2">
        Please select a reason:
      </p>

      <div className="space-y-2 mb-4">
        {[
          "Client refused",
          "Not clinically appropriate",
          "Equipment unavailable",
          "Already completed earlier",
          "Other",
        ].map((reason) => (
          <button
            key={reason}
            onClick={() => setOverrideReason(reason)}
            className={`w-full p-3 text-base rounded ${
  overrideReason === reason
    ? "bg-blue-600"
    : "bg-[var(--card)]"
}`}
          >
            {reason}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowOverride(false)}
          className="flex-1 bg-gray-600 py-2 rounded"
        >
          Go Back
        </button>

        <button
          onClick={() => {
            if (!overrideReason) {
              alert("Select a reason");
              return;
            }

            setShowOverride(false);

            // ✅ CONTINUE ORIGINAL FINISH FLOW
            continueFinishWithOverride();
          }}
          className="flex-1 bg-yellow-600 py-2 rounded"
        >
          Continue Anyway
        </button>
      </div>

    </div>
  </div>
)}
      {showCancel && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-[var(--card)] p-6 rounded-lg w-full max-w-md">

      <h2 className="text-lg font-semibold mb-4">
        Cancel Visit
      </h2>

      <p className="text-sm text-[var(--muted)] mb-3">
        Why is this visit being cancelled?
      </p>

      <div className="space-y-2 mb-4">
        {[
          "Client not home",
          "Client refused visit",
          "Carer unavailable",
          "Emergency elsewhere",
          "Duplicate visit",
          "Other",
        ].map((reason) => (
          <button
            key={reason}
            onClick={() => setCancelReason(reason)}
            className="w-full p-3 text-base rounded bg-[var(--card)]"
          >
            {reason}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowCancel(false)}
          className="flex-1 bg-gray-600 py-2 rounded"
        >
          Back
        </button>

        <button
          onClick={handleCancelVisit}
          className="flex-1 bg-red-600 py-2 rounded"
        >
          Confirm Cancel
        </button>
      </div>
    </div>
  </div>
)}
      <div className="flex justify-end mb-4">
  <button
    onClick={() => setShowCancel(true)}
    className="bg-red-700 px-3 py-2 rounded text-sm"
  >
    Cancel Visit
  </button>
</div>
<div className="mb-4">
  <h2 className="font-semibold mb-2">Alerts</h2>

  {combinedAlerts.length === 0 ? (
    <p className="text-[var(--muted)]">No alerts</p>
  ) : (
    combinedAlerts.map((a: any, i) => (
  <div key={i} className="bg-red-600 p-2 rounded mb-2 flex justify-between items-center">

    <span>{a.message}</span>

    {a.id && (
      <button
        onClick={() => resolveAlert(a.id)}
        className="text-xs bg-black px-2 py-1 rounded"
      >
        Resolve
      </button>
    )}
    <button
  onClick={() => createConcernFromAlert(a)}
  className="text-xs bg-yellow-600 px-2 py-1 rounded"
>
  Concern
</button>

  </div>
))
  )}
</div>
      {step === 1 && (
        <>
          <h1 className="text-2xl mb-4">Start Visit</h1>
          <div className="mb-4">
  <p className="text-sm text-[var(--muted)] mb-2">Select visit type</p>

  <div className="flex gap-2">
    {["morning", "lunch", "tea", "bed"].map((slot) => (
      <button
        key={slot}
        onClick={() => setVisitSlot(slot as any)}
        className={`px-3 py-2 rounded ${
          visitSlot === slot
            ? "bg-purple-600"
            : "bg-[var(--card)]"
        }`}
      >
        {slot}
      </button>
    ))}
  </div>
</div>
          <div className="bg-[var(--card)] p-3 rounded mb-4 flex justify-between items-center">

  <button
    onClick={() => setTimerOn(!timerOn)}
    className={`px-3 py-1 rounded ${
      timerOn ? "bg-red-600" : "bg-green-600"
    }`}
  >
    {timerOn ? "Stop Timer" : "Start Timer"}
  </button>

  {timerOn && (
    <p className="font-mono">{formatTime()}</p>
  )}

</div>

          <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">
  <h2 className="text-lg font-semibold mb-2">
    🧠 Care Guidance
  </h2>

  <ul className="space-y-1 text-gray-300">
  {getGuidance().map((g: string, i: number) => (
  <li key={i}>• {g}</li>
))}
</ul>
</div>

          <button
  onClick={async () => {
    const { data, error } = await supabase
      .from("active_visits")
      .insert({
  client_id: id,
  started_at: new Date().toISOString(),
})
      .select()
      .maybeSingle()

    if (data) {
      setActiveVisitId(data.id);
    }

    setStep(2);
  }}
  className="bg-blue-600 w-full py-3 rounded"
>
  Begin
</button>
        </>
      )}

{step === 2 && (
  <>
    <h1 className="mb-4">Tasks</h1>
    <div className="mb-3 flex items-center gap-3">
  <button
    onClick={() => {
      if (!isPro) return;
      setUseMasterTasks((prev) => !prev);
    }}
    disabled={!isPro}
    className={`px-3 py-1 rounded text-sm ${
      useMasterTasks ? "bg-green-600" : "bg-gray-600"
    } ${!isPro ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {useMasterTasks ? "Master Tasks ON" : "Master Tasks OFF"}
  </button>

  {!isPro && (
    <span className="text-xs text-yellow-400">
      Upgrade to unlock smart tasks
    </span>
  )}
</div>

    <p className="text-sm text-[var(--muted)] mb-2">
      {tasksFromDB.length > 0
        ? "Tasks from care plan"
        : "Standard care tasks"}
    </p>

    <div className="space-y-2 mb-6">
      {Object.entries(getGroupedTasks() || {}).map(([section, tasks]: any) => (
  <div key={section} className="mb-4">

    <p className="text-sm text-purple-400 mb-2">
      {section}
    </p>

    {tasks.map((task: any) => {
      const selected = data.tasks.includes(task.title);
const auto = autoAddedTasks.includes(task.title);

      return (
        <div key={task.title}>
          <button
            onClick={() => toggleTask(task.title)}
            className={`w-full p-3 text-base rounded ${
  selected
    ? auto
      ? "bg-blue-600"
      : "bg-green-600"
    : "bg-[var(--card)]"
}`}
          >
            <div className="text-left">
              <p className="font-semibold flex justify-between">
  {task.title}

{autoAddedTasks.find((a) => a.title === task.title) && (
  <p className="text-xs text-yellow-400 mt-1">
    ⚠ {autoAddedTasks.find((a) => a.title === task.title)?.reason}
  </p>
)}

  {task.priority === "high" && (
    <span className="text-red-400 text-xs">HIGH</span>
  )}
  {task.priority === "medium" && (
    <span className="text-yellow-400 text-xs">MED</span>
  )}
</p>
            </div>
          </button>

          {selected && task.prompts.length > 0 && (
            <div className="bg-[var(--card)] p-2 text-sm rounded mt-1 mb-2">
              {task.prompts.map((p: string, i: number) => (
                <p key={i}>• {p}</p>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
))}
</div>

    <button
      onClick={() => setStep(3)}
      className="bg-blue-600 w-full py-3 rounded"
    >
      Next
    </button>
  </>
)}

      {step === 3 && (
  <>
    <h1 className="text-xl font-semibold mb-4">
      Observations
    </h1>

    {/* HYDRATION */}
    <div className="mb-4">
      <p className="mb-2">Hydration</p>
      <div className="flex gap-2">
        {[
  "adequate",
  "reduced",
  "poor",
  "none",
  "refused"
].map((val) => (
  <button
    key={val}
    onClick={() => {
      setData({ ...data, hydration: val });

      if (val === "poor" || val === "refused") {
      }
    }}
    className={`px-3 py-2 rounded ${
      data.hydration === val
        ? "bg-blue-600"
        : "bg-[var(--card)]"
    }`}
  >
    {val}
  </button>
))}
      </div>
    </div>

    {/* NUTRITION */}
<div className="mb-4">
  <p className="mb-2">Nutrition</p>
  <div className="flex flex-wrap gap-2">
    {[
  "adequate",
  "reduced",
  "poor",
  "none",
  "refused"
].map((val) => (
      <button
        key={val}
        onClick={() =>
          setData({ ...data, nutrition: val })
        }
        className={`px-3 py-2 rounded ${
          data.nutrition === val
            ? "bg-blue-600"
            : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

    {/* MOOD */}
    <div className="mb-4">
      <p className="mb-2">Mood</p>
      <div className="flex gap-2">
        {[
  "positive",
  "neutral",
  "low",
  "distressed",
  "agitated"
].map((val) => (
          <button
  key={val}
  onClick={() => {
    setData({ ...data, mood: val });

    if (val === "low" || val === "distressed") {
    }
  }}
  className={`px-3 py-2 rounded ${
    data.mood === val
      ? "bg-blue-600"
      : "bg-[var(--card)]"
  }`}
>
            {val}
          </button>
        ))}
      </div>
    </div>

{/* MOBILITY */}
<div className="mb-4">
  <p className="mb-2">Mobility</p>
  <div className="flex flex-wrap gap-2">
    {[
  "independent",
  "needs assistance",
  "unsteady",
  "decline",
  "fall",
  "bedbound"
].map((val) => (
      <button
        key={val}
        onClick={() =>
          setData({ ...data, mobility: val })
        }
        className={`px-3 py-2 rounded ${
          data.mobility === val
            ? "bg-blue-600"
            : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

{/* TOILETING */}
<div className="mb-4">
  <p className="mb-2">Toileting</p>
  <div className="flex flex-wrap gap-2">
    {[
  "normal",
  "constipated",
  "diarrhoea",
  "incontinence",
  "catheter",
  "stoma"
].map((val) => (
      <button
        key={val}
        onClick={() =>
          setData({ ...data, toileting: val })
        }
        className={`px-3 py-2 rounded ${
          data.toileting === val
            ? "bg-blue-600"
            : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

    {/* MEDICATION */}
    <div className="mb-6">
      <p className="mb-2">Medication</p>
      <div className="flex gap-2">
        {[
  "taken",
  "refused",
  "missed",
  "not_required"
].map((val) => (
          <button
  key={val}
  onClick={() => {
    setData({ ...data, medication: val });

    if (val === "refused" || val === "missed") {
    }
  }}
  className={`px-3 py-2 rounded ${
    data.medication === val
      ? "bg-blue-600"
      : "bg-[var(--card)]"
  }`}
>
            {val}
          </button>
        ))}
      </div>
    </div>

    <div className="mb-4">
  <p className="mb-2">Pain</p>
  <div className="flex gap-2">
    {["none", "mild", "moderate", "high"].map((val) => (
      <button
        key={val}
        onClick={() => setData({ ...data, pain: val })}
        className={`px-3 py-2 rounded ${
          data.pain === val ? "bg-blue-600" : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

<div className="mb-4">
  <p className="mb-2">Breathing</p>
  <div className="flex gap-2">
    {["normal", "shortness_of_breath", "laboured"].map((val) => (
      <button
        key={val}
        onClick={() => setData({ ...data, breathing: val })}
        className={`px-3 py-2 rounded ${
          data.breathing === val ? "bg-blue-600" : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

<div className="mb-4">
  <p className="mb-2">Cognition</p>
  <div className="flex gap-2">
    {["baseline", "confused", "very_confused"].map((val) => (
      <button
        key={val}
        onClick={() => setData({ ...data, cognition: val })}
        className={`px-3 py-2 rounded ${
          data.cognition === val ? "bg-blue-600" : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

<div className="mb-4">
  <p className="mb-2">Skin</p>
  <div className="flex gap-2">
    {[
      "intact",
      "redness",
      "category 1",
      "category 2",
      "category 3",
      "category 4",
      "breakdown",
    ].map((val) => (
      <button
        key={val}
        onClick={() => setData({ ...data, skin: val })}
        className={`px-3 py-2 rounded ${
          data.skin === val ? "bg-blue-600" : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

<div className="mb-4">
  <p className="mb-2">Safeguarding</p>
  <div className="flex gap-2">
    {["none", "concern"].map((val) => (
      <button
        key={val}
        onClick={() => setData({ ...data, safeguarding: val })}
        className={`px-3 py-2 rounded ${
          data.safeguarding === val ? "bg-blue-600" : "bg-[var(--card)]"
        }`}
      >
        {val}
      </button>
    ))}
  </div>
</div>

    {/* MEDICATION REFUSAL REASON */}
{data.medication === "refused" && (
  <div className="mb-4">
    <p className="mb-2">Reason for refusal</p>

    <div className="flex flex-wrap gap-2">
      {[
        "side effects observed",
        "hospitalised",
        "nausea/vomiting",
        "dose not available",
        "customer cancelled",
        "given by family",
      ].map((reason) => (
        <button
          key={reason}
          onClick={() =>
            setData({ ...data, medication_reason: reason })
          }
          className={`px-3 py-2 rounded ${
            data.medication_reason === reason
              ? "bg-purple-600"
              : "bg-[var(--card)]"
          }`}
        >
          {reason}
        </button>
      ))}
    </div>
  </div>
)}

    <button
      onClick={() => setStep(4)}
      className="w-full bg-blue-600 py-3 rounded-lg"
    >
      Next
    </button>
  </>
)}

      {step === 4 && (
  <>
    <h1 className="text-xl mb-4">Notes</h1>

    {/* 🎤 VOICE BUTTON */}
    <button
  onClick={startVoice}
  className={`w-full p-3 text-base rounded ${
    recording ? "bg-red-600" : "bg-purple-600"
  }`}
>
      {recording ? "Recording..." : "🎤 Start Voice Note"}
    </button>

    {/* TRANSCRIPT DISPLAY */}
    {transcript && (
      <div className="bg-[var(--card)] p-3 mb-4 rounded">
        <p className="text-sm text-[var(--muted)]">Voice captured:</p>
        <p>{transcript}</p>
      </div>
    )}

    {/* TEXT AREA */}
    <textarea
      value={data.notes}
      onChange={(e) =>
        setData({ ...data, notes: e.target.value })
      }
      className="w-full p-3 text-base rounded bg-[var(--card)] mb-6"
      placeholder="Add notes or use voice..."
    />

    <button
      onClick={handleFinish}
      className="bg-green-600 w-full py-3 rounded"
    >
      Finish Visit
    </button>
  </>
)}

      {step === 5 && (
  <div className="bg-[var(--card)] p-6 rounded-lg">

    <h1 className="text-2xl font-bold mb-4">
      ✅ Visit Summary
    </h1>

    {/* TASKS */}
    <div className="mb-4">
      <h2 className="font-semibold mb-2">Tasks Completed</h2>

      {data.tasks.length === 0 ? (
        <p className="text-[var(--muted)]">No tasks recorded</p>
      ) : (
        <ul className="list-disc pl-5">
          {data.tasks.map((task: string, i: number) => (
            <li key={i}>{task}</li>
          ))}
        </ul>
      )}
    </div>

    {/* OBSERVATIONS */}
    <div className="mb-4">
      <h2 className="font-semibold mb-2">Observations</h2>

      <p>💧 Hydration: {data.hydration || "-"}</p>
      <p>🍽️ Nutrition: {data.nutrition || "-"}</p>
<p>🚶 Mobility: {data.mobility || "-"}</p>
<p>🚽 Toileting: {data.toileting || "-"}</p>
      <p>🙂 Mood: {data.mood || "-"}</p>
      <p>💊 Medication: {data.medication || "-"}</p>
      {data.medication === "refused" && data.medication_reason && (
  <p className="text-sm text-red-300">
    Reason: {data.medication_reason}
  </p>
)}
    </div>

    {familyFeedback.length > 0 && (
  <div className="mb-4 bg-yellow-600 p-3 rounded">
    <h2 className="font-semibold mb-2">
      👨‍👩‍👧 Family Concerns
    </h2>

    {familyFeedback.map((f) => (
      <div key={f.id} className="mb-2 text-sm">
        ⚠ {f.message}
      </div>
    ))}
  </div>
)}

    {/* ALERTS (SIMPLE SOLO VERSION) */}
    <div className="mb-4">
      <h2 className="font-semibold mb-2">Alerts</h2>

      {!data.hydration && !data.mood && !data.medication && (
        <p className="text-[var(--muted)]">No alerts</p>
      )}
    </div>

    {/* NOTES */}
    <div className="mb-6">
      <h2 className="font-semibold mb-2">Notes</h2>

      {data.notes ? (
        <p className="bg-[var(--card)] p-3 rounded">
          {data.notes}
        </p>
      ) : (
        <p className="text-[var(--muted)]">No notes added</p>
      )}
    </div>

    {/* ACTION BUTTON */}
    <button
      onClick={() => router.push(`/clients/${id}`)}
      className="w-full bg-blue-600 py-3 rounded"
    >
      Back to Clients
    </button>

  </div>
)}

    </div>
  );
}