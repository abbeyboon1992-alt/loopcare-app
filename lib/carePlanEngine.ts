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
    if (!sectionMap[title]) {
      sectionMap[title] = {
        title,
        care_need: [],
        outcome: new Set(),
        actions: new Set(),
      };
    }

    if (data.care_need) sectionMap[title].care_need.push(data.care_need);
    if (data.outcome) sectionMap[title].outcome.add(data.outcome);

    if (data.actions) {
      const actions = Array.isArray(data.actions)
        ? data.actions
        : [data.actions];

      actions.forEach((a: string) =>
        sectionMap[title].actions.add(a)
      );
    }
  };

  if (form.mobility) {
    addSection("Mobility & Moving", {
      care_need: `Mobility: ${form.mobility}`,
      outcome: "Maintain safe mobility",
      actions:
        form.mobility === "dependent"
          ? "Full assistance required"
          : "Monitor mobility",
    });
  }

  if (form.nutrition || form.hydration) {
    addSection("Nutrition & Hydration", {
      care_need: `Nutrition: ${form.nutrition || "unknown"}`,
      outcome: "Maintain adequate intake",
      actions:
        form.nutrition === "poor"
          ? "Encourage meals and fluids"
          : "Monitor intake",
    });
  }

  if (form.skin) {
    addSection("Personal Care (ADLs)", {
      care_need: `Skin: ${form.skin}`,
      outcome: "Maintain skin integrity",
      actions:
        form.skin !== "intact"
          ? "Reposition regularly"
          : "Routine monitoring",
    });
  }

  if (form.falls_risk) {
    addSection("Mobility & Moving", {
      care_need: `Falls risk: ${form.falls_risk}`,
      outcome: "Prevent falls",
      actions:
        form.falls_risk === "high"
          ? "Supervise mobility"
          : "Monitor risk",
    });
  }

  alerts.forEach((alert: AlertItem) => {
  const section = alert.section_title || "Risks & Safety";

  const guidance = clinicalGuidance[alert.type];

  addSection(section, {
    care_need:
      guidance?.explanation || alert.message,

    outcome:
      guidance?.outcome ||
      "Risk monitored and managed",

    actions:
      guidance?.actions?.length
        ? guidance.actions
        : [alert.action || alert.message],
  });
});

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
  const sectionTitle = getSectionFromAlert(alert).trim().toLowerCase();

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