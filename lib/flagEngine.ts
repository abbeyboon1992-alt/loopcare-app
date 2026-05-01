export function generateAutoFlags(assessment: any): string[] {
  const flags: string[] = [];

  if (!assessment) return flags;

  if (assessment.hydration === "poor" || assessment.hydration === "refused") {
    flags.push("hydration_risk");
  }

  if (assessment.nutrition === "poor") {
    flags.push("malnutrition_risk");
  }

  if (assessment.skin === "breakdown") {
    flags.push("pressure_ulcer_risk");
  }

  if (assessment.mobility === "bedbound") {
    flags.push("immobility_risk");
  }

  if (assessment.cognition === "confused") {
    flags.push("cognitive_decline");
  }

  if (assessment.safeguarding === "concern") {
    flags.push("safeguarding_risk");
  }

  return flags;
}