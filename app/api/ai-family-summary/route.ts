import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { syncTasksWithAlerts } from "@/lib/alertEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { client_id, client: bodyClient, assessments, sections, visits } = body;

    const { plan, isTrialActive } = body;

// 🔒 ONLY RUN AI FOR PAID OR TRIAL
const canUseAI = plan === "pro" || isTrialActive;

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    // ✅ GET CLIENT
    const { data: dbClient } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    // ✅ GET LATEST VISIT
    const { data: visit } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

      const latestVisit = visits?.[0] || visit;

    // ✅ GET ACTIVE ALERTS
    const { data: alerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", client_id)
      .eq("status", "active");
const mergeAndDedupeAlerts = (existing: any[], incoming: any[]) => {
  const map = new Map();

  const severityRank: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  // 🔹 Add existing alerts first
  existing.forEach((a) => {
    map.set(a.message.toLowerCase(), a);
  });

  // 🔹 Merge incoming AI alerts
  incoming.forEach((a) => {
    const key = a.message.toLowerCase();

    if (!map.has(key)) {
      map.set(key, a);
      return;
    }

    const existingAlert = map.get(key);

    // 🔥 PRIORITY MERGE (HIGHER WINS)
    if (
      severityRank[a.severity] >
      severityRank[existingAlert.severity]
    ) {
      map.set(key, {
        ...existingAlert,
        severity: a.severity,
      });
    }
  });

  return Array.from(map.values());
};
const prompt = `
You are a senior clinical care assistant.

Analyse the data and return a structured JSON response.

CLIENT:
${dbClient?.name || bodyClient?.name || "Unknown"}

LATEST VISIT:
Mood: ${latestVisit?.mood || "N/A"}
Hydration: ${latestVisit?.hydration || "N/A"}
Nutrition: ${latestVisit?.nutrition || "N/A"}
Medication: ${latestVisit?.medication || "N/A"}
Notes: ${latestVisit?.note || "None"}

ASSESSMENTS:
${assessments ? JSON.stringify(assessments) : "None"}

ACTIVE ALERTS:
${alerts?.map((a: any) => `${a.message} (${a.severity})`).join(", ") || "None"}

---

Return ONLY valid JSON in this format:

{
  "summary": "string (3-5 sentences, simple and clear for carers)",
  "alerts": [
    {
      "message": "string",
      "severity": "low | medium | high | critical"
    }
  ],
  "risks": {
    "hydration": boolean,
    "nutrition": boolean,
    "falls": boolean,
    "medication": boolean,
    "skin": boolean
  },
  "needs_follow_up": boolean
}

Rules:
- Flag hydration risk if poor/refused
- Flag nutrition risk if poor/refused
- Flag medication if refused
- Escalate severity if repeated concerns
- Keep alerts short and actionable

Write a short update (3–6 sentences):
- Reassuring tone
- Highlight any concerns
- Mention positives if present
- Avoid jargon
`;
let structured: any = null;

try {
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return only valid JSON. No text outside JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  const aiJson = await aiRes.json();

  try {
    const raw = aiJson?.choices?.[0]?.message?.content;
    structured = JSON.parse(raw);
  } catch (err) {
    console.error("JSON PARSE FAILED:", err);

    structured = {
      summary: "Summary unavailable",
      alerts: [],
      risks: {},
      needs_follow_up: false,
    };
  }

} catch (err) {
  console.error("AI FAILED:", err);

  structured = {
    summary: `Update for ${dbClient?.name || "client"}. Recent visit completed.`,
    alerts: [],
    risks: {},
    needs_follow_up: false,
  };
}

// 🚨 PUSH AI ALERTS INTO SYSTEM (PRO / TRIAL ONLY)
if (canUseAI && structured?.alerts?.length) {
  try {
    // 🔹 GET CURRENT ACTIVE ALERTS
    const { data: existingAlerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", client_id)
      .eq("status", "active");

    // 🔹 MERGE + DEDUPE
    const mergedAlerts = mergeAndDedupeAlerts(
      existingAlerts || [],
      structured.alerts.map((a: any) => ({
        ...a,
        source: "ai",
      }))
    );

    // 🔹 PREP FOR INSERT
    const alertsToInsert = mergedAlerts.map((a: any) => ({
      client_id,
      message: a.message,
      severity: a.severity,
      status: "active",
      source: a.source || "ai",
      type: "ai_generated",
    }));

    // 🔥 CLEAR OLD AI ALERTS ONLY (NOT RULES)
    await supabase
      .from("alerts")
      .delete()
      .eq("client_id", client_id)
      .eq("source", "ai");

    // 🔥 INSERT MERGED
    await supabase
      .from("alerts")
      .insert(alertsToInsert);

      // 🔗 SYNC TASKS + CARE PLAN (PRO / TRIAL ONLY)
if (canUseAI) {
  try {
    const { data: freshAlerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", client_id)
      .eq("status", "active");

    // 🧠 TASK ENGINE
    await syncTasksWithAlerts({
      clientId: client_id,
      activeAlerts: freshAlerts || [],
    });

    // 🧠 CARE PLAN ENGINE
    const { data: existingCarePlan } = await supabase
      .from("care_plan_sections")
      .select("*")
      .eq("client_id", client_id);

    // 🔥 APPLY ALERTS → CARE PLAN
    const { applyAlertsToCarePlan } = await import("@/lib/carePlanEngine");

    // 🔥 APPLY ALERTS → CARE PLAN
await applyAlertsToCarePlan({
  clientId: client_id,
  alerts: freshAlerts || [],
});

// ✅ 👉 ADD THIS EXACTLY HERE
const { removeResolvedActionsFromCarePlan } = await import("@/lib/carePlanEngine");

await removeResolvedActionsFromCarePlan({
  clientId: client_id,
  activeAlerts: freshAlerts || [],
});

  } catch (err) {
    console.error("AI → TASK/CARE PLAN SYNC FAILED:", err);
  }
}

  } catch (err) {
    console.error("AI ALERT INSERT FAILED:", err);
  }
}

    // 💾 SAVE STRUCTURED SUMMARY (🔥 MAIN SYSTEM)
const { error } = await supabase
  .from("visit_notes")
  .insert({
    client_id,
    type: "structured_summary",
    note: JSON.stringify(structured),
  });

if (error) {
  console.error("INSERT ERROR:", error);
  return NextResponse.json(
    { error: "Insert failed" },
    { status: 500 }
  );
}

// ✅ OPTIONAL: SAVE CLEAN FAMILY VERSION
await supabase.from("family_updates").insert({
  client_id,
  summary: structured.summary,
});

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}