import { supabase } from "@/lib/supabase";
import { mapTaskToSection } from "@/lib/taskToSectionMapper";

type AutoTask = {
  title: string;
  reason: string;
};

export async function POST(req: Request) {
  const { client_id, autoTasks } = await req.json();

  if (!client_id) {
    return new Response("Missing client_id", { status: 400 });
  }

  // ✅ NORMALISE
  const tasks: AutoTask[] = autoTasks || [];

  // ===============================
  // 🧹 STEP 1 — CLEAN OLD ACTIONS
  // ===============================
  const { data: sections } = await supabase
    .from("care_plan_section")
    .select("*")
    .eq("client_id", client_id);

  if (sections) {
    for (const sec of sections) {
      const existingLines = (sec.actions || "")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);

      const activeTasks = tasks.map((t) =>
        t.title.toLowerCase()
      );

      const cleaned = existingLines.filter((line: string) =>
        activeTasks.some((task) =>
          line.toLowerCase().includes(task)
        )
      );

      await supabase
        .from("care_plan_section")
        .update({
          actions: cleaned.join("\n"),
        })
        .eq("id", sec.id);
    }
  }

  // ===============================
  // ✏️ STEP 2 — BUILD NEW ACTIONS
  // ===============================
  const grouped: Record<string, { action: string; reasoning: string }[]> = {};

  tasks.forEach((t) => {
    const section = mapTaskToSection(t.title);

    if (!grouped[section]) grouped[section] = [];

    grouped[section].push({
      action: t.title,
      reasoning: t.reason,
    });
  });

  // ===============================
  // 💾 STEP 3 — WRITE TO CARE PLAN
  // ===============================
  for (const sectionTitle in grouped) {
    const lines = grouped[sectionTitle]
      .map((a) => `• ${a.action} — ${a.reasoning}`)
      .join("\n");

    await supabase
      .from("care_plan_section")
      .update({
        actions: lines,
      })
      .eq("client_id", client_id)
      .eq("section_title", sectionTitle);
  }

  return new Response("OK");
}