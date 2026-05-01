export function generateFlagAlerts(flags: string[]) {
  if (!flags?.length) return [];

  return flags
    .map((flag) => {
      switch (flag) {
        case "hydration_risk":
          return {
            type: "hydration_flag",
            severity: "high",
            message: "Hydration risk detected",
            source: "flags",
          };

        case "malnutrition_risk":
          return {
            type: "nutrition_flag",
            severity: "high",
            message: "Malnutrition risk detected",
            source: "flags",
          };

        case "pressure_ulcer_risk":
          return {
            type: "skin_flag",
            severity: "high",
            message: "Pressure ulcer risk",
            source: "flags",
          };

        case "immobility_risk":
          return {
            type: "mobility_flag",
            severity: "medium",
            message: "Immobility risk",
            source: "flags",
          };

        case "cognitive_decline":
          return {
            type: "cognition_flag",
            severity: "medium",
            message: "Cognitive decline observed",
            source: "flags",
          };

        case "safeguarding_risk":
          return {
            type: "safeguarding_flag",
            severity: "critical",
            message: "Safeguarding concern",
            source: "flags",
          };

        default:
          return null;
      }
    })
    .filter((a): a is any => a !== null); // ✅ TYPE FIX
}