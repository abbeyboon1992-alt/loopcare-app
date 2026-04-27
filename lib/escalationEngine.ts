import { createClient } from "@supabase/supabase-js";

export async function runEscalationEngine() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("status", "active")
    .lte("next_escalation_at", now);

  if (!alerts || alerts.length === 0) return;

  for (const alert of alerts) {
    // 🚫 Skip if already handled
    if (alert.acknowledged || alert.status !== "active") continue;

    let newLevel = alert.escalation_level + 1;
    let newSeverity = alert.severity;

    // 🔄 Escalation logic
    if (newLevel === 1 && alert.severity === "medium") {
      newSeverity = "high";
    }

    if (newLevel >= 2) {
      newSeverity = "critical";
    }

    let nextEscalation = null;

    if (newSeverity === "high") {
      nextEscalation = new Date(
        Date.now() + 4 * 60 * 60 * 1000
      ).toISOString();
    }

    if (newSeverity === "medium") {
      nextEscalation = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();
    }

    await supabase
      .from("alerts")
      .update({
        escalation_level: newLevel,
        severity: newSeverity,
        next_escalation_at: nextEscalation,
        escalated_at: new Date().toISOString(),
      })
      .eq("id", alert.id);
  }
}