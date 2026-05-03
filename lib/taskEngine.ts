import { masterTasks } from "@/data/masterTasks";
import carePrompts from "@/data/carePlanPrompts.json";
import { clinicalGuidance } from "@/lib/clinicalGuidance";

type CarePlanItem = {
  title: string;
  actions?: string[] | string;
};

type AlertItem = {
  type: string;
  message: string;
  severity: string;
  section_title?: string;
  action?: string;
};

type TaskItem = {
  title: string;
  category: string;
  description: string;
  prompts: string[];
  due: string;
  status: string;
  linked_alert_type?: string;
  priority?: string;
};

export function generateTasks(
  carePlan: CarePlanItem[] = [],
  alerts: AlertItem[] = []
): TaskItem[] {
  const tasks: TaskItem[] = [];
  const taskSet = new Set<string>();

  // 🔹 CARE PLAN → TASKS
  carePlan.forEach((item) => {
    const matches = masterTasks.filter((t: any) => {
      const taskName = t.name?.toLowerCase() || "";
      const title = item.title?.toLowerCase() || "";

      return (
        taskName.includes(title) ||
        title.includes(taskName)
      );
    });

    matches.forEach((match: any) => {
      const key = match.name.toLowerCase();

      if (taskSet.has(key)) return;

      const prompts = carePrompts
        .filter((p: any) => p["Task Name"] === match.name)
        .map((p: any) => p["Prompt Text"]);

      tasks.push({
        title: match.name,
        category: match.category,
        description: match.description,
        prompts,
        due: new Date().toISOString(),
        status: "pending",
      });

      taskSet.add(key);
    });

    // 🔹 FALLBACK TASK
    if (matches.length === 0) {
      const key = item.title.toLowerCase();

      if (!taskSet.has(key)) {
        tasks.push({
          title: item.title,
          category: "General",
          description: Array.isArray(item.actions)
            ? item.actions.join(", ")
            : item.actions || "",
          prompts: [`Record care for: ${item.title}`],
          due: new Date().toISOString(),
          status: "pending",
        });

        taskSet.add(key);
      }
    }
  });

  // 🔥 ALERTS → TASKS (RUN ONCE — OUTSIDE LOOP)
  alerts.forEach((alert: AlertItem) => {
    const guidance = clinicalGuidance[alert.type];

    const taskTitles =
      guidance?.tasks?.length
        ? guidance.tasks
        : [alert.type];

    taskTitles.forEach((taskTitle: string) => {
      const taskKey = `alert-${taskTitle.toLowerCase()}`;

      if (taskSet.has(taskKey)) return;

      const prompts = carePrompts
        .filter((p: any) => p["Task Name"] === taskTitle)
        .map((p: any) => p["Prompt Text"]);

      tasks.push({
        title: taskTitle,
        category: alert.section_title || "Alerts",
        description:
          guidance?.explanation || alert.message,
        prompts:
          prompts.length > 0
            ? prompts
            : guidance?.actions || [
                `Respond to alert: ${alert.message}`,
              ],
        due: new Date().toISOString(),
        status: "pending",
        linked_alert_type: alert.type,
        priority:
          alert.severity === "critical"
            ? "high"
            : alert.severity === "high"
            ? "medium"
            : "low",
      });

      taskSet.add(taskKey);
    });
  });

  return tasks;
}