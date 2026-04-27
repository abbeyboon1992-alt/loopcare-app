import { supabase } from "@/lib/supabase";

export function generateCarePlan(risks: any[]) {
  return risks.map((risk) => ({
    title: risk.title,
    care_need: risk.title,
    outcome: "Risk managed and monitored",
    actions: Array.isArray(risk.actions)
      ? risk.actions
      : [risk.actions],
  }));
}
export function applyAlertsToCarePlan(
  carePlan: any[],
  alerts: any[]
) {
if (!carePlan || !alerts) return carePlan;

return carePlan.map((section) => {
  const matchingAlerts = alerts.filter((alert) => {
    return (
      section.title?.toLowerCase().includes(alert.type?.toLowerCase()) ||
      alert.type.includes(section.title?.toLowerCase())
    );
  });

  if (matchingAlerts.length === 0) return section;

  const extraActions = matchingAlerts.map(
    (a) => `[${a.type}] ${a.message || a.action || "Review required"}`
  );

  return {
    ...section,
    actions: [
      ...(section.actions || []),
      ...extraActions,
    ],
  };
});
}
export async function removeResolvedActionsFromCarePlan({
  clientId,
  activeAlerts,
}: {
  clientId: string;
  activeAlerts: any[];
}) {
  if (!clientId) return;

  // 🔹 get current care plan from DB
  const { data: sections } = await supabase
    .from("care_plan_section")
    .select("*")
    .eq("client_id", clientId);

  if (!sections) return;

  const activeMessages = activeAlerts.map(
    (a) => a.message || a.action
  );

  for (const section of sections) {
    if (!section.actions) continue;

    const filtered = section.actions.filter(
      (action: string) =>
        activeMessages.some((msg) => action.includes(msg))
    );

    await supabase
      .from("care_plan_section")
      .update({ actions: filtered })
      .eq("id", section.id);
  }
}