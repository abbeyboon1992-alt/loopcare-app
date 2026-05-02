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
  const params = useParams<{ id: string }>();
const id = Array.isArray(params.id) ? params.id[0] : params.id;
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
  const clean = (str: string) =>
    (str || "").toLowerCase().replace(/[^a-z]/g, "");

  const task = clean(taskName);

  return carePlanPrompts
    .filter((p: any) => {
      const promptName = clean(p.task_name);

      return (
        task.includes(promptName) ||
        promptName.includes(task)
      );
    })
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
    prompts: task.prompts || [],
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
const observationTasks = getAutoTasksFromObservations();
const alertTasks = getAutoTasksFromAlerts();

// 🔥 MERGE + DEDUPE
const autoTasks = [
  ...observationTasks,
  ...alertTasks,
].filter(
  (task, index, self) =>
    index ===
    self.findIndex(
      (t) => t.title === task.title
    )
);

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
      source: "care_plan_required",
priority: "high",
      prompts: getPromptsForTask(t.title),
    }))
  );
}

// 🟢 OPTIONAL MASTER TASKS (PRO ONLY)
if (useMasterTasks) {
  const master = getMasterTasksOnly();

  master.forEach((task) => {
  const exists = tasks.some(
    (t) => t.title === task.title
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
  const [step, setStep] = useState<number>(1);
  const [recording, setRecording] = useState(false);
const [transcript, setTranscript] = useState("");
const [autoAddedTasks, setAutoAddedTasks] = useState<
  { title: string; reason: string }[]
>([]);
  const [data, setData] = useState<{
  tasks: {
  title: string;
  responses?: Record<string, string>;
}[];
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
  if (!id) return;

  const loadClient = async () => {
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", id)
      .maybeSingle();

    if (clientData) setClient(clientData);
    if (assessmentData) setAssessments(assessmentData);
  };

  const loadCarePlan = async () => {
    const { data: carePlan } = await supabase
      .from("care_plan_section")
      .select("*")
      .eq("client_id", id);

    const carePlanTasks =
      carePlan?.flatMap((section: any) =>
        (section.actions || "")
  .split("\n")
  .filter(Boolean)
  .map((action: string) => ({
          title: action,
          category: section.title,
          priority: "high",
          source: "care_plan_required",
        }))
      ) || [];

    setTasksFromDB(carePlanTasks);
  };

  loadClient();
  loadCarePlan();

}, [id]);

useEffect(() => {
  if (!id) return;

  const loadAlerts = async () => {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", id)
.eq("status", "active")
.gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

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
    const exists = prev.tasks.some((t: any) => t.title === task);

    let updated;

    if (exists) {
  updated = prev.tasks.filter((t: any) => t.title !== task);
} else {
  updated = [...prev.tasks, { title: task }];
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
  const observationTasks = getAutoTasksFromObservations();
  const alertTasks = getAutoTasksFromAlerts();

  const autoTasks = [
    ...observationTasks,
    ...alertTasks,
  ].filter(
    (task, index, self) =>
      index ===
      self.findIndex((t) => t.title === task.title)
  );

  setAutoAddedTasks(autoTasks);

  const autoTitles = autoTasks.map((t) => t.title);

  setData((prev) => {
    const cleaned = prev.tasks.filter(
      (t) =>
        !autoTasks.some((a) => a.title === t.title)
    );

    return {
      ...prev,
      tasks: [
  ...cleaned,
  ...autoTasks.map(t => ({
    title: t.title
  }))
]
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
  alerts,           // 🔥 ADD
  liveAlerts,       // 🔥 ADD
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
    alert("Speech not supported");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.onstart = () => setRecording(true);

  recognition.onresult = (event: any) => {
    const text =
      event.results[0][0].transcript.toLowerCase();

    const voiceTasks = extractTasksFromVoice(text);

    setAutoAddedTasks(prev => [
      ...prev,
      ...voiceTasks,
    ]);

    setData(prev => ({
      ...prev,
      notes: (prev.notes || "") + " " + text,
    }));

    // AUTO TAG
    if (text.includes("refused medication")) {
      setData(prev => ({ ...prev, medication: "refused" }));
    }

    if (text.includes("not drinking")) {
      setData(prev => ({ ...prev, hydration: "poor" }));
    }

    setTranscript(text);
  };

  recognition.onend = () => setRecording(false);

  recognition.start();
};

const extractTasksFromVoice = (text: string) => {
  const tasks: { title: string; reason: string }[] = [];

  if (text.includes("refused medication")) {
    tasks.push({
      title: "Review medication compliance",
      reason: "Voice: medication refusal",
    });
  }

  if (text.includes("did not eat")) {
    tasks.push({
      title: "Encourage meals and monitor intake",
      reason: "Voice: poor nutrition",
    });
  }

  if (text.includes("not drinking")) {
    tasks.push({
      title: "Encourage fluid intake",
      reason: "Voice: low fluids",
    });
  }

  if (text.includes("pain")) {
    tasks.push({
      title: "Assess pain level",
      reason: "Voice: pain mentioned",
    });
  }

  return tasks;
};

// ✅ FIRST
const getAutoTasksFromAlerts = () => {
  const tasks: { title: string; reason: string }[] = [];

  const allAlerts = [
    ...alerts,
    ...liveAlerts,
    ...getClinicalAlerts(),
  ];

  allAlerts.forEach((a) => {
    switch (a.type) {
      case "hydration_low":
        tasks.push({
          title: "Encourage fluid intake",
          reason: "Low hydration alert",
        });
        break;

      case "medication_refused":
        tasks.push({
          title: "Review medication compliance",
          reason: "Medication refused",
        });
        break;

      case "falls_event":
        tasks.push({
          title: "Implement falls prevention measures",
          reason: "Fall occurred",
        });
        break;

        case "hydration_risk":
  tasks.push({
    title: "Increase fluid monitoring and escalate if needed",
    reason: "Repeated dehydration",
  });
  break;

case "hydration_critical":
  tasks.push({
    title: "Urgent hydration intervention",
    reason: "Severe dehydration risk",
  });
  break;

case "falls_risk":
  tasks.push({
    title: "Implement strict falls prevention plan",
    reason: "Multiple falls",
  });
  break;

case "medication_risk":
  tasks.push({
    title: "Escalate medication non-compliance",
    reason: "Repeated refusal",
  });
  break;

      case "bowel_risk":
        tasks.push({
          title: "Monitor bowel movements",
          reason: "Bowel issue",
        });
        break;
    }
  });

  return tasks;
};

// ✅ THEN
const getAutoTasksFromObservations = () => {
  const autoTasks: { title: string; reason: string }[] = [];

  // 💧 HYDRATION
  if (data.hydration === "poor" || data.hydration === "refused") {
    autoTasks.push({
      title: "Encourage fluid intake",
      reason: "Low fluid intake",
    });
  }

  if (data.pain === "high") {
  autoTasks.push({
    title: "Manage pain and report if needed",
    reason: "Severe pain observed",
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
// 🔥 STRUCTURED TASK ANALYSIS (PROMPT-BASED)

data.tasks.forEach((task: any) => {
  if (!task || typeof task === "string") return;

  // 💧 HYDRATION (ml check)
  if (task.title?.toLowerCase().includes("fluid")) {
    const amount =
      task.responses?.["How much fluid was taken?"];

    if (amount) {
      const ml = parseInt(amount);

      if (!isNaN(ml) && ml < 500) {
        results.push({
          type: "hydration_low",
          severity: "high",
          message: "Low fluid intake (<500ml)",
          source: "clinical",
        });
      }
    }
  }

  // 🍽️ NUTRITION (% check)
  if (task.title?.toLowerCase().includes("meal")) {
    const eaten =
      task.responses?.["How much was eaten?"];

    if (eaten && eaten.includes("%")) {
      const percent = parseInt(eaten);

      if (!isNaN(percent) && percent < 50) {
        results.push({
          type: "nutrition_risk",
          severity: "medium",
          message: "Poor food intake (<50%)",
          source: "clinical",
        });
      }
    }
  }
});

  return results;
};

const getTrendAlerts = () => {
  const results: any[] = [];

  const now = new Date().getTime();

  const HOURS_24 = 24 * 60 * 60 * 1000;
  const HOURS_48 = 48 * 60 * 60 * 1000;

  const all = [
    ...alerts,
    ...liveAlerts,
    ...getClinicalAlerts(),
  ];

  const within = (type: string, window: number) =>
    all.filter((a: any) => {
      if (!a.created_at) return false;

      const t = new Date(a.created_at).getTime();
      return a.type === type && now - t <= window;
    }).length;

  // 💧 HYDRATION
  if (within("hydration_low", HOURS_24) >= 2) {
    results.push({
      type: "hydration_risk",
      severity: "high",
      message: "Repeated low hydration (24h)",
      source: "trend",
    });
  }

  if (within("hydration_low", HOURS_48) >= 3) {
    results.push({
      type: "hydration_critical",
      severity: "critical",
      message: "Persistent dehydration (48h)",
      source: "trend",
    });
  }

  // 🚶 FALLS
  if (within("falls_event", HOURS_48) >= 2) {
    results.push({
      type: "falls_risk",
      severity: "high",
      message: "Multiple falls in 48h",
      source: "trend",
    });
  }

  // 💊 MEDICATION
  if (within("medication_refused", HOURS_24) >= 2) {
    results.push({
      type: "medication_risk",
      severity: "high",
      message: "Repeated refusal (24h)",
      source: "trend",
    });
  }

// 🔥 ADDITIONAL CLINICAL RULES

if (data.mood === "low" || data.mood === "distressed") {
  results.push({
    type: "mood_concern",
    severity: "medium",
    message: "Low or distressed mood",
    source: "clinical",
  });
}

if (data.medication === "missed") {
  results.push({
    type: "medication_missed",
    severity: "medium",
    message: "Medication missed",
    source: "clinical",
  });
}

if (data.pain === "moderate" || data.pain === "high") {
  results.push({
    type: "pain_alert",
    severity: "high",
    message: "Pain reported",
    source: "clinical",
  });
}

if (data.breathing !== "normal") {
  results.push({
    type: "breathing_concern",
    severity: "high",
    message: "Breathing issue",
    source: "clinical",
  });
}

if (data.skin === "redness") {
  results.push({
    type: "skin_risk",
    severity: "medium",
    message: "Skin redness",
    source: "clinical",
  });
}

if (data.skin?.includes("category")) {
  results.push({
    type: "pressure_ulcer",
    severity: "high",
    message: "Pressure damage risk",
    source: "clinical",
  });
}
  return results;
};

const getResolvedAlertTypes = () => {
  const resolved: string[] = [];

  // 💧 HYDRATION
  if (data.hydration === "adequate") {
    resolved.push(
      "hydration_low",
      "hydration_risk",
      "hydration_critical"
    );
  }

  // 💊 MEDICATION
  if (data.medication === "taken") {
    resolved.push(
      "medication_refused",
      "medication_risk",
      "medication_missed"
    );
  }

  // 🚶 FALLS
  if (data.mobility !== "fall") {
    resolved.push(
      "falls_event",
      "falls_risk"
    );
  }

  // 🚽 BOWEL
  if (data.toileting === "normal") {
    resolved.push("bowel_risk");
  }

  // 🙂 MOOD
  if (data.mood === "positive" || data.mood === "neutral") {
    resolved.push("mood_concern");
  }

  // 😖 PAIN
  if (data.pain === "none" || data.pain === "mild") {
    resolved.push("pain_alert");
  }

  // 🫁 BREATHING
  if (data.breathing === "normal") {
    resolved.push("breathing_concern");
  }

  // 🧴 SKIN
  if (data.skin === "intact") {
    resolved.push(
      "skin_risk",
      "pressure_ulcer"
    );
  }

  return resolved;
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
Tasks completed: ${
  data.tasks.map((t) => t.title).join(", ") || "none"
}
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

// 🔴 CHECK REQUIRED TASKS BEFORE FINISH
const finishVisitCore = async () => {
const {
  data: { user },
} = await supabase.auth.getUser();

const userId = user?.id;
  if (!userId) {
  alert("User not logged in");
  return;
}

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

const resolvedTypes = getResolvedAlertTypes();

if (resolvedTypes.length > 0) {
  await supabase
    .from("alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .in("type", resolvedTypes)
    .eq("client_id", id)
    .eq("status", "active")
  .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
}

const trendAlerts = getTrendAlerts();

if (trendAlerts.length > 0) {
  await supabase.from("alerts").insert(
    trendAlerts.map((a) => ({
      client_id: id,
      type: a.type,
      severity: a.severity,
      message: a.message,
      source: "trend",
      status: "active",
      created_at: new Date().toISOString(),
    }))
  );
}

  await fetch("/api/update-careplan-from-visit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  client_id: id,
  observations: data,
  structured_tasks: data.tasks,
})
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
hasSavedVisit.current = true;

  const requiredTasks = getTasks().filter(
    (t: any) => t.source === "assessment_required" ||
t.source === "care_plan_required"
  );

  const completedTasks = data.tasks || [];

  const missedRequired = requiredTasks.filter(
    (t: any) =>
      !completedTasks.some(
  (ct: any) =>
    ct.title?.toLowerCase() === t.title.toLowerCase()
)
  );

  if (missedRequired.length > 0) {
    setMissedTasks(missedRequired);
    setShowOverride(true);
    return;
  }

  if (data.safeguarding === "concern") {
  await supabase.from("concern_records").insert({
    client_id: id,
    description: "Safeguarding concern raised during visit",
    priority: "high",
    status: "open",
  });
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
  ...getTrendAlerts(),
].filter(
  (a, index, self) =>
    index ===
    self.findIndex(
      (x) =>
        x.type === a.type &&
        x.message === a.message
    )
);

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
  .eq("status", "active")
  .gte(
    "created_at",
    new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  );

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
  <div key={i}  className="bg-red-600 px-2 py-1 rounded mb-1 flex items-center justify-between text-sm">

    <span className="truncate">{a.message}</span>

    {a.id && a.source !== "clinical" && (
      <button
        onClick={() => resolveAlert(a.id)}
        className="text-[10px] bg-black px-2 py-0.5 rounded"
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
          <div className="mb-6">
  <h2 className="text-lg font-semibold mb-2">
    🎤 Quick Voice Start (Optional)
  </h2>

  <button
    onClick={startVoice}
    className={`w-full p-3 text-base rounded ${
      recording ? "bg-red-600" : "bg-purple-600"
    }`}
  >
    {recording ? "Recording..." : "Start Voice Note"}
  </button>

  {transcript && (
    <div className="bg-[var(--card)] p-3 mt-2 rounded text-sm">
      {transcript}
    </div>
  )}
</div>
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

    <div className="space-y-4 mb-6">
      {Object.entries(getGroupedTasks() || {}).map(([section, tasks]: any) => (
        <div key={section}>
          <p className="text-sm text-purple-400 mb-2">{section}</p>

          {tasks.map((task: any) => {
            const selected = data.tasks.some(
              (t) => t.title === task.title
            );
            const auto = autoAddedTasks.some(
              (a) => a.title === task.title
            );

            return (
              <div key={task.title} className="mb-2">
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

                      {task.priority === "high" && (
                        <span className="text-red-400 text-xs">HIGH</span>
                      )}
                      {task.priority === "medium" && (
                        <span className="text-yellow-400 text-xs">MED</span>
                      )}
                    </p>

                    {auto && (
                      <p className="text-xs text-yellow-400 mt-1">
                        ⚠{" "}
                        {
                          autoAddedTasks.find(
                            (a) => a.title === task.title
                          )?.reason
                        }
                      </p>
                    )}
                  </div>
                </button>

                {/* ✅ PROMPTS (NOW IN RIGHT PLACE) */}
                {selected && task.prompts?.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {task.prompts.map((q: string, i: number) => {
                      const existing =
                        data.tasks.find(
                          (t: any) => t.title === task.title
                        )?.responses?.[q] || "";

                      return (
                        <textarea
                          key={i}
                          placeholder={q}
                          value={existing}
                          onChange={(e) => {
                            setData((prev: any) => ({
                              ...prev,
                              tasks: prev.tasks.map((t: any) => {
                                if (t.title !== task.title) return t;

                                return {
                                  ...t,
                                  responses: {
                                    ...(t.responses || {}),
                                    [q]: e.target.value,
                                  },
                                };
                              }),
                            }));
                          }}
                          className="w-full p-2 rounded bg-[var(--card)] text-sm"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>

    {/* ✅ NEXT BUTTON MOVED OUTSIDE MAP */}
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

    {data.medication === "refused" && (
  <>
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
  </>
)}
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
          {data.tasks.map((task: any, i: number) => (
  <li key={i}>{task.title}</li>
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