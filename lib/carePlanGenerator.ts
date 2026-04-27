export function generateCarePlan(assessments: any) {
  const sections: any[] = [];

  // 🧠 MOBILITY
  if (assessments.mobility === "fall") {
    sections.push({
      title: "Mobility Support",
      content: "Assist with all transfers. Use walking aids. Monitor for falls.",
    });
  }

  // 💧 HYDRATION
  if (assessments.hydration === "poor") {
    sections.push({
      title: "Hydration",
      content: "Encourage fluids regularly. Record intake.",
    });
  }

  // 💊 MEDICATION
  if (assessments.medication === "refused") {
    sections.push({
      title: "Medication",
      content: "Monitor compliance. Escalate repeated refusals.",
    });
  }

  // 🧠 COGNITION
  if (assessments.cognition === "impaired") {
    sections.push({
      title: "Cognitive Support",
      content: "Provide reassurance and orientation cues.",
    });
  }

  return sections;
}