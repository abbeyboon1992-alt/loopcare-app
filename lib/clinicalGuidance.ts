export const clinicalGuidance: Record<string, {
  explanation: string;
  actions: string[];
  outcome?: string;
  tasks?: string[];
}> = {

  // 💧 HYDRATION
  hydration: {
    explanation:
      "Low fluid intake increases risk of UTIs, confusion, constipation, and falls.",
    actions: [
      "Encourage regular fluid intake",
      "Offer preferred drinks frequently",
      "Monitor input and output",
    ],
    outcome: "Maintain adequate hydration levels",
    tasks: [
      "Encourage fluid intake",
      "Monitor hydration levels",
    ],
  },

  hydration_critical: {
    explanation:
      "Severe dehydration risk — urgent intervention required to prevent hospitalisation.",
    actions: [
      "Escalate to senior staff immediately",
      "Consider GP or clinical review",
      "Monitor for confusion or collapse",
    ],
    outcome: "Stabilise hydration urgently",
    tasks: [
      "Urgent hydration intervention",
      "Escalate to senior staff",
    ],
  },

  // 🍽 NUTRITION
  nutrition: {
    explanation:
      "Poor nutrition can lead to weight loss, weakness, and delayed recovery.",
    actions: [
      "Encourage meals and snacks",
      "Monitor food intake",
      "Consider supplements if required",
    ],
    outcome: "Maintain adequate nutritional intake",
    tasks: [
      "Monitor food intake",
      "Encourage meals",
    ],
  },

  // 🚶 MOBILITY / FALLS
  falls: {
    explanation:
      "Fall risk identified — could lead to serious injury or hospitalisation.",
    actions: [
      "Ensure environment is safe",
      "Use mobility aids",
      "Supervise transfers if required",
    ],
    outcome: "Reduce likelihood of falls",
    tasks: [
      "Implement falls prevention measures",
      "Ensure mobility aids are used",
    ],
  },

  // 💊 MEDICATION
  medication_refused: {
    explanation:
      "Medication refusal may lead to deterioration of medical conditions.",
    actions: [
      "Document refusal",
      "Attempt re-offer if appropriate",
      "Escalate if repeated",
    ],
    outcome: "Ensure safe and consistent medication use",
    tasks: [
      "Review medication compliance",
      "Escalate repeated refusal",
    ],
  },

  // 🧴 SKIN
  skin_pressure: {
    explanation:
      "Skin breakdown can rapidly lead to pressure ulcers and infection.",
    actions: [
      "Reposition regularly",
      "Check pressure areas",
      "Use pressure-relieving equipment",
    ],
    outcome: "Maintain skin integrity",
    tasks: [
      "Reposition regularly",
      "Monitor skin condition",
    ],
  },

  // 🚩 SAFEGUARDING
  neglect_risk: {
    explanation:
      "Ongoing unmet needs suggest potential neglect — urgent intervention required.",
    actions: [
      "Escalate to senior staff immediately",
      "Review care plan",
      "Increase monitoring frequency",
    ],
    outcome: "Ensure safe and consistent care delivery",
    tasks: [
      "Urgent care plan review required",
      "Senior staff intervention required",
    ],
  },
};