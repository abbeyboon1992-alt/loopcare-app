"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { generateDiagnosisCarePlan } from "@/lib/carePlanDiagnosisTemplates";
import { useParams, useRouter } from "next/navigation";
import templates from "@/data/carePlanTemplates.json";
import { generateCareFromMatrix } from "@/lib/carePlanMatrix";
import { mapTaskToSection } from "@/lib/taskToSectionMapper";
import { useAccess } from "@/app/context/AccessContext";

export default function CarePlanPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assessments, setAssessment] = useState<any>(null);
const [preferences, setPreferences] = useState("");
const [goals, setGoals] = useState("");
const [visits, setVisits] = useState<any[]>([]);
const [tasks, setTasks] = useState<any[]>([]);
  useEffect(() => {
    loadPlan();
  }, [id]);

const [sections, setSections] = useState<any[]>([]);
const [client, setClient] = useState<any>(null);
const hasRunLegalUpdate = useRef(false);
useEffect(() => {
  const run = async () => {
    if (!client || sections.length === 0 || !assessments) return;

    if (hasRunLegalUpdate.current) return;

    hasRunLegalUpdate.current = true;

    const diagnosisSections = generateDiagnosisCarePlan(client);

    // ✅ DEFINE FIRST (IMPORTANT)
    const ensureSection = async (title: string) => {
      const exists = sections.some(
        (s) => s.section_title === title
      );

      if (exists) return;

      await supabase.from("care_plan_section").insert({
        client_id: id,
        section_title: title,
        content: "",
        status: "active",
      });
    };

    // ✅ DIAGNOSIS SECTIONS
    for (const template of diagnosisSections) {
      const exists = sections.some(
        (s) => s.section_title === template.title
      );

      if (!exists) {
        await supabase.from("care_plan_section").insert({
          client_id: id,
          section_title: template.title,
          care_need: template.care_need,
          outcome: template.outcome,
          actions: template.actions.join("\n"),
          content: `
Care Need:
${template.care_need}

Outcome:
${template.outcome}

Actions:
${template.actions.join("\n")}
`,
          status: "active",
        });
      }
    }

    // 🔥 ASSESSMENT RULES (NOW SAFE)
    if (assessments.toileting?.includes("stoma")) {
      await ensureSection("Personal Care (ADLs)");
    }

    if (assessments.toileting?.includes("catheter")) {
      await ensureSection("Personal Care (ADLs)");
    }

    if (assessments.capacity === "lacks capacity") {
      await ensureSection("Cognitive Wellbeing");
    }

    if (client?.dnacpr) {
      await ensureSection("Medical Conditions & Overview");
    }

    if (assessments.breathing === "laboured") {
      await ensureSection("Medical Conditions & Overview");
    }

    if (assessments.safeguarding === "concern") {
      await ensureSection("Risks & Safety");
    }

    // ✅ SYSTEM ENGINES LAST
    await updateLegalSections();
    await updateCarePlanFromSystem();

    await loadPlan();
  };

  run();
}, [client, sections, assessments]);
const [openSection, setOpenSection] = useState<string | null>(null);
const [editingSection, setEditingSection] = useState<string | null>(null);
const [editCareNeed, setEditCareNeed] = useState("");
const [editOutcome, setEditOutcome] = useState("");
const [editActions, setEditActions] = useState("");
const access = useAccess();
const plan = access?.plan || "free";
const isTrialActive = access?.isTrialActive || false;
const isPaidUser = true; // 🔁 change later from DB
const loadPlan = async () => {
  if (!id) return;

  // ✅ LOAD CARE PLAN SECTIONS (YOU WERE MISSING THIS)
  const { data: sectionData } = await supabase
    .from("care_plan_section")
    .select("*")
    .eq("client_id", id as string)
    .order("section_number", { ascending: true });

  if (sectionData) {
    setSections([...sectionData]);
  }

  // ✅ LOAD CLIENT
  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id as string)
    .single();

  if (clientData) {
    setClient(clientData);
    setPreferences(clientData.preferences || "");
    setGoals(clientData.goals || "");
  }

  // ✅ LOAD assessments
const { data: assessmentData } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", id as string)
  .maybeSingle();

if (assessmentData) {
  setAssessment(assessmentData);
}

  // ✅ LOAD TASKS (ONLY ONCE)
  const { data: taskData } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", id as string)
    .order("created_at", { ascending: false });

  if (taskData) setTasks(taskData);
};

const DEFAULT_SECTIONS = [
  "Personal Details & Emergency Contacts",
  "Medical Conditions & Overview",
  "Medication Support",
  "Personal Care (ADLs)",
  "Mobility & Moving",
  "Nutrition & Hydration",
  "Communication Needs",
  "Cognitive Wellbeing",
  "Emotional Wellbeing",
  "Risks & Safety",
  "Environment",
  "Daily Routine",
  "Emergency Plan",
  "End-of-Life Wishes",
  "Review Section",
];

const initializePlan = async () => {
  const existing = sections.map((s) => s.section_title?.trim());

  const toCreate = DEFAULT_SECTIONS
    .filter((title) => !existing.includes(title))
    .map((title, i) => ({
      client_id: id as string,
      section_title: title,
      section_number: i + 1,
      content: "",
      status: "draft",
    }));
    console.log("INITIALISING CARE PLAN FOR:", client?.id);

  if (toCreate.length > 0) {
  await supabase.from("care_plan_section").insert(toCreate);
}
  loadPlan();
};
const CONDITION_PROMPTS: Record<string, string[]> = {
  "Dementia": ["How does memory affect this area?", "Does the client become confused?"],
  "Alzheimer’s": ["Are there progressive memory challenges?"],
  "Autism": ["Any sensory sensitivities?"],
  "ADHD": ["Does attention impact daily tasks?"],
  "Learning Disability": ["Does the client need simplified instructions?"],
  "Parkinson’s": ["Are there tremors or movement issues?"],
  "Stroke": ["Any weakness or speech issues?"],
  "mental_health": ["Are there mood or anxiety concerns?"],
  "Epilepsy": ["Are seizures controlled and monitored?"],
  "Diabetes": ["Any blood sugar considerations?"],
  "End of Life": ["Are comfort measures prioritised?"],
  "Frailty": ["Is the client at risk of falls?"],
  "Delirium": ["Are there sudden confusion episodes?"],
  "COPD": ["Is breathing support required?"],
  "Heart Failure": ["Any fluid retention or fatigue?"],
  "Cancer": ["Is pain or fatigue impacting care?"],
  "Chronic Kidney Disease": ["Are fluid or diet restrictions needed?"],
  "Hypertension": ["Is blood pressure monitored regularly?"],
  "Osteoporosis": ["Is there a fracture risk?"],
  "Chronic Pain": ["How is pain managed daily?"],
  "Substance Use Disorder": ["Are there support or relapse risks?"],
  "Other": ["Are there any additional needs?"],
};
const getPrompts = (sectionTitle: string) => {
  const base =
    templates.find((t: any) => t.section === sectionTitle)?.prompts || [];

  let smart = [...base];

  const diagnosis: string[] = Array.isArray(client?.diagnosis)
  ? client.diagnosis.map((d: string) => d.trim())
  : [];

  diagnosis.forEach((condition) => {
    const extra = CONDITION_PROMPTS[condition];
    if (extra) {
      smart.push(...extra);
    }
  });

  return smart;
};

const saveSection = async (sectionId: string) => {
  const combinedContent = `
Care Need:
${editCareNeed}

Outcome:
${editOutcome}

Actions:
${editActions}
`;

  const sectionTitle = sections.find(
  s => String(s.id) === String(sectionId)
)?.section_title;
console.log("SECTION ID BEING SENT:", sectionId);
const section = sections.find(
  (s) => String(s.id) === String(sectionId)
);

const { data, error } = await supabase
  .from("care_plan_section")
  .update({
    care_need: editCareNeed,
    outcome: editOutcome,
    actions: editActions,
    content: combinedContent,
    status: "active",
    last_reviewed: new Date(),
  })
  .eq("id", sectionId)
  .select();

  console.log("SAVE RESULT:", data, error);

  if (error) {
    alert("ERROR SAVING");
    return;
  }

  if (!data || data.length === 0) {
    alert("NOT SAVED - ID MISMATCH");
    return;
  }

  console.log("CALLING TASK CREATION WITH:", editActions);
if (editActions && editActions.trim().length > 0) {
  await createTasksFromActions(
    editActions,
    sectionTitle
  );
}

  setEditCareNeed("");
  setEditOutcome("");
  setEditActions("");

  setEditingSection(null);
  setOpenSection(sectionId);

  await loadPlan();
  await updateCarePlanFromSystem();
};

const buildSmartContent = (section: string, diagnosis: string[]) => {
  let content = `### ${section}\n\n`;

  if (section === "Mobility & Moving") {
    content += "- Support safe mobility and monitor for falls\n";

    if (diagnosis.includes("Dementia")) {
      content += "- Provide supervision due to confusion risk\n";
    }

    if (diagnosis.includes("Arthritis")) {
      content += "- Assist with joint stiffness and slow movement\n";
    }
  }

  if (section === "Nutrition & Hydration") {
    content += "- Encourage regular meals and hydration\n";

    if (diagnosis.includes("Diabetes")) {
      content += "- Monitor sugar intake and meal timing\n";
    }
  }

  if (section === "Cognitive Wellbeing") {
    if (diagnosis.includes("Dementia")) {
      content += "- Provide reassurance and memory support\n";
      content += "- Use simple communication techniques\n";
    }
  }

  if (section === "Medication Support") {
    content += "- Administer medication as prescribed\n";

    if (diagnosis.includes("Dementia")) {
      content += "- Monitor for refusal or confusion\n";
    }
  }

  return content;
};

const getVisitSlot = (text: string) => {
  const lower = text.toLowerCase();

  if (lower.includes("morning") || lower.includes("breakfast")) return "morning";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("tea") || lower.includes("dinner")) return "tea";
  if (lower.includes("bed") || lower.includes("night")) return "bed";

  return "any";
};
// 🔥 NORMALISE TASK TEXT (prevents duplicates on edit)
const normalizeTask = (text: string) =>
  text
    .toLowerCase()
    .replace(/morning|breakfast|lunch|tea|dinner|bed|night/g, "")
    .replace(/\s+/g, " ")
    .trim();

const createTasksFromActions = async (
  actions: string,
  sectionTitle: string
) => {
  console.log("🧠 DIFF SYNC START");

  // 🧹 HANDLE EMPTY ACTIONS
  if (!actions || actions.trim().length === 0) {
    console.log("🧹 NO ACTIONS → DELETE ALL TASKS FOR SECTION");

    await supabase
      .from("tasks")
      .delete()
      .eq("client_id", id as string)
      .eq("section_title", sectionTitle);

    return;
  }

  // 🧠 PARSE ACTIONS
  const lines = actions
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.toLowerCase().includes("care need") &&
        !l.toLowerCase().includes("outcome") &&
        !l.toLowerCase().includes("actions")
    );

  console.log("🧩 ACTION LINES:", lines);

  // 🧠 NORMALISE NEW ACTIONS
  const newSet = new Set(lines.map(normalizeTask));

  // 📦 GET EXISTING TASKS
  const { data: existingTasks = [] } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", id as string)
    .eq("section_title", sectionTitle);

  console.log("📦 EXISTING TASKS:", existingTasks);

  const safeTasks = existingTasks || [];

const existingMap = new Map(
  safeTasks.map((t: any) => [
      normalizeTask(t.title),
      t,
    ])
  );

  // 🔥 FIND TASKS TO DELETE
  const toDelete = safeTasks.filter(
    (t: any) => !newSet.has(normalizeTask(t.title))
  );

  // 🔥 FIND TASKS TO CREATE
  const toCreate = lines.filter(
    (line) => !existingMap.has(normalizeTask(line))
  );

  console.log("🗑️ TO DELETE:", toDelete);
  console.log("➕ TO CREATE:", toCreate);

  // 🗑️ DELETE ONLY REMOVED TASKS
  for (const task of toDelete) {
    await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    console.log("🗑️ DELETED:", task.title);
  }

  // ➕ CREATE ONLY NEW TASKS
  const getPriority = (text: string) => {
    const lower = text.toLowerCase();

    if (
      lower.includes("medication") ||
      lower.includes("insulin") ||
      lower.includes("falls") ||
      lower.includes("risk") ||
      lower.includes("oxygen")
    ) {
      return "high";
    }

    if (
      lower.includes("monitor") ||
      lower.includes("assist") ||
      lower.includes("support")
    ) {
      return "medium";
    }

    return "low";
  };

  for (const line of toCreate) {
    const mappedSection = mapTaskToSection(line, {
  diagnosis: client?.diagnosis || [],
});

await supabase.from("tasks").insert({
  client_id: id as string,
  title: line.trim(),
  instructions: `From: ${sectionTitle}`,
  status: "pending",
  priority: getPriority(line),
  section_title: mappedSection, // 🔥 SMART SECTION
  visit_slot: getVisitSlot(line),
  source: "care_plan",
});

    console.log("➕ CREATED:", line);
  }

  console.log("✅ DIFF SYNC COMPLETE");
};
// 🧠 DIAGNOSIS → LEGAL CARE ACTIONS MAP
const DIAGNOSIS_LEGAL_ACTIONS: Record<string, string[]> = {
  "Dementia": [
    "Use simple language and reassurance",
    "Repeat information as needed",
    "Monitor for confusion or distress",
  ],
  "Alzheimer’s": [
    "Provide memory prompts",
    "Use familiar routines",
  ],
  "Learning Disability": [
    "Use simplified communication",
    "Allow extra time for decisions",
  ],
  "Autism": [
    "Avoid sensory overload",
    "Use clear structured communication",
  ],
  "mental_health": [
    "Provide emotional reassurance",
    "Monitor mood changes",
  ],
  "Diabetes": [
    "Monitor food and fluid intake",
    "Ensure medication compliance",
  ],
  "COPD": [
    "Monitor breathing and oxygen use",
    "Avoid overexertion",
  ],
  "Frailty": [
    "Supervise mobility",
    "Prevent falls",
  ],
  "Stroke": [
    "Support communication difficulties",
    "Assist with mobility",
  ],
};
// 🔥 AUTO UPDATE LEGAL SECTIONS (MCA / BEST INTEREST)
const updateLegalSections = async () => {
  if (!client) return;

  // 🧠 GET MCA + BEST INTEREST
  const { data: mca } = await supabase
    .from("mca_assessments")
    .select("*")
    .eq("client_id", id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: bi } = await supabase
    .from("best_interest_decisions")
    .select("*")
    .eq("client_id", id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 🔍 FIND SECTION
  const section = sections.find(
    (s) => s.section_title === "Cognitive Wellbeing"
  );

  if (!section) return;

  // 🧠 GET CLIENT DIAGNOSIS
const diagnosis: string[] = Array.isArray(client?.diagnosis)
  ? client.diagnosis.map((d: string) => d.trim())
  : [];

  let existingLines = (section.actions || "")
  .split("\n")
  .map((l: string) => l.trim())
  .filter((l: string) => l.length > 0);

const userLines = existingLines.filter(
  (l: string) => !l.includes("[AUTO]")
);

let actions = [...userLines];

const addAuto = (text: string) => {
  if (!actions.some((l: string) => l.includes(text))) {
    actions.push(`${text} [AUTO]`);
  }
};

if (mca?.has_capacity === false) {
  addAuto("Follow MCA principles");

  diagnosis.forEach((condition) => {
    const extra = DIAGNOSIS_LEGAL_ACTIONS[condition];
    if (extra) {
      extra.forEach((a) => addAuto(a));
    }
  });
}

  if (!mca) {
  addAuto("Complete MCA assessments");
}

if (mca?.has_capacity === false) {
  addAuto("Follow MCA principles");
  addAuto("Ensure best interest decisions documented");

  diagnosis.forEach((condition) => {
    const extra = DIAGNOSIS_LEGAL_ACTIONS[condition];
    if (extra) {
      extra.forEach((a) => addAuto(a));
    }
  });
}

if (mca?.has_capacity === true) {
  addAuto("Support client decision making");
}

  // 🧠 BEST INTEREST LOGIC
 if (bi) {
  addAuto("Follow best interest decision");
  addAuto("Review decision regularly");

  if (bi.outcome) {
    addAuto(bi.outcome);
  }
}

  // 🧹 CLEAN
  const finalActions = actions.join("\n").trim();

  // 💾 SAVE
  await supabase
  .from("care_plan_section")
  .update({
    actions: finalActions,
    content: `
Care Need:
${section.care_need || ""}

Outcome:
${section.outcome || ""}

Actions:
${finalActions}
`,
  })
  .eq("id", section.id);

  // 🔁 SYNC TASKS (USES YOUR EXISTING ENGINE)
  if (actions.length > 0) {
  await createTasksFromActions(actions.join("\n"), section.section_title);
}

  console.log("✅ LEGAL SECTION UPDATED");
};
const generateCarePlan = async () => {
  if (!client) return;

  const diagnosis: string[] = client.diagnosis || [];

  for (const section of sections) {
    let care_need = "";
let outcome = "";
let actions = "";
let content = "";

    // 🟢 FREE VERSION
   if (!isPaidUser && assessments) {
  const matrix = generateCareFromMatrix(assessments);

  const base = matrix[section.section_title];

  if (base) {
    care_need =
      typeof base.care_need === "string"
        ? base.care_need
        : base.care_need?.join("\n") || "";

    outcome =
      typeof base.outcome === "string"
        ? base.outcome
        : Array.from(base.outcome || []).join("\n") || "";

    actions = (base.actions || []).join("\n");
  }
}

    // 💰 PAID VERSION
    if (isPaidUser) {
      content = buildSmartContent(section.section_title, diagnosis);
    }

    await supabase
  .from("care_plan_section")
  .update({
  care_need,
  outcome,
  actions,
  content,
    status: "active",
    last_reviewed: new Date(),
  })
  .eq("client_id", id as string)
  .eq("section_number", section.section_number);


  loadPlan();
}

};

const updateCarePlanFromSystem = async () => {
  if (!client || !assessments || sections.length === 0) return;
  // 🔥 STEP 1 — GENERATE MATRIX OUTPUT
const matrix = generateCareFromMatrix(assessments);

// 🔥 STEP 2 — CREATE MISSING SECTIONS
for (const sectionTitle of Object.keys(matrix)) {
  const exists = sections.some(
    (s) => s.section_title === sectionTitle
  );

  if (!exists) {
    await supabase.from("care_plan_section").insert({
      client_id: id,
      section_title: sectionTitle,
      content: "",
      status: "active",
    });

    console.log("➕ AUTO-CREATED SECTION:", sectionTitle);
  }
}

// 🔁 RELOAD SECTIONS AFTER CREATION
await loadPlan();

  console.log("🔁 AUTO UPDATING CARE PLAN...");

  // 🔥 GET ACTIVE ALERTS
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("client_id", id as string)
    .eq("status", "active");

  const groupedAlerts: Record<string, any[]> = {};

  (alerts || []).forEach((a) => {
    const key = a.section_title || "Risks & Safety";
    if (!groupedAlerts[key]) groupedAlerts[key] = [];
    groupedAlerts[key].push(a);
  });

  for (const section of sections) {
    // 🧠 EXISTING ACTIONS
    const existingLines = (section.actions || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    // 🛡️ KEEP MANUAL ONLY
    const manualLines = existingLines.filter(
      (l: string) => !l.includes("[AUTO]")
    );

    // 🧠 BUILD FROM assessments
const base = matrix[section.section_title] || {
  care_need: "",
  outcome: "",
  actions: [],
};

    const assessmentLines =
  (base.actions || []).map((a: string) => `${a} [AUTO]`);

    // 🚨 BUILD FROM ALERTS
    const alertLines =
      groupedAlerts[section.section_title]?.map(
        (a: any) =>
          `⚠️ ${a.message}${a.action ? " — " + a.action : ""} [AUTO]`
      ) || [];

    // 🔥 MERGE
    const finalActions = [
      ...manualLines,
      ...assessmentLines,
      ...alertLines,
    ].join("\n");

    // 🧠 CARE NEED + OUTCOME (ONLY FROM assessments)
    const care_need =
  typeof base.care_need === "string"
    ? base.care_need
    : base.care_need?.join("\n") || section.care_need;

const outcome =
  typeof base.outcome === "string"
    ? base.outcome
    : Array.from(base.outcome || []).join("\n") || section.outcome;

    // 💾 SAVE
    await supabase
      .from("care_plan_section")
      .update({
        care_need,
        outcome,
        actions: finalActions,
        content: `
Care Need:
${care_need}

Outcome:
${outcome}

Actions:
${finalActions}
`,
      })
      .eq("id", section.id);

    // 🔁 SYNC TASKS
    await createTasksFromActions(
      finalActions,
      section.section_title
    );

    console.log("✅ UPDATED SECTION:", section.section_title);
  }
// 📩 AUTO GENERATE FAMILY SUMMARY
try {
  await fetch("/api/ai-family-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
  client_id: id,
  plan,
isTrialActive,
  client,
  assessments,
  sections,
  visits: [],
}),
  });
} catch (err) {
  console.log("Family summary failed:", err);
}
};

const rewriteSectionWithAI = async (section: any) => {
  if (!section) return;

  console.log("✨ AI REWRITE:", section.section_title);

  const payload = {
    section: section.section_title,
    care_need: section.care_need,
    outcome: section.outcome,
    actions: section.actions,
    diagnosis: client?.diagnosis || [],
    assessments,
  };

  

  const res = await fetch("/api/ai-rewrite-careplan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!data) {
    alert("AI failed");
    return;
  }
  const oldCareNeed = section.care_need;
const oldOutcome = section.outcome;
const oldActions = section.actions;

  const newCareNeed = data.care_need || section.care_need;
  const newOutcome = data.outcome || section.outcome;
  const newActions = data.actions || section.actions;

  await supabase
    .from("care_plan_section")
    .update({
      care_need: newCareNeed,
      outcome: newOutcome,
      actions: newActions,
      content: `
Care Need:
${newCareNeed}

Outcome:
${newOutcome}

Actions:
${newActions}
`,
    })
    .eq("id", section.id);

    await supabase.from("care_plan_audit").insert({
  client_id: id,
  section_id: section.id,
  action_type: "ai_rewrite",
  old_care_need: oldCareNeed,
  new_care_need: newCareNeed,
  old_outcome: oldOutcome,
  new_outcome: newOutcome,
  old_actions: oldActions,
  new_actions: newActions,
});

  // 🔁 sync tasks after rewrite
  await createTasksFromActions(newActions, section.section_title);

  await loadPlan();

  console.log("✅ AI REWRITE COMPLETE");
};

const generateFullCarePlanWithAI = async () => {
  if (!sections.length) return;

  console.log("🚀 FULL AI CARE PLAN GENERATION");

  for (const section of sections) {
    await rewriteSectionWithAI(section);
  }

  await loadPlan();

  alert("✅ Full AI Care Plan Generated");
};

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      <button
        onClick={() => router.push(`/clients/${id}`)}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Client
      </button>

      <h1 className="text-2xl font-bold mb-6">
        Care Plan
      </h1>
      <button
  onClick={generateCarePlan}
  
  className="bg-purple-600 px-4 py-2 rounded mb-6"
>
  {isPaidUser ? "🧱 Initial Setup" : "Auto-fill Prompts"}
</button>

{isPaidUser && (
  <button
    onClick={generateFullCarePlanWithAI}
    className="bg-pink-600 px-4 py-2 rounded mb-6 ml-2"
  >
    ✨ Improve with AI
  </button>
)}

<button
  onClick={updateCarePlanFromSystem}
  className="bg-green-600 px-4 py-2 rounded mb-6 ml-2"
>
  🔄 Update Care Plan
</button>

{/* ✅ CLIENT PREFERENCES */}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-6">
  <h2 className="font-semibold mb-3">Preferences & Wishes</h2>

  <textarea
    placeholder="Any preferences and wishes..."
    value={preferences}
    onChange={(e) => setPreferences(e.target.value)}
    className="w-full p-3 text-base rounded bg-[var(--card)]"
  />

  <button
    onClick={async () => {
      await supabase
  .from("clients")
  .update({
    preferences
  })
  .eq("id", id as string);

await loadPlan();

// 🔥 FORCE HARD REFRESH TASKS FROM DB
const { data: freshTasks } = await supabase
  .from("tasks")
  .select("*")
  .eq("client_id", id as string);

console.log("🔥 FRESH TASKS FROM DB:", freshTasks);

setTasks([...(freshTasks || [])]);

      alert("Saved");
    }}
    className="mt-2 bg-blue-600 px-4 py-2 rounded"
  >
    Save
  </button>
</div>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-6">
  <h2 className="font-semibold mb-3">Goals</h2>

  <textarea
    placeholder="Overall care goal - Maintain independence, improve nutrition..."
    value={goals}
    onChange={(e) => setGoals(e.target.value)}
    className="w-full p-3 text-base rounded bg-[var(--card)]"
  />

  <button
    onClick={async () => {
      await supabase
  .from("clients")
  .update({
    goals
  })
  .eq("id", id as string);
        await loadPlan();

// 🔥 FORCE TASK REFRESH AFTER TASK SYNC
const { data: freshTasks } = await supabase
  .from("tasks")
  .select("*")
  .eq("client_id", id as string);

console.log("🔥 REFRESH AFTER SAVE:", freshTasks);

setTasks([...(freshTasks || [])]);

      alert("Goals saved");
    }}
    className="mt-2 bg-blue-600 px-4 py-2 rounded"
  >
    Save Goals
  </button>
</div>

<button
  onClick={() => router.push(`/clients/${id}/visit/start`)}
  className="w-full bg-blue-600 py-3 rounded mb-6"
>
  Start Visit
</button>


{sections.length === 0 && tasks.length === 0 && (
  <p className="text-[var(--muted)]">No care plan yet</p>
)}
{sections.length === 0 ? (
  <button
    onClick={initializePlan}
    className="bg-blue-600 px-4 py-2 rounded"
  >
    Initialize Care Plan
  </button>
) : (
  <div className="space-y-3">
    {sections.map((section) => {
      const sectionId = String(section.id);
      const isOpen = openSection === sectionId;

      return (
        <div key={sectionId} className="bg-[var(--card)] rounded">

          <div
            onClick={() =>
              setOpenSection(isOpen ? null : sectionId)
            }
            className="p-4 cursor-pointer flex justify-between"
          >
            <span className="font-medium">
  {section.section_number}. {section.section_title}
</span>
            <span className="text-xs">{section.status}</span>
          </div>

          {isOpen && (
            <div className="p-4 border-t border-[var(--border)]-700">

              {editingSection === sectionId ? (
                <>
                <div className="mb-3 text-xs text-[var(--muted)]">
  <p className="mb-1">💡 Prompts:</p>
  {getPrompts(section.section_title).map((p: string, i: number) => (
    <p key={i}>• {p}</p>
  ))}
</div>
                  <div className="space-y-2">
  <div>
    <p className="text-xs text-[var(--muted)] mb-1">Care Need</p>
    <textarea
      value={editCareNeed}
      onChange={(e) => setEditCareNeed(e.target.value)}
      className="w-full p-2 bg-[var(--card)] rounded"
    />
  </div>

  <div>
    <p className="text-xs text-[var(--muted)] mb-1">Outcome / Goal</p>
    <textarea
      value={editOutcome}
      onChange={(e) => setEditOutcome(e.target.value)}
      className="w-full p-2 bg-[var(--card)] rounded"
    />
  </div>

  <div>
    <p className="text-xs text-[var(--muted)] mb-1">Actions</p>
    <textarea
      value={editActions}
      onChange={(e) => setEditActions(e.target.value)}
      className="w-full p-2 bg-[var(--card)] rounded"
    />
  </div>
</div>

                  <button
                    onClick={() => saveSection(sectionId)}
                    className="bg-green-600 px-3 py-1 rounded"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <div className="text-sm space-y-3">
  <div>
    <p className="text-[var(--muted)] text-xs">Care Need</p>
    <p>{section.care_need || "Not recorded"}</p>
  </div>

  <div>
    <p className="text-[var(--muted)] text-xs">Outcome</p>
    <p>{section.outcome || "Not recorded"}</p>
  </div>

  <div>
    <p className="text-[var(--muted)] text-xs">Actions</p>
    <p className="whitespace-pre-wrap">
      {section.actions || "Not recorded"}
    </p>
  </div>
</div>

                  <div className="mt-3 text-xs text-[var(--muted)]">
                    {getPrompts(section.section_title).map((p: string, i: number) => (
                      <p key={i}>• {p}</p>
                    ))}
                  </div>

                  <button
    onClick={() => {
      setEditingSection(sectionId);
      setEditCareNeed(section.care_need ?? "");
      setEditOutcome(section.outcome ?? "");
      setEditActions(section.actions ?? "");
    }}
    className="text-sm bg-blue-600 px-3 py-1 rounded"
  >
    Edit
  </button>

  {isPaidUser && section.actions && (
  <button
    onClick={() => rewriteSectionWithAI(section)}
    className="mt-2 text-sm bg-purple-600 px-3 py-1 rounded ml-2"
  >
    ✨ AI Rewrite
  </button>
)}
                </>
              )}
            </div>
          )}
        </div>
      );
    })}    
  </div>
)}      
{/* ✅ NEW TASKS SECTION AT BOTTOM */}
<div className="mt-10">
  <h2 className="text-lg font-semibold mb-3">
    Tasks
  </h2>
  {tasks.length === 0 ? (
    <p className="text-[var(--muted)]">No tasks generated yet</p>
  ) : (
    Object.entries(
  (tasks || []).reduce((acc: any, task: any) => {
        const key = task.section_title || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
      }, {})
    ).map(([section, items]: any) => (
      <details key={section} className="mb-3 bg-[var(--card)] rounded">
        <summary className="cursor-pointer p-3 font-medium text-purple-400">
          {section} ({items.length})
        </summary>

        <div className="p-3 space-y-2">
          {items.map((task: any) => (
  <div
    key={task.id}
    className="bg-[var(--card)] p-2 rounded flex justify-between items-center"
  >
    <span className="text-sm">{task.title}</span>

    <div className="flex items-center gap-2">
      <span
        className={`text-xs px-2 py-1 rounded ${
          task.status === "completed"
            ? "bg-green-600"
            : "bg-yellow-600"
        }`}
      >
        {task.status}
      </span>

      <button
        onClick={async () => {
  const section = sections.find(
    (s) => s.section_title === task.section_title
  );

  if (!section) return;

  const currentActions = section.actions || "";

  const updatedActions = currentActions
    .split("\n")
    .filter(
      (line: string) =>
        !line.toLowerCase().includes(task.title.toLowerCase())
    )
    .join("\n");

  console.log("🧹 REMOVING TASK FROM ACTIONS:", task.title);

  // ✅ UPDATE DB (source of truth)
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

  // 🔥 DIFF SYNC (DB)
  await createTasksFromActions(updatedActions, section.section_title);

  // ⚡ INSTANT UI UPDATE (THIS FIXES YOUR ISSUE)
  setTasks((prev) =>
    prev.filter((t) => t.id !== task.id)
  );

  // 🔄 SAFE BACKGROUND REFRESH (optional)
  setTimeout(() => {
    loadPlan();
  }, 300);
}}
        className="text-xs bg-red-600 px-2 py-1 rounded"
      >
        Delete
      </button>
    </div>
  </div>
))}
        </div>
      </details>
    ))
  )}
</div>

</div>
);
}