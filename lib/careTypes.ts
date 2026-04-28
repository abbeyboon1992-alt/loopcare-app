export const careTypes = {
  elderly: {
    tasks: [
      "Personal Care",
      "Medication",
      "Hydration",
      "Mobility",
      "Toileting",
      "Mood",
      "Nutrition",
    ],
    guidance: [
      "Encourage fluids early",
      "Check for fall risks",
      "Monitor medication closely",
    ],
    alerts: {
      hydration_low: {
        message: "⚠️ High dehydration risk",
        severity: "high",
      },
      medication_refused: {
        message: "🚨 Medication missed",
        severity: "high",
      },
      mood_low: {
        message: "💬 Possible low mood",
        severity: "medium",
      },
    },
  },

  "mental_health": {
    tasks: [
      "Mood Check",
      "Medication",
      "Routine Support",
      "Conversation",
    ],
    guidance: [
      "Build trust first",
      "Avoid confrontation",
      "Use calm tone",
    ],
    alerts: {
      mood_low: {
        message: "🚨 Emotional support needed",
        severity: "high",
      },
      medication_refused: {
        message: "⚠️ Medication compliance risk",
        severity: "medium",
      },
    },
  },

  child: {
    tasks: [
      "Meals",
      "Play",
      "Education",
      "Sleep Routine",
    ],
    guidance: [
      "Encourage engagement",
      "Maintain routine",
      "Monitor safety closely",
    ],
    alerts: {
      nutrition_low: {
        message: "⚠️ Low food intake",
        severity: "medium",
      },
    },
  },
};