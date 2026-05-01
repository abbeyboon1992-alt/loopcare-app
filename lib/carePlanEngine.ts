import { supabase } from "@/lib/supabase";

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

  // ✅ MOBILITY
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

  // ✅ NUTRITION
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

  // ✅ SKIN
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

  // ✅ FALLS
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

  // 🔥 ALERTS → MERGE
  alerts.forEach((alert: AlertItem) => {
    const section = alert.section_title || "Risks & Safety";

    addSection(section, {
      care_need: alert.message,
      outcome: "Risk monitored and managed",
      actions: alert.action || alert.message,
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

export function applyAlertsToCarePlan(
  carePlan: CarePlanSection[],
  alerts: AlertItem[]
): CarePlanSection[] {
  return carePlan.map((section: CarePlanSection) => {
    const matchingAlerts = alerts.filter(
      (alert: AlertItem) =>
        alert.section_title === section.title
    );

    const newActions = new Set(section.actions || []);

    matchingAlerts.forEach((a: AlertItem) => {
      newActions.add(`[${a.type}] ${a.message}`);
    });

    return {
      ...section,
      actions: Array.from(newActions),
    };
  });
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
    .from("care_plan_section")
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

  const activeMessages = activeAlerts.map(
    (a: AlertItem) => a.message || a.action
  );

  for (const section of sections) {
    if (!section.actions) continue;

    // 🔥 FIX: actions is STRING not array
    const lines = (section.actions || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const filtered = lines.filter((line: string) =>
      activeMessages.some((msg) => line.includes(msg || ""))
    );

    const updated = filtered.join("\n");

    await supabase
      .from("care_plan_section")
      .update({ actions: updated })
      .eq("id", section.id);
  }
}