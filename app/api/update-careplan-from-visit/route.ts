import { supabase } from "@/lib/supabase";
import { mapTaskToSection } from "@/lib/taskToSectionMapper";

export async function POST(req: Request) {
  const { client_id, data } = await req.json();

  if (!client_id || !data) {
    return new Response("Missing data", { status: 400 });
  }

  const updates: Record<string, string[]> = {};

  // 🧠 GROUP TASKS BY SECTION
  (data.tasks || []).forEach((task: string) => {
    const section = mapTaskToSection(task);

    if (!updates[section]) updates[section] = [];

    updates[section].push(task);
  });

  // 🔥 APPLY TO CARE PLAN
  for (const sectionTitle of Object.keys(updates)) {
    const { data: section } = await supabase
      .from("care_plan_section")
      .select("*")
      .eq("client_id", client_id)
      .eq("section_title", sectionTitle)
      .maybeSingle();

    if (!section) continue;

    const existingLines = (section.actions || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const newLines = updates[sectionTitle].map(
      (t) => `✔ ${t} (completed)`
    );

    const merged = [...existingLines];

    newLines.forEach((line) => {
      if (!merged.some((l) => l.includes(line))) {
        merged.push(line);
      }
    });

    const updatedActions = merged.join("\n");

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
  }

  return new Response("OK");
}