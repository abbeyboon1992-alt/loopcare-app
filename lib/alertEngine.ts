import { supabase } from "@/lib/supabase";
import { careTypes } from "@/lib/careTypes";

type AlertItem = {
  message: string;
  severity: string;
  type: string;

  // ✅ scoring + metadata
  score?: number;
  source?: string;
  triggered_by?: string;

  // ✅ NEW (this is what your errors are about)
  action?: string;
  section_title?: string;
};

const ALERT_SECTION_MAP: Record<string, string> = {
  hydration: "Nutrition & Hydration",
  hydration_low: "Nutrition & Hydration",
  hydration_critical: "Nutrition & Hydration",
  hydration_improving: "Nutrition & Hydration",
skin_improving: "Personal Care (ADLs)",
cognition_improving: "Cognitive Wellbeing",
mobility_improving: "Mobility & Moving",

  nutrition: "Nutrition & Hydration",
  bowel_risk: "Nutrition & Hydration",

  mobility: "Mobility & Moving",
  falls: "Mobility & Moving",
  fracture: "Mobility & Moving",

  medication: "Medication Support",
  medication_refused: "Medication Support",

  skin: "Personal Care (ADLs)",
  skin_pressure: "Personal Care (ADLs)",

  mood: "Emotional Wellbeing",
  mental_health: "Emotional Wellbeing",
  behaviour: "Emotional Wellbeing",
  impulsivity: "Emotional Wellbeing",

  cognition: "Cognitive Wellbeing",
  confusion: "Cognitive Wellbeing",
  wandering: "Cognitive Wellbeing",
  memory_loss: "Cognitive Wellbeing",

  communication: "Communication Needs",

  sensory: "Environment",

  swallowing: "Nutrition & Hydration",
  blood_sugar: "Nutrition & Hydration",

  respiratory: "Medical Conditions & Overview",
  seizure: "Medical Conditions & Overview",
  pain: "Medical Conditions & Overview",
  fluid_retention: "Medical Conditions & Overview",
  fluid_balance: "Medical Conditions & Overview",
  blood_pressure: "Medical Conditions & Overview",
  withdrawal: "Medical Conditions & Overview",

  safeguarding: "Risks & Safety",
  welfare_check: "Risks & Safety",

  dnacpr: "Personal Details & Emergency Contacts",
  allergies: "Personal Details & Emergency Contacts",

  comfort: "End-of-Life Wishes",

  default: "Risks & Safety",
  falls_risk: "Mobility & Moving",
falls_event: "Mobility & Moving",

hydration_risk: "Nutrition & Hydration",

cognitive_decline: "Cognitive Wellbeing",
};

const RESOLVE_RULES: Record<string, string[]> = {
  hydration_good: ["hydration_low", "hydration_critical"],
  nutrition_good: ["nutrition"],
  medication_taken: ["medication", "medication_refused"],
  mobility_stable: ["mobility", "mobility_decline", "falls_risk"],
  no_falls: ["falls_event"],
  cognition_stable: ["confusion", "cognitive_decline"],
  mood_stable: ["mood", "mental_health", "behaviour"],
  pain_controlled: ["pain"],
  breathing_normal: ["respiratory"],
  skin_healed: ["skin_pressure"],
  no_safeguarding: ["safeguarding"],
};

// 🧠 DIAGNOSIS ALERTS
const diagnosisAlertMap: Record<string, any[]> = {
  dementia: [
    {
      type: "wandering",
      severity: "high",
      message: "Risk of wandering due to cognitive impairment",
      action: "Ensure doors are secure, monitor location regularly, use reassurance and redirection techniques",
      escalate: "If client leaves property or cannot be located",
      who_to_inform: "Family / Manager",
    },
    {
      type: "confusion",
      severity: "medium",
      message: "Monitor confusion and disorientation",
      action: "Reorient using time/place prompts, speak calmly, avoid confrontation",
      escalate: "If confusion suddenly worsens",
      who_to_inform: "GP",
    },
    {
      type: "nutrition",
      severity: "medium",
      message: "Risk of poor nutrition due to memory issues",
      action: "Prompt meals, offer finger foods, monitor intake",
      escalate: "If food intake drops significantly",
      who_to_inform: "Family / GP",
    },
  ],

  alzheimers: [
    {
      type: "memory_loss",
      severity: "high",
      message: "Severe memory impairment — requires supervision",
      action: "Provide supervision, repeat instructions, maintain routine",
      escalate: "If safety risks increase",
      who_to_inform: "Manager",
    },
    {
      type: "wandering",
      severity: "high",
      message: "High risk of wandering",
      action: "Supervise closely, use safety measures (alarms if in place)",
      escalate: "If missing or unsafe",
      who_to_inform: "Family / Emergency services",
    },
  ],

  autism: [
    {
      type: "sensory",
      severity: "medium",
      message: "Sensory sensitivities — monitor environment triggers",
      action: "Reduce noise/light, avoid sudden changes, follow known preferences",
      escalate: "If distress escalates",
      who_to_inform: "Family",
    },
    {
      type: "communication",
      severity: "medium",
      message: "Communication support may be required",
      action: "Use clear, simple language or visual aids",
      escalate: "If unable to communicate needs",
      who_to_inform: "Manager",
    },
  ],

  adhd: [
    {
      type: "attention",
      severity: "low",
      message: "Difficulty maintaining focus",
      action: "Break tasks into small steps, give reminders",
      escalate: "If impacting safety",
      who_to_inform: "Manager",
    },
    {
      type: "impulsivity",
      severity: "medium",
      message: "Impulsive behaviour may impact safety",
      action: "Supervise during tasks, remove hazards",
      escalate: "If unsafe behaviours occur",
      who_to_inform: "Manager",
    },
  ],

  learningdisability: [
    {
      type: "capacity",
      severity: "medium",
      message: "Assess capacity for decision making",
      action: "Support decision-making, use MCA principles",
      escalate: "If decision is complex or unclear",
      who_to_inform: "Manager",
    },
    {
      type: "communication",
      severity: "medium",
      message: "Adapt communication methods",
      action: "Use easy-read, gestures, or familiar language",
      escalate: "If communication breaks down",
      who_to_inform: "Manager",
    },
  ],

  parkinsons: [
    {
      type: "mobility",
      severity: "high",
      message: "High falls risk due to Parkinson’s",
      action: "Assist with mobility, ensure aids are used, clear hazards",
      escalate: "If fall occurs",
      who_to_inform: "Manager / GP",
    },
    {
      type: "swallowing",
      severity: "medium",
      message: "Monitor swallowing difficulties",
      action: "Follow SALT guidance, ensure upright positioning",
      escalate: "If choking or coughing during meals",
      who_to_inform: "GP",
    },
  ],

  stroke: [
    {
      type: "mobility",
      severity: "high",
      message: "Reduced mobility following stroke",
      action: "Use hoists/aids correctly, support transfers safely",
      escalate: "If mobility declines",
      who_to_inform: "Physio / GP",
    },
    {
      type: "swallowing",
      severity: "high",
      message: "Risk of aspiration — monitor swallowing",
      action: "Follow SALT plan, monitor for coughing",
      escalate: "If aspiration suspected",
      who_to_inform: "GP urgently",
    },
  ],

  mentalhealth: [
    {
      type: "low_mood",
      severity: "medium",
      message: "Monitor mood and wellbeing",
      action: "Engage in conversation, encourage activities",
      escalate: "If withdrawal or mood worsens",
      who_to_inform: "GP",
    },
    {
      type: "risk",
      severity: "high",
      message: "Assess risk of self-harm or deterioration",
      action: "Stay with client if concerned, ensure safety",
      escalate: "Immediate risk present",
      who_to_inform: "Emergency services",
    },
  ],

  epilepsy: [
    {
      type: "seizure",
      severity: "high",
      message: "Risk of seizures — ensure safety plan",
      action: "Follow seizure protocol, keep client safe during episode",
      escalate: "Seizure lasts >5 minutes",
      who_to_inform: "Emergency services",
    },
  ],

  diabetes: [
    {
      type: "blood_sugar",
      severity: "high",
      message: "Monitor blood glucose levels",
      action: "Check blood sugar as required, ensure meals taken",
      escalate: "If hypo/hyper symptoms",
      who_to_inform: "GP",
    },
  ],

  endoflife: [
    {
      type: "comfort",
      severity: "high",
      message: "Prioritise comfort and symptom control",
      action: "Provide comfort care, reposition regularly, manage pain",
      escalate: "If pain uncontrolled",
      who_to_inform: "District Nurse",
    },
  ],

  frailty: [
    {
      type: "falls",
      severity: "high",
      message: "High falls risk due to frailty",
      action: "Supervise walking, ensure safe environment",
      escalate: "If fall occurs",
      who_to_inform: "Manager",
    },
  ],

  delirium: [
    {
      type: "confusion",
      severity: "high",
      message: "Acute confusion — requires urgent review",
      action: "Monitor closely, check for triggers (UTI, dehydration)",
      escalate: "Sudden onset confusion",
      who_to_inform: "GP urgently",
    },
  ],

  copd: [
    {
      type: "respiratory",
      severity: "high",
      message: "Monitor breathing and oxygen levels",
      action: "Observe breathing, use oxygen as prescribed",
      escalate: "Breathing worsens",
      who_to_inform: "GP / 111",
    },
  ],

  heartfailure: [
    {
      type: "fluid_retention",
      severity: "high",
      message: "Monitor for fluid overload",
      action: "Check swelling, monitor weight if required",
      escalate: "Rapid weight gain or breathlessness",
      who_to_inform: "GP",
    },
  ],

  cancer: [
    {
      type: "pain",
      severity: "high",
      message: "Monitor and manage pain",
      action: "Administer medication as prescribed, record pain levels",
      escalate: "Pain uncontrolled",
      who_to_inform: "GP / Palliative team",
    },
  ],

  chronickidneydisease: [
    {
      type: "fluid_balance",
      severity: "high",
      message: "Monitor fluid balance carefully",
      action: "Track intake/output if required",
      escalate: "Fluid imbalance suspected",
      who_to_inform: "GP",
    },
  ],

  hypertension: [
    {
      type: "blood_pressure",
      severity: "medium",
      message: "Monitor blood pressure regularly",
      action: "Check BP if part of care plan",
      escalate: "High readings persist",
      who_to_inform: "GP",
    },
  ],

  osteoporosis: [
    {
      type: "fracture",
      severity: "high",
      message: "High fracture risk",
      action: "Prevent falls, assist mobility",
      escalate: "If injury occurs",
      who_to_inform: "GP",
    },
  ],

  chronicpain: [
    {
      type: "pain",
      severity: "high",
      message: "Ongoing pain requires management",
      action: "Monitor pain levels, administer medication",
      escalate: "Pain worsens",
      who_to_inform: "GP",
    },
  ],

  substanceusedisorder: [
    {
      type: "withdrawal",
      severity: "high",
      message: "Risk of withdrawal symptoms",
      action: "Monitor symptoms, follow care plan",
      escalate: "Severe withdrawal symptoms",
      who_to_inform: "GP / Emergency",
    },
  ],

  other: [
    {
      type: "general",
      severity: "low",
      message: "Monitor general wellbeing",
      action: "Observe and report any changes",
      escalate: "Any concerns arise",
      who_to_inform: "Manager",
    },
  ],
};

export function generateDiagnosisAlerts(client: any) {
  const alerts: AlertItem[] = [];

  if (!client?.diagnosis) return alerts;

  const diagnosisList = Array.isArray(client.diagnosis)
    ? client.diagnosis
    : [client.diagnosis];

  diagnosisList.forEach((diag: string) => {
    if (!diag) return;

    const clean = diag.toLowerCase().replace(/[^a-z]/g, "");

    const match = Object.keys(diagnosisAlertMap).find((key) =>
      clean.includes(key)
    );

    if (!match) return;

    diagnosisAlertMap[match].forEach((alert: any) => {
      const type = alert.type;

alerts.push({
  ...alert,
  type,
  source: "diagnosis",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
    });
  });
  return alerts;
}
const buildAlert = (
  type: string,
  {
    message,
    severity = "medium",
    action,
    source = "visit",
    triggered_by,
  }: {
    message: string;
    severity?: string;
    action?: string;
    source?: string;
    triggered_by?: string;
  }
): AlertItem => {
  return {
    type,
    message,
    severity,
    action,
    source,
    triggered_by,
    section_title:
      ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  };
};
export function generateVisitAlerts({
  client,
  visitData,
 assessments,
}: any) {

  const addAlert = (alert: AlertItem) => {
  const exists = alerts.some(
    (a: any) =>
      a.type === alert.type &&
      a.source === alert.source // 🔥 prevents duplicates across engines
  );

  if (!exists) alerts.push(alert);
};
  const alerts: AlertItem[] = [];
  // 🔗 ASSESSMENT → VISIT ENFORCEMENT

if (assessments) {
  // 🔴 WEIGHT LOSS RISK
  if (assessments.recent_weight_loss === "yes") {
    addAlert({
      type: "weight_monitoring_required",
      severity: "high",
      message: "Recent weight loss — MUST monitor weight",
      action: "Record weight and monitor nutrition closely",
      source: "assessment",
      section_title: "Nutrition & Hydration",
    });
  }

  // 🔴 HIGH FALLS RISK
  if (assessments.mobility === "high risk") {
    addAlert({
      type: "mobility_monitoring_required",
      severity: "high",
      message: "High falls risk — mobility must be observed",
      action: "Observe mobility and prevent falls",
      source: "assessment",
      section_title: "Mobility & Moving",
    });
  }

  // 🔴 SKIN RISK
  if (assessments.skin_integrity === "at risk") {
    addAlert({
      type: "skin_monitoring_required",
      severity: "high",
      message: "Skin at risk — must check pressure areas",
      action: "Check skin condition and reposition",
      source: "assessment",
      section_title: "Personal Care (ADLs)",
    });
  }

  // 🔴 FLUID RISK
  if (assessments.hydration === "poor") {
    addAlert({
      type: "hydration_monitoring_required",
      severity: "high",
      message: "Hydration risk — monitor intake",
      action: "Encourage fluids and record intake",
      source: "assessment",
      section_title: "Nutrition & Hydration",
    });
  }
}
// 🔥 NORMALISE VALUES (MATCH UI → ENGINE)
const hydration = visitData.hydration === "adequate"
  ? "good"
  : visitData.hydration === "reduced"
  ? "poor"
  : visitData.hydration;

const nutrition = visitData.nutrition === "adequate"
  ? "good"
  : visitData.nutrition === "reduced"
  ? "poor"
  : visitData.nutrition;

const mood = visitData.mood === "positive"
  ? "good"
  : visitData.mood === "neutral"
  ? "stable"
  : visitData.mood;

const cognition = visitData.cognition === "baseline"
  ? "clear"
  : visitData.cognition;

const mobility = visitData.mobility === "independent"
  ? "stable"
  : visitData.mobility === "needs assistance"
  ? "stable"
  : visitData.mobility;


  const config =
    careTypes[client.care_type as keyof typeof careTypes];

  if (!config || !config.alerts) return [];

  const alertConfig = config.alerts as any; // ✅ FIX TYPE ERROR

  // 🔥 RULES

  if (
  (visitData.hydration === "poor" || visitData.hydration === "refused") &&
  alertConfig.hydration_low
) {
    const type = "hydration_low";


addAlert(
  buildAlert("hydration_low", {
    message: "Low fluid intake",
    severity: "high",
    action: "Encourage fluids and record intake",
    triggered_by: "hydration_poor",
  })
);
  }
  if (hydration === "good") {
  addAlert({
    type: "hydration_good",
    severity: "low",
    message: "Hydration adequate",
    source: "visit",
    section_title:
      ALERT_SECTION_MAP["hydration"] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.safeguarding === "concern") {
  const type = "safeguarding";

  addAlert({
    message: "Safeguarding concern raised",
    severity: "critical",
    type,
    action: "Report immediately and follow safeguarding procedure",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });

  addAlert({
    message: "Safeguarding concern",
    severity: "critical",
    type,
    source: "assessments",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}
if (nutrition === "good") {
  addAlert({
    type: "nutrition_good",
    severity: "low",
    message: "Nutrition adequate",
    source: "visit",
    section_title: ALERT_SECTION_MAP["nutrition"],
  });
}
if (visitData.medication === "taken") {
  addAlert({
    type: "medication_taken",
    severity: "low",
    message: "Medication taken",
    source: "visit",
    section_title: ALERT_SECTION_MAP["medication"],
  });
}
if (mobility === "stable") {
  addAlert({
    type: "mobility_stable",
    severity: "low",
    message: "Mobility stable",
    source: "visit",
    section_title: ALERT_SECTION_MAP["mobility"],
  });
}
if (visitData.fall === false) {
  addAlert({
    type: "no_falls",
    severity: "low",
    message: "No falls reported",
    source: "visit",
    section_title: ALERT_SECTION_MAP["falls"],
  });
}
if (cognition === "clear") {
  addAlert({
    type: "cognition_stable",
    severity: "low",
    message: "Cognition stable",
    source: "visit",
    section_title: ALERT_SECTION_MAP["cognition"],
  });
}
if (mood === "good") {
  addAlert({
    type: "mood_stable",
    severity: "low",
    message: "Mood stable",
    source: "visit",
    section_title: ALERT_SECTION_MAP["mood"],
  });
}
if (visitData.pain === "none") {
  addAlert({
    type: "pain_controlled",
    severity: "low",
    message: "Pain controlled",
    source: "visit",
    section_title: ALERT_SECTION_MAP["pain"],
  });
}
if (visitData.breathing === "normal") {
  addAlert({
    type: "breathing_normal",
    severity: "low",
    message: "Breathing normal",
    source: "visit",
    section_title: ALERT_SECTION_MAP["respiratory"],
  });
}
if (visitData.safeguarding === "none") {
  addAlert({
    type: "no_safeguarding",
    severity: "low",
    message: "No safeguarding concerns",
    source: "visit",
    section_title: ALERT_SECTION_MAP["safeguarding"],
  });
}

if (visitData.pain === "high") {
  const type = "pain";

  addAlert({
    message: "High pain level reported",
    severity: "high",
    type,
    action: "Administer medication and monitor closely",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.behaviour === "agitated") {
  const type = "behaviour";

  addAlert({
    message: "Agitated behaviour observed",
    severity: "high",
    type,
    action: "Use de-escalation techniques and monitor",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.breathing === "laboured") {
  const type = "respiratory";

  addAlert({
    message: "Laboured breathing observed",
    severity: "high",
    type,
    action: "Monitor closely and escalate if worsening",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.fall === true) {
  const type = "falls_event"

  addAlert({
    message: "Fall occurred",
    severity: "critical",
    type,
    action: "Check for injury and escalate immediately",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.no_response === true) {
  const type = "welfare_check";

  addAlert({
    message: "No response from client",
    severity: "critical",
    type,
    action: "Follow welfare check protocol immediately",
    source: "visit",
    section_title: ALERT_SECTION_MAP.default,
  });
}

  if (visitData.nutrition === "poor" || visitData.nutrition === "refused") {
  const type = "nutrition";

  addAlert({
    message: "Low food intake observed",
    severity: "high",
    type,
    action: "Encourage meals and monitor intake",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.hydration === "none") {
  const type = "hydration_critical";

  addAlert({
    message: "No fluid intake recorded",
    severity: "critical",
    type,
    action: "Escalate if continues, encourage fluids urgently",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.medication === "missed") {
  const type = "medication";

  addAlert({
    message: "Medication missed",
    severity: "high",
    type,
    action: "Record reason and inform if repeated",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.cognition === "confused") {
  const type = "confusion";

  addAlert({
    message: "Increased confusion observed",
    severity: "high",
    type,
    action: "Monitor closely and report changes",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (visitData.mobility === "decline") {
  const type = "mobility_decline";

  addAlert({
    message: "Mobility decline observed",
    severity: "high",
    type,
    action: "Review mobility plan and assist safely",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

  if (client.dnacpr) {
  const type = "dnacpr";
addAlert({
  type,
  severity: "high",
  message: "DNACPR in place",
  action: "Ensure all staff aware before care",
  source: "visit",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
}

if (client.allergies) {
  const type = "allergies";
  addAlert({
    type,
    severity: "high",
    message: `Allergy: ${client.allergies}`,
    action: "Avoid allergen exposure",
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

  if (
    visitData.medication === "refused" &&
    alertConfig.medication_refused
  ) {
    const type = "medication_refused";

addAlert({
  ...alertConfig.medication_refused,
  type,
  source: "visit",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
  }

  if (visitData.mood === "low" && alertConfig.mood_low) {
    const type = "mood";

addAlert({
  ...alertConfig.mood_low,
  type,
  source: "visit",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
  }

  // 🚶 MOBILITY
if (visitData.mobility === "fall") {
  const type = "falls_risk";

addAlert({
  message: "Fall risk detected",
  severity: "high",
  type,
  source: "visit",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
}

// 🚽 TOILETING
if (visitData.toileting === "diarrhoea") {
  const type = "bowel_risk";
  addAlert({
    message: "Diarrhoea — monitor hydration",
    severity: "medium",
    type,
    source: "visit",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

// 🧴 SKIN (CLINICALLY ACCURATE)
if (visitData.skin) {
  const skin = visitData.skin.toLowerCase();

  // 🔴 CATEGORY 4 (CRITICAL)
  if (skin.includes("category 4")) {
    const type = "skin_pressure";
    addAlert({
      message: "Category 4 pressure ulcer — urgent care required",
      severity: "critical",
      type: "skin_pressure",
      source: "visit",
      section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
    });
  }

  // 🔴 CATEGORY 3
  else if (skin.includes("category 3")) {
    const type = "skin_pressure";
    addAlert({
      message: "Category 3 pressure ulcer",
      severity: "high",
      type: "skin_pressure",
      source: "visit",
      section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
    });
  }

  // 🟠 CATEGORY 2
  else if (skin.includes("category 2")) {
    const type = "skin_pressure";
    addAlert({
      message: "Category 2 pressure damage",
      severity: "medium",
      type: "skin_pressure",
      source: "visit",
      section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
    });
  }

  // 🟡 CATEGORY 1
  else if (skin.includes("category 1")) {
    const type = "skin_pressure";
    addAlert({
      message: "Early pressure damage (Category 1)",
      severity: "medium",
      type: "skin_pressure",
      source: "visit",
      section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
    });
  }

  // ⚠️ GENERAL BREAKDOWN
  else if (skin === "breakdown") {
    const type = "skin_pressure";
    addAlert({
      message: "Skin breakdown detected",
      severity: "high",
      type: "skin_pressure",
      source: "visit",
      section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
    });
  }
  else if (skin === "intact") {
  const type = "skin_healed";

  addAlert({
    message: "Skin intact",
    severity: "low",
    type,
    source: "visit",
    section_title:
      ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}
}

  console.log("GENERATED ALERTS:", alerts);
// 🔥 ADD DIAGNOSIS-BASED ALERTS INTO VISITS
const diagnosisAlerts = generateDiagnosisAlerts(client);

diagnosisAlerts.forEach((a: any) => {
  if (!alerts.some((x) => x.type === a.type)) {
    alerts.push(a);
  }
});

return alerts;
}

// 🔥 SCORING SYSTEM
export function scoreAlerts(alerts: any[]) {
  return alerts.map((a: any) => {
    let score = 1;

    if (a.severity === "high") score = 3;
    if (a.severity === "medium") score = 2;

    return { ...a, score };
  });
}

const EVENT_TYPES = [
  "falls_event",
  "safeguarding",
  "welfare_check",
];
// 💾 SAVE ALERTS
export async function saveAlerts({
  alerts,
  clientId,
  organisation_id,
  visit_id,
}: {
  alerts: AlertItem[];
  clientId: string;
  organisation_id?: string;
  visit_id?: string | null;
}) {
  if (!alerts?.length) return;

  // ✅ ADD THIS LINE
  const improvements = await generateImprovementAlerts({ clientId });

  // 🔄 AUTO RESOLVE
  for (const [trigger, targets] of Object.entries(RESOLVE_RULES)) {
    const triggered = alerts.some((a) => a.type === trigger);

    if (!triggered) continue;

    await supabase
      .from("alerts")
      .update({
        status: "resolved",
        resolved_at: new Date(),
      })
      .eq("client_id", clientId)
      .in("type", targets)
      .eq("status", "active");
  }

  // 💾 SAVE ALERTS LOOP
  for (const alert of alerts) {
    if (Object.keys(RESOLVE_RULES).includes(alert.type)) continue;

    const section =
      alert.section_title ||
      ALERT_SECTION_MAP[alert.type] ||
      ALERT_SECTION_MAP.default;

    const isEvent = EVENT_TYPES.includes(alert.type);

    let error = null;

    if (isEvent) {
      const res = await supabase.from("alerts").insert({
        client_id: clientId,
        organisation_id: organisation_id || null,
        visit_id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        action: alert.action,
        status: "active",
        source: alert.source || "system",
        section_title: section,
      });

      error = res.error;
    } else {
      const res = await supabase.from("alerts").upsert(
        {
          client_id: clientId,
          organisation_id: organisation_id || null,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          action: alert.action,
          status: "active",
          source: alert.source || "system",
          section_title: section,
        },
        {
          onConflict: "client_id,type,source",
        }
      );

      error = res.error;
    }

    if (error) {
      console.log("❌ ALERT ERROR:", error);
      continue;
    }

    console.log("✅ ALERT SAVED:", alert.type);
  }

  // ✅ NOW THIS WORKS
  if (improvements.length) {
    await supabase.from("alerts").upsert(
      improvements.map((a: any) => ({
        client_id: clientId,
        organisation_id: organisation_id || null,
        type: a.type,
        severity: a.severity,
        message: a.message,
        action: a.action,
        status: "active",
        source: "improvement",
        section_title: a.section_title,
      })),
      { onConflict: "client_id,type" }
    );
  }
}

export async function escalateAlerts({
  clientId,
}: {
  clientId: string;
}) {
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (!alerts) return;

  const grouped: Record<string, any[]> = {};

  alerts.forEach((a: any) => {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  });

  for (const type in grouped) {
    const items = grouped[type];

    // 🔥 3 STRIKE RULE
    const oldest = items.sort(
  (a, b) =>
    new Date(a.created_at).getTime() -
    new Date(b.created_at).getTime()
)[0];

const hours =
  (Date.now() - new Date(oldest.created_at).getTime()) /
  (1000 * 60 * 60);

if (hours >= 24 && !type.includes("_escalated")) {
      console.log("⚠️ ESCALATING:", type);

      await supabase.from("alerts").update({
        severity: "critical",
        status: "escalated",
        escalated_at: new Date(),
      })
      .eq("client_id", clientId)
      .eq("type", type)
      .eq("status", "active");

      // 🔥 CREATE ESCALATION ALERT
      if (type.includes("_escalated")) continue;
      const { data: existingEscalation } = await supabase
  .from("alerts")
  .select("id")
  .eq("client_id", clientId)
  .eq("type", `${type}_escalated`)
  .maybeSingle();

if (!existingEscalation) {
  await supabase.from("alerts").insert({
    client_id: clientId,
    type: `${type}_escalated`,
    severity: "critical",
    message: `${type} has occurred multiple times — escalation required`,
    action: "Review care plan and escalate to GP/manager",
    status: "active",
    source: "system",
  });
}

      console.log("🚨 ESCALATION CREATED:", type);
    }
  }
}

export async function generatePredictiveAlerts({
  clientId,
}: {
  clientId: string;
}) {
  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!recentAlerts) return [];

  const counts: Record<string, number> = {};

  recentAlerts.forEach((a: any) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });

  const predictive: AlertItem[] = [];

  if ((counts["hydration_low"] || 0) >= 2) {
    predictive.push({
      type: "hydration_risk",
      severity: "medium",
      message: "Pattern of low hydration emerging",
      action: "Increase monitoring and encourage fluids",
      source: "predictive",
      section_title: "Nutrition & Hydration",
    });
  }

  if ((counts["falls_event"] || 0) >= 2) {
    predictive.push({
      type: "falls_risk",
      severity: "high",
      message: "Increasing falls risk trend",
      action: "Review mobility plan urgently",
      source: "predictive",
      section_title: "Mobility & Moving",
    });
  }

  if ((counts["confusion"] || 0) >= 2) {
    predictive.push({
      type: "cognitive_decline",
      severity: "high",
      message: "Increasing confusion pattern detected",
      action: "Review cognitive status and escalate",
      source: "predictive",
      section_title: "Cognitive Wellbeing",
    });
  }

  return predictive;
}

export async function generateImprovementAlerts({
  clientId,
}: {
  clientId: string;
}) {
  const { data: recent } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recent) return [];

  const improvements: AlertItem[] = [];

  // 🔒 prevent duplicates
  const alreadyExists = (type: string) =>
    recent.some((a: any) => a.type === type && a.status === "active");

  // 🟢 HYDRATION
  const hydrationResolved = recent.filter(
    (a: any) =>
      a.type === "hydration_low" &&
      a.status === "resolved"
  );

  if (
    hydrationResolved.length >= 2 &&
    !alreadyExists("hydration_improving")
  ) {
    improvements.push({
      type: "hydration_improving",
      severity: "low",
      message: "Hydration improving over recent visits",
      action: "Continue encouraging fluid intake",
      source: "improvement",
      section_title: "Nutrition & Hydration",
    });
  }

  // 🟢 SKIN
  const skinResolved = recent.filter(
    (a: any) =>
      a.type === "skin_pressure" &&
      a.status === "resolved"
  );

  if (
    skinResolved.length >= 2 &&
    !alreadyExists("skin_improving")
  ) {
    improvements.push({
      type: "skin_improving",
      severity: "low",
      message: "Skin condition improving",
      action: "Continue pressure care and monitoring",
      source: "improvement",
      section_title: "Personal Care (ADLs)",
    });
  }

  // 🟢 COGNITION
  const recentConfusion = recent.filter(
    (a: any) => a.type === "confusion"
  );

  const hadConfusionBefore = recent.some(
    (a: any) =>
      a.type === "confusion" &&
      a.status === "resolved"
  );

  if (
    hadConfusionBefore &&
    recentConfusion.length === 0 &&
    !alreadyExists("cognition_improving")
  ) {
    improvements.push({
      type: "cognition_improving",
      severity: "low",
      message: "No recent confusion observed",
      action: "Maintain current support approach",
      source: "improvement",
      section_title: "Cognitive Wellbeing",
    });
  }

  return improvements;
}

    // ✅ TASK CREATION (SAFE)
    //const { data: existingTask } = await supabase
  //   .from("tasks")
   //   .select("id")
   //   .eq("client_id", clientId)
   //   .eq("title", alert.message)
   //   .maybeSingle();

    // 🔔 NOTIFICATION
   // await supabase.from("notifications").insert({
     // client_id: clientId,
      //title: alert.message,
     // type: "alert",
   // });

    // 🔗 CARE PLAN LINK (SAFE — NO DUPES)
    //const { data: existingCare } = await supabase
    //  .from("care_plan_section")
   //   .select("id")
    //  .eq("client_id", clientId)
    //  .eq(
    //    "title",
    //    alert.type === "mca_missing"
     //     ? "Mental Capacity"
     //     : alert.type === "best_interest_missing"
    //      ? "Decision Making"
     //     : ""
    //  )
    // .maybeSingle();

  //if (!existingCare) {
    // if (alert.type === "mca_missing") {
     //   await supabase.from("care_plan_section").insert({
     //     client_id: clientId,
      //    title: "Mental Capacity",
     //     care_need: "Client may lack capacity",
     //     outcome: "Capacity clearly assessed",
     //     actions: "Complete MCA assessments",
     //   });
    //  }

     // if (alert.type === "best_interest_missing") {
      //  await supabase.from("care_plan_section").insert({
      //    client_id: clientId,
     //     title: "Decision Making",
     //     care_need: "Best interest decision required",
    //      outcome: "Decisions made safely",
    //      actions: "Complete best interest decision",
    //    });
   //   }
 //   }
//  }
//}
// 🧠 AUTO FLAG GENERATION FROM ASSESSMENT
export function generateAutoFlags(assessments: any): string[] {
  const flags: string[] = [];

  if (!assessments) return flags;

  // 🔴 CLINICAL DETERIORATION (NEWS2 / vitals)
  if (assessments.news2_score >= 5) {
    flags.push("clinical_deterioration");
  }

  if (
    assessments.resp_rate > 25 ||
    assessments.oxygen_sats < 92 ||
    assessments.temperature > 38 ||
    assessments.pulse > 120
  ) {
    flags.push("clinical_deterioration");
  }

  // 🍽️ MALNUTRITION
  if (
    assessments.must_score >= 2 ||
    assessments.unplanned_weight_loss === "yes" ||
    assessments.nutrition === "poor"
  ) {
    flags.push("malnutrition_risk");
  }

  // 🚶 FALLS
  if (
    assessments.falls_risk === "high" ||
    assessments.mobility === "fall" ||
    (assessments.falls && assessments.falls > 0)
  ) {
    flags.push("falls_risk");
  }

  // 💊 MEDICATION
  if (
    assessments.medication_compliance_risk === "high" ||
    assessments.medication_ability === "unable"
  ) {
    flags.push("medication_risk");
  }

  // 🛡️ SAFEGUARDING
  if (
    assessments.safeguarding === "concern" ||
    assessments.safeguarding_flag === true
  ) {
    flags.push("safeguarding");
  }

  // 💧 HYDRATION (optional but useful)
  if (assessments.hydration === "poor") {
    flags.push("hydration_risk");
  }

  // 🧠 COGNITION DECLINE
  if (
    assessments.cognition === "declining" ||
    assessments.capacity === "fluctuating"
  ) {
    flags.push("cognitive_decline");
  }

  // 🧾 REVIEW REQUIRED
  if (assessments.requires_review === true) {
    flags.push("clinical_deterioration");
  }

  // 🔥 REMOVE DUPLICATES
  return [...new Set(flags)];
}
// 🧠 FLAG → ALERT ENGINE
export function generateFlagAlerts(flags: string[] = []): AlertItem[] {
  const alerts: AlertItem[] = [];

  flags.forEach((flag) => {
    switch (flag) {
      case "clinical_deterioration":
        alerts.push({
          type: "clinical",
          severity: "critical",
          message: "Clinical deterioration detected",
          source: "assessment",
          section_title: "Medical Conditions & Overview",
        });
        break;

      case "malnutrition_risk":
        alerts.push({
          type: "nutrition",
          severity: "high",
          message: "High malnutrition risk",
          source: "assessment",
          section_title: "Nutrition & Hydration",
        });
        break;

      case "falls_risk":
        alerts.push({
          type: "falls_risk",
          severity: "high",
          message: "High falls risk",
          source: "assessment",
          section_title: "Mobility & Moving",
        });
        break;

      case "safeguarding":
        alerts.push({
          type: "safeguarding",
          severity: "critical",
          message: "Safeguarding concern",
          source: "assessment",
          section_title: "Risks & Safety",
        });
        break;

      case "medication_risk":
        alerts.push({
          type: "medication",
          severity: "high",
          message: "Medication compliance risk",
          source: "assessment",
          section_title: "Medication Support",
        });
        break;
    }
  });

  return alerts;
}
// 🧠 NEW: GLOBAL assessments ALERTS
export function generateAssessmentAlerts(assessments: any) {
  // 🔥 FLAGS → ALERTS
// 🧠 AUTO + MANUAL FLAGS
const autoFlags = generateAutoFlags(assessments);
const manualFlags = assessments.flags || [];

const combinedFlags = [...new Set([...autoFlags, ...manualFlags])];

// 🔥 FLAGS → ALERTS
const alerts: AlertItem[] = [];

const addAlert = (alert: AlertItem) => {
  const exists = alerts.some((a: any) => a.type === alert.type);
  if (!exists) alerts.push(alert);
};

// 🔥 FLAGS → ALERTS
const flagAlerts = generateFlagAlerts(combinedFlags);
flagAlerts.forEach(addAlert);

  if (assessments.hydration === "poor" || assessments.hydration === "refused") {
    const type = "hydration_low";

addAlert({
  message: "Risk of dehydration",
  severity: "high",
  type,
  source: "assessments",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
  }

  if (assessments.mobility === "fall") {
  const type = "mobility";

  addAlert({
    message: "High falls risk",
    severity: "high",
    type,
    source: "assessments",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

if (assessments.early_warning_signs) {
  alerts.push({
    type: "early_warning",
    severity: "high",
    message: "Early warning signs identified",
    action: "Monitor closely and follow escalation plan",
    source: "assessment",
  });
}

if (assessments.risk_trend === "declining") {
  alerts.push({
    type: "deterioration",
    severity: "critical",
    message: "Client condition declining",
    action: "Immediate clinical review required",
    source: "assessment",
  });
}

  if (assessments.mood === "distressed") {
  const type = "mental_health";

  addAlert({
    message: "Emotional distress observed",
    severity: "high",
    type,
    source: "assessments",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}

  if (assessments.safeguarding === "concern") {
  const type = "safeguarding";

  addAlert({
    message: "Safeguarding concern",
    severity: "critical",
    type,
    source: "assessments",
    section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
  });
}
  
if (
  (assessments.capacity === "lacks capacity" ||
    assessments.capacity === "fluctuating") &&
  (!assessments.mcaList || assessments.mcaList.length === 0)
) {
  const type = "mca_missing";

addAlert({
  message: "No MCA assessments recorded",
  severity: "high",
  type,
  source: "assessments",
  section_title: ALERT_SECTION_MAP[type] || ALERT_SECTION_MAP.default,
});
}
if (
  assessments.best_interest_required === "yes" &&
  (!assessments.biList || assessments.biList.length === 0)
) {
  addAlert({
    message: "Best interest decision required",
    severity: "critical",
    type: "best_interest_missing",
    source: "assessments",
  });
}
return alerts;
}

export async function syncTasksWithAlerts({
  clientId,
  activeAlerts,
}: {
  clientId: string;
  activeAlerts: any[];
}) {
  const activeTypes = activeAlerts.map((a: any) => a.type);
  console.log("ACTIVE ALERT TYPES:", activeTypes);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .eq("source", "alert");

  if (!tasks) return;

  for (const task of tasks) {
    if (!task.linked_alert_type) continue;

    const stillActive = activeTypes.includes(task.linked_alert_type);

    if (!stillActive && task.status !== "completed") {
      await supabase
        .from("tasks")
        .update({
          status: "completed",
        })
        .eq("id", task.id);

      console.log("✅ TASK AUTO COMPLETED:", task.title);
    }
  }
}
  export async function cleanResolvedAlertsFromCarePlan({
  clientId,
  activeAlerts,
}: {
  clientId: string;
  activeAlerts: any[];
}) {
  if (!clientId) return;

  const activeMessages =
    activeAlerts?.map((a: any) => a.message) || [];

  const { data: sections } = await supabase
    .from("care_plan_section")
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

  for (const section of sections) {
    const lines = (section.actions || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const cleaned = lines.filter((line: string) =>
      activeMessages.some((msg: string) =>
        line.includes(msg)
      )
    );

    const updated = cleaned.join("\n");

    await supabase
      .from("care_plan_section")
      .update({
        actions: updated,
        content: `
Care Need:
${section.care_need || ""}

Outcome:
${section.outcome || ""}

Actions:
${updated}
`,
      })
      .eq("id", section.id);

    console.log("🧹 CLEANED SECTION:", section.section_title);
  }
}

export async function injectAlertsIntoCarePlan({
  clientId,
}: {
  clientId: string;
}) {
  // 🔥 GET ACTIVE ALERTS
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (!alerts?.length) return;

  // 🔥 GROUP BY SECTION
  const grouped: Record<string, any[]> = {};

  alerts.forEach((a: any) => {
    const section = a.section_title || "Risks & Safety";

    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(a);
  });

  // 🔥 GET CARE PLAN SECTIONS
  const { data: sections } = await supabase
    .from("care_plan_section")
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

  for (const section of sections) {
    const alertsForSection = grouped[section.section_title];

    if (!alertsForSection || alertsForSection.length === 0) continue;

    const alertActions = alertsForSection
      .map((a: any) => `⚠️ ${a.message}${a.action ? " — " + a.action : ""}`)
      .join("\n");

    const existing = section.actions || "";

    // 🔥 PREVENT DUPES
    if (existing.includes(alertActions)) continue;

    const updatedActions = `${existing}\n${alertActions}`.trim();

    await supabase
      .from("care_plan_section")
      .update({
        actions: updatedActions,
        content: `
Care Need:
${section.care_need || ""}

Outcome:
${section.outcome || ""}

Actions:
${updatedActions}
`,
      })
      .eq("id", section.id);

    console.log("📌 ALERTS INJECTED INTO:", section.section_title);
  }
}