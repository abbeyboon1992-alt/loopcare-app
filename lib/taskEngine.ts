import { masterTasks } from "@/data/masterTasks";
import carePrompts from "@/data/carePlanPrompts.json";

export function generateTasks(carePlan: any[]) {
  const tasks: any[] = [];

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

  return tasks;
}