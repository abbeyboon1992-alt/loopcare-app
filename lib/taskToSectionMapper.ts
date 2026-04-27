export const mapTaskToSection = (
  taskTitle: string,
  context?: {
    alertType?: string;
    assessments?: any;
    diagnosis?: string[];
  }
): string => {
  const title = taskTitle.toLowerCase();

  // 💧 HYDRATION / NUTRITION
  if (
    title.includes("fluid") ||
    title.includes("drink") ||
    title.includes("meal") ||
    title.includes("nutrition") ||
    context?.alertType === "hydration_low"
  ) {
    return "Nutrition & Hydration";
  }

  // 🚶 MOBILITY
  if (
    title.includes("mobility") ||
    title.includes("falls") ||
    title.includes("walk") ||
    title.includes("transfer") ||
    context?.alertType === "falls_event"
  ) {
    return "Mobility & Moving";
  }

  // 💊 MEDICATION
  if (
    title.includes("medication") ||
    title.includes("drug") ||
    context?.alertType === "medication_refused"
  ) {
    return "Medication Support";
  }

  // 🧠 COGNITION
  if (
    title.includes("confusion") ||
    title.includes("cognitive") ||
    title.includes("memory")
  ) {
    return "Cognitive Wellbeing";
  }

  // 😊 EMOTIONAL
  if (
    title.includes("reassurance") ||
    title.includes("emotional") ||
    title.includes("support") ||
    title.includes("mood")
  ) {
    return "Emotional Wellbeing";
  }

  // 🧴 PERSONAL CARE
  if (
    title.includes("wash") ||
    title.includes("bath") ||
    title.includes("toileting") ||
    title.includes("pad") ||
    title.includes("skin")
  ) {
    return "Personal Care (ADLs)";
  }

  // 🫁 MEDICAL
  if (
    title.includes("breathing") ||
    title.includes("oxygen") ||
    title.includes("pain")
  ) {
    return "Medical Conditions & Overview";
  }

  // ⚠️ SAFETY
  if (
    title.includes("risk") ||
    title.includes("hazard") ||
    title.includes("safety")
  ) {
    return "Risks & Safety";
  }

  // 🧹 DEFAULT
  return "Daily Routine";
};