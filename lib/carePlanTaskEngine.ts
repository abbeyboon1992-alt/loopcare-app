import { supabase } from "@/lib/supabase";
export async function resolveCompletedTasksFromVisit(
  clientId: string,
  visitData: any
) {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "pending");

  if (error) {
    console.error("❌ TASK LOAD ERROR:", error);
    return;
  }

  if (!tasks || tasks.length === 0) return;

  const tasksToResolve: string[] = [];

  for (const task of tasks) {
    const text = (task.task || task.title || "").toLowerCase();

    let shouldResolve = false;

    // 💧 HYDRATION
    if (
      text.includes("fluid") &&
      visitData.hydration === "adequate"
    ) shouldResolve = true;

    // 🍽️ NUTRITION
    if (
      text.includes("meal") &&
      visitData.nutrition === "adequate"
    ) shouldResolve = true;

    // 💊 MEDICATION
    if (
      text.includes("medication") &&
      visitData.medication === "taken"
    ) shouldResolve = true;

    // 🚶 MOBILITY
    if (
      text.includes("mobility") &&
      visitData.mobility !== "bedbound"
    ) shouldResolve = true;

    if (shouldResolve) {
      tasksToResolve.push(task.id);
    }
  }

  // ✅ BULK UPDATE (important)
  if (tasksToResolve.length > 0) {
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .in("id", tasksToResolve);

    if (updateError) {
      console.error("❌ TASK UPDATE ERROR:", updateError);
    }
  }
}
export const syncTasksWithCarePlan = async ({
  clientId,
  completedTasks,
  missedTasks,
  autoTasks,
  observations,
}: {
  clientId: string;
  completedTasks: string[];
  missedTasks: string[];
  autoTasks: string[];
  observations?: any; // ✅ ADD THIS
}) => {
  const { data: sections, error } = await supabase
    .from("care_plan_section") // ✅ FIX TABLE NAME
    .select("*")
    .eq("client_id", clientId);

  if (error) {
    console.error("❌ CARE PLAN LOAD ERROR:", error);
    return;
  }

  if (!sections) return;

  for (const section of sections) {
    let actions = (section.actions || "")
      .split("\n")
      .map((a: string) => a.trim())
      .filter(Boolean);

    // ✅ REMOVE COMPLETED TASKS
    actions = actions.filter(
      (a: string) =>
        !completedTasks.some(
          (t) => t.toLowerCase() === a.toLowerCase()
        )
    );

    // ❌ REMOVE OLD FLAGS (prevents stacking)
    actions = actions.filter(
      (a: string) =>
        !a.startsWith("⚠ Missed:") &&
        !a.startsWith("+ ")
    );

    // ❌ ADD MISSED TASKS
    missedTasks.forEach((task) => {
      if (
        !actions.some(
          (a: string) => a.toLowerCase() === task.toLowerCase()
        )
      ) {
        actions.push(`⚠ Missed: ${task}`);
      }
    });

    // 🔥 ADD AUTO TASKS
    autoTasks.forEach((task) => {
      if (
        !actions.some(
          (a: string) => a.toLowerCase() === task.toLowerCase()
        )
      ) {
        actions.push(`+ ${task}`);
      }
    });

    const { error: updateError } = await supabase
      .from("care_plan_section")
      .update({
        actions: actions.join("\n"),
      })
      .eq("id", section.id);

    if (updateError) {
      console.error("❌ CARE PLAN UPDATE ERROR:", updateError);
    }
  }
};