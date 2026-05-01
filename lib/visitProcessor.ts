import { supabase } from "./supabase";
import {
  generateVisitAlerts,
  scoreAlerts,
  saveAlerts,
  generateAssessmentAlerts,
} from "./alertEngine";
import {
  generateCarePlan,
  applyAlertsToCarePlan,
} from "./carePlanEngine";
import { generateInsights } from "./insightsEngine";
import { removeResolvedActionsFromCarePlan } from "./carePlanEngine";
import { mergeAlerts } from "@/lib/mergeAlerts";
import { generateDiagnosisAlerts } from "@/lib/alertEngine";
import { generateCareFromMatrix } from "@/lib/carePlanMatrix";

export async function processVisit({
  clientId,
  userId,
  visitId,
  data,
}: {
  clientId: string;
  userId: string;
  visitId?: string | null;
  data: any;
}) 
{
  const {
  data: { user },
} = await supabase.auth.getUser();

const safeUserId = user?.id || null;

console.log("SAFE USER ID:", safeUserId);
  // 💾 Save visit
  const { data: visit, error } = await supabase
  .from("visit_notes")
  .insert([
    {
      client_id: clientId,
      user_id: safeUserId,
      notes: data.notes,
      mood: data.mood,
      hydration: data.hydration,
      nutrition: data.nutrition,
      mobility: data.mobility,
      toileting: data.toileting,
      medication: data.medication,
    },
  ])
  .select()
  .single();

  if (error) {
  console.error("VISIT INSERT ERROR FULL:", JSON.stringify(error, null, 2));
  alert("VISIT ERROR — check console");
  return;
}

  // 🔍 GET CLIENT
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) {
    console.error("No client found");
    return;
  }
const { data: assessments } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", clientId)
  .maybeSingle();
  // 🧠 GENERATE ALERTS
  const visitAlerts = await generateVisitAlerts({
  client,
  visitData: data,
  assessments,
});

const assessmentAlerts = generateAssessmentAlerts(assessments || {});
const diagnosisAlerts = generateDiagnosisAlerts(client);

const allAlerts = [
  ...visitAlerts,
  ...assessmentAlerts,
  ...diagnosisAlerts,
];

const mergedAlerts = mergeAlerts(allAlerts);
const scoredAlerts = scoreAlerts(mergedAlerts);

  await saveAlerts({
  clientId,
  organisation_id: client.organisation_id,
  visit_id: visit.id,
  alerts: scoredAlerts.map((a) => ({
    ...a,
    source: "visit",
    triggered_by: userId,
  })),
});

await removeResolvedActionsFromCarePlan({
  clientId,
  activeAlerts: scoredAlerts,
});

// 🧠 GENERATE + APPLY CARE PLAN
const matrix = generateCareFromMatrix(
  { ...assessments, ...data },
  client
);

const baseCarePlan = Object.entries(matrix).map(([title, val]: any) => ({
  title,
  care_need: val.care_need.join(" | "),
  outcome: Array.from(val.outcome).join(" | "),
  actions: Array.from(val.actions).map((a: any) => String(a)),
}));

const finalCarePlan = applyAlertsToCarePlan(
  baseCarePlan,
  scoredAlerts
);

// 💾 SAVE TO DB
for (const section of finalCarePlan) {
  await supabase
    .from("care_plan_sections") // ⚠️ check table name
    .upsert(
      {
        client_id: clientId,
        title: section.title,
        care_need: section.care_need,
        outcome: section.outcome,
        actions: section.actions.join("\n"),
      },
      {
        onConflict: "client_id,title",
      }
    );
}

  // 🚨 PRIORITY
  const totalScore = scoredAlerts.reduce(
  (sum, a) => sum + (a.score || 0),
  0
);

  let priority = "normal";
  if (totalScore >= 6) priority = "high";
  else if (totalScore >= 3) priority = "medium";

  await supabase
    .from("clients")
    .update({ priority })
    .eq("id", clientId);

  // 🚨 ESCALATION
  if (priority === "high") {
    await saveAlerts({
  clientId,
  organisation_id: client.organisation_id,
  visit_id: visit.id,
  alerts: [
    {
      message: "🚨 High risk detected — immediate review required",
      severity: "high",
      type: "escalation",
      score: 3,
      source: "visit",
      triggered_by: userId,
    },
  ],
});
  }

  // 🧠 INSIGHTS
  const insights = generateInsights(data.notes || "");

  const insightAlerts = insights.map((i: string) => ({
  message: i,
  severity: "medium",
  type: "insight",
  score: 2,
  source: "visit",
  triggered_by: userId,
}));

  await saveAlerts({
    clientId,
    organisation_id: client.organisation_id,
    visit_id: visit.id,
    alerts: insightAlerts,
  });

  // 💰 INVOICE
  await supabase.from("invoices").insert({
    client_id: clientId,
    visit_count: 1,
    total_hours: 1,
    subtotal: 20,
  });

if (assessments) {
  const updates: any = {};

  // 💧 HYDRATION
  if (data.hydration === "good") {
    updates.hydration = "adequate";
  }
  if (data.hydration === "poor" || data.hydration === "refused") {
    updates.hydration = "poor";
  }

  // 🍽 NUTRITION
  if (data.nutrition === "good") {
    updates.nutrition = "adequate";
  }
  if (data.nutrition === "poor" || data.nutrition === "refused") {
    updates.nutrition = "poor";
  }

  // 🚶 MOBILITY
  if (data.mobility === "fall") {
    updates.mobility = "high risk";
  }

  // 🙂 MOOD
  if (data.mood === "low" || data.mood === "distressed") {
    updates.emotional_wellbeing = "concern";
  }

  // 💊 MEDICATION
  if (data.medication === "refused" || data.medication === "missed") {
    updates.medication_compliance = "risk";
  }

  // 🧠 SAVE ONLY IF CHANGES EXIST
  if (Object.keys(updates).length > 0) {
  const updatedAssessment = {
    ...assessments,
    ...updates,
  };

  await supabase
    .from("assessments")
    .update({
      ...updates,
      last_updated_from_visit: new Date().toISOString(),
    })
    .eq("client_id", clientId);

  // 🔥 RE-SYNC ALERTS FROM UPDATED assessments
  const refreshedAlerts = generateAssessmentAlerts(updatedAssessment);
  const matrix = generateCareFromMatrix(updatedAssessment, client);

const updatedCarePlan = applyAlertsToCarePlan(
  Object.entries(matrix).map(([title, val]: any) => ({
    title,
    care_need: val.care_need.join(" | "),
    outcome: Array.from(val.outcome).join(" | "),
    actions: Array.from(val.actions).map((a: any) => String(a)),
  })),
  refreshedAlerts
);

for (const section of updatedCarePlan) {
  await supabase
    .from("care_plan_sections")
    .upsert(
      {
        client_id: clientId,
        title: section.title,
        care_need: section.care_need,
        outcome: section.outcome,
        actions: section.actions.join("\n"),
      },
      {
        onConflict: "client_id,title",
      }
    );
}

  await saveAlerts({
    clientId,
    organisation_id: client.organisation_id,
    visit_id: visit.id,
    alerts: refreshedAlerts.map((a: any) => ({
      ...a,
      source: "assessments",
      triggered_by: userId,
    })),
  });

  await removeResolvedActionsFromCarePlan({
    clientId,
    activeAlerts: refreshedAlerts,
  });
}

// ✅ CLOSE assessments block
}

// ✅ CLOSE MAIN FUNCTION
return visit;
}