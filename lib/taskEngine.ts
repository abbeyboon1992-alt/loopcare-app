import { masterTasks } from "@/data/masterTasks";
import carePrompts from "@/data/carePlanPrompts.json";

type CarePlanItem = {
  title: string;
  actions?: string[] | string;
};

type AlertItem = {
  type: string;
  message: string;
  severity: string;
  section_title?: string;
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

  // 🔹 CARE PLAN → TASKS
  carePlan.forEach((item: CarePlanItem) => {
    const matches = masterTasks.filter((t: any) => {
      const taskName = t.name?.toLowerCase() || "";
      const title = item.title?.toLowerCase() || "";

      return (
        taskName.includes(title) ||
        title.includes(taskName)
      );
    });

    matches.forEach((match: any) => {
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
    });

    // 🔹 FALLBACK TASK
    if (matches.length === 0) {
      tasks.push({
        title: item.title,
        category: "General",
        description: Array.isArray(item.actions)
          ? item.actions.join(", ")
          : item.actions || "",
        prompts: [],
        due: new Date().toISOString(),
        status: "pending",
      });
    }
  });

  // 🔥 ALERTS → TASKS
  alerts.forEach((alert: AlertItem) => {
    tasks.push({
      title: alert.type,
      category: alert.section_title || "Alerts",
      description: alert.message,
      prompts: [],
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
  });

  return tasks;
}