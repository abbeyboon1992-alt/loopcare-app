import { supabase } from "@/lib/supabase";
import { clinicalGuidance } from "@/lib/clinicalGuidance";
const getSectionFromAlert = (alert: AlertItem) => {
  return alert.section_title || "Risks & Safety";
};
/* ---------------- TYPES ---------------- */

type AlertItem = {
  type: string;
  message: string;
  severity?: string;
  action?: string;
  section_title?: string;
};

type CarePlanSection = {
  title: string;
  care_need: string;
  outcome: string;
  actions: string[];
};

/* ---------------- GENERATE ---------------- */

export function generateCarePlan(
  form: any,
  alerts: AlertItem[]
): CarePlanSection[] {
  const sectionMap: Record<string, any> = {};

  const addSection = (title: string, data: any) => {
    const key = title.trim();

    if (!sectionMap[key]) {
      sectionMap[key] = {
        title: key,
        care_need: [],
        outcome: new Set(),
        actions: new Set(),
      };
    }

    if (data.care_need) sectionMap[key].care_need.push(data.care_need);
    if (data.outcome) sectionMap[key].outcome.add(data.outcome);

    if (data.actions) {
      const actions = Array.isArray(data.actions)
        ? data.actions
        : [data.actions];

      actions.forEach((a: string) => {
        if (a && a.trim()) sectionMap[key].actions.add(a);
      });
    }
  };

  /* ---------------- CORE ASSESSMENT → CARE ---------------- */

  // 🧠 COGNITION
  if (form.cognition && form.cognition !== "no impairment") {
    addSection("Cognitive Wellbeing", {
      care_need: `Cognition: ${form.cognition}`,
      outcome: "Maintain safety and orientation",
      actions: [
        form.communication === "non-verbal" && "Use non-verbal communication",
        form.communication === "needs support" && "Provide communication support",
        form.capacity !== "has capacity" && "Follow MCA decisions",
        form.communication_support,
      ],
    });
  }

  // 🥤 HYDRATION
  if (["reduced", "poor", "refused"].includes(form.hydration)) {
    addSection("Nutrition & Hydration", {
      care_need: `Hydration: ${form.hydration}`,
      outcome: "Maintain hydration",
      actions: [
        "Encourage fluids",
        form.hydration === "poor" && "Monitor intake closely",
      ],
    });
  }

  // 🍽 CHOKING
  if (["moderate", "high"].includes(form.choking)) {
    addSection("Nutrition & Hydration", {
      care_need: "Choking risk",
      outcome: "Ensure safe swallowing",
      actions: [
        `IDDSI: ${form.iddsi}`,
        `Fluids: ${form.fluid_level}`,
        "Supervise meals",
      ],
    });
  }

  // 🚶 MOBILITY
  if (form.mobility) {
    addSection("Mobility & Moving", {
      care_need: `Mobility: ${form.mobility}`,
      outcome: "Maintain safe mobility",
      actions: [
        form.mobility === "dependent" && "Full assistance required",
        form.falls_risk === "high" && "Falls prevention plan",
      ],
    });
  }

  // 🛠 EQUIPMENT
  if (form.equipment?.length) {
    addSection("Mobility & Moving", {
      care_need: "Mobility equipment required",
      outcome: "Ensure safe mobility",
      actions: [`Use equipment: ${form.equipment.join(", ")}`],
    });
  }

  // 🔧 EQUIPMENT SERVICING
  if (form.equipment_serviced) {
    Object.entries(form.equipment_serviced).forEach(([item, status]: any) => {
      if (status !== "yes") {
        addSection("Mobility & Moving", {
          care_need: `${item} requires servicing`,
          outcome: "Ensure safe equipment",
          actions: [`Arrange servicing for ${item}`],
        });
      }
    });
  }

  // 🧻 CONTINENCE
  if (form.toileting?.includes("incontinent")) {
    addSection("Personal Care (ADLs)", {
      care_need: "Continence needs",
      outcome: "Maintain dignity",
      actions: [
        `Support: ${form.continence_ability}`,
        form.pad_type,
      ],
    });
  }

  // 🩹 SKIN
  if (form.skin && form.skin !== "intact") {
    addSection("Personal Care (ADLs)", {
      care_need: `Skin: ${form.skin}`,
      outcome: "Maintain skin integrity",
      actions: [
        form.repositioning_required && `Reposition: ${form.repositioning_required}`,
        form.wound_care_plan,
      ],
    });
  }

  // 💊 MEDICATION
  if (form.medication_ability !== "independent") {
    addSection("Medication Support", {
      care_need: "Medication support required",
      outcome: "Ensure compliance",
      actions: [
        `Support: ${form.medication_ability}`,
        form.prn_protocol,
      ],
    });
  }

  if (form.medication_compliance_risk === "high") {
    addSection("Medication Support", {
      care_need: "High medication risk",
      outcome: "Prevent missed medication",
      actions: ["Monitor administration closely"],
    });
  }

  // 🚨 NEWS2
  if (form.news2_score >= 5) {
    addSection("Medical Conditions & Overview", {
      care_need: "Clinical deterioration risk",
      outcome: "Prevent escalation",
      actions: [
        `NEWS2: ${form.news2_score}`,
        form.escalation_plan || "Escalate to GP",
      ],
    });
  }

  // 🧓 FRAILTY
  if (form.frailty_score >= 7) {
    addSection("Medical Conditions & Overview", {
      care_need: "Severe frailty",
      outcome: "Prevent deterioration",
      actions: ["Close monitoring required"],
    });
  }

  // 🚨 SAFEGUARDING
  if (form.safeguarding === "concern") {
    addSection("Risks & Safety", {
      care_need: "Safeguarding concern",
      outcome: "Ensure safety",
      actions: [
        "Follow safeguarding protocol",
        form.safeguarding_outcome,
      ],
    });
  }

  // ❤️ MENTAL HEALTH
  if (form.mental_health_status && form.mental_health_status !== "stable") {
    addSection("Emotional Wellbeing", {
      care_need: `Mental health: ${form.mental_health_status}`,
      outcome: "Support wellbeing",
      actions: [
        form.mental_health_impact,
        "Provide reassurance",
      ],
    });
  }

  // 🔥 DEAD FIELDS NOW ACTIVE
  if (form.early_warning_signs) {
    addSection("Medical Conditions & Overview", {
      care_need: "Early warning signs",
      outcome: "Detect deterioration early",
      actions: [form.early_warning_signs],
    });
  }

  if (form.escalation_plan) {
    addSection("Medical Conditions & Overview", {
      care_need: "Escalation plan",
      outcome: "Ensure response",
      actions: [form.escalation_plan],
    });
  }

  if (form.baseline_status) {
    addSection("Medical Conditions & Overview", {
      care_need: "Baseline condition",
      outcome: "Maintain baseline",
      actions: [form.baseline_status],
    });
  }

  /* ---------------- ALERTS (KEEP YOUR SYSTEM) ---------------- */

  alerts.forEach((alert: AlertItem) => {
    const section = getSectionFromAlert(alert);

    const guidance = clinicalGuidance[alert.type];

    addSection(section, {
      care_need: guidance?.explanation || alert.message,
      outcome: guidance?.outcome || "Risk monitored and managed",
      actions: guidance?.actions?.length
        ? guidance.actions
        : [alert.action || alert.message],
    });
  });

  /* ---------------- FINAL FORMAT ---------------- */

  return Object.values(sectionMap).map((s: any) => ({
    title: s.title,
    care_need: s.care_need.join(" | "),
    outcome: Array.from(s.outcome).join(" | "),
    actions: Array.from(s.actions),
  }));
}

/* ---------------- APPLY ALERTS ---------------- */

export async function applyAlertsToCarePlan({
  clientId,
  alerts,
}: {
  clientId: string;
  alerts: AlertItem[];
}) {
  const { data: sections } = await supabase
    .from("care_plan_section") // ✅ FIXED TABLE NAME
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

  // 🔥 CREATE MAP
const sectionMap = new Map(
  sections.map((s: any) => [s.title, s])
);

// 🔥 AUTO-CREATE MISSING SECTIONS
for (const alert of alerts) {
  const sectionTitle = getSectionFromAlert(alert).trim();

  if (sectionMap.has(sectionTitle)) continue;

  const guidance = clinicalGuidance[alert.type];

  const newSection = {
    client_id: clientId,
    title: sectionTitle,
    care_need:
      guidance?.explanation || alert.message,
    outcome:
      guidance?.outcome || "Risk monitored and managed",
    actions: (
      guidance?.actions?.length
        ? guidance.actions
        : [alert.action || alert.message]
    ).join("\n"),
    system_generated: true,
    created_at: new Date().toISOString(),
  };

  await supabase
    .from("care_plan_section")
    .insert(newSection);

  sectionMap.set(sectionTitle, newSection);
}

  const allSections = Array.from(sectionMap.values());

for (const section of allSections) {
    const matchingAlerts = alerts.filter(
  (a) => getSectionFromAlert(a) === section.title
);

// 🔥 REMOVE ALL EXISTING ALERT LINES FIRST
const existingLines = (
  Array.isArray(section.actions)
    ? section.actions
    : (section.actions || "").split("\n")
)
  .map((l: string) => l.trim())
  .filter(Boolean);

// keep only NON-alert lines
let actions = existingLines.filter(
  (l: string) => !l.startsWith("[")
);

// 🔥 CREATE NORMALISED SET
const actionSet = new Set(
  actions.map((l: string) => l.toLowerCase())
);

matchingAlerts.forEach((a) => {
  const guidance = clinicalGuidance[a.type];

const line = `[${a.type}] ${
  guidance?.actions?.[0] || a.message
}`;
  const key = line.toLowerCase();

  if (!actionSet.has(key)) {
    actions.push(line);
    actionSet.add(key);
  }
});

    if (!section.id) continue;

await supabase
  .from("care_plan_section")
  .update({ actions: actions.join("\n") })
  .eq("id", section.id);
  }
}

/* ---------------- REMOVE RESOLVED ---------------- */

export async function removeResolvedActionsFromCarePlan({
  clientId,
  activeAlerts,
}: {
  clientId: string;
  activeAlerts: AlertItem[];
}) {
  if (!clientId) return;

  const { data: sections } = await supabase
    .from("care_plan_section") // ✅ FIXED TABLE NAME
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

// 🔥 CREATE MAP FOR QUICK LOOKUP
const sectionMap = new Map(
  sections.map((s: any) => [s.title.trim().toLowerCase(), s])
);

  const activeKeys = activeAlerts.map(
  (a) => `[${a.type}] ${a.message}`.toLowerCase()
);

  for (const section of sections) {
    if (!section.actions) continue;

    const lines = (section.actions || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    const filtered = lines.filter((line: string) =>
  activeKeys.includes(line.toLowerCase())
);

    await supabase
      .from("care_plan_section")
      .update({ actions: filtered.join("\n") })
      .eq("id", section.id);
  }
}