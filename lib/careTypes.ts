export const careTypes = {
  elderly: {
    tasks: [
      "Personal Care (ADLs)",
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
    carePlan: [
      {
        section_title: "Nutrition & Hydration",
        care_need: "Risk of dehydration",
        outcome: "Maintain hydration",
        actions: ["Encourage fluids", "Monitor intake"],
      },
      {
        section_title: "Mobility & Moving",
        care_need: "Fall risk",
        outcome: "Maintain safe mobility",
        actions: ["Use walking aids", "Assist transfers"],
      },
    ],
  },

  mental_health: {
    tasks: ["Mood Check", "Medication", "Routine Support", "Conversation"],
    guidance: ["Build trust first", "Avoid confrontation", "Use calm tone"],
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
    carePlan: [
      {
        section_title: "Emotional Wellbeing",
        care_need: "Emotional instability",
        outcome: "Improve mood stability",
        actions: ["Provide reassurance", "Encourage communication"],
      },
    ],
  },

  dementia: {
    tasks: ["Reorientation", "Monitor confusion", "Ensure safety"],
    guidance: ["Use simple language", "Avoid confrontation"],
    alerts: {
      confusion_worsening: {
        message: "⚠️ Increased confusion",
        severity: "high",
      },
    },
    carePlan: [
      {
        section_title: "Cognitive Wellbeing",
        care_need: "Cognitive decline",
        outcome: "Maintain orientation",
        actions: ["Reorient regularly", "Use familiar routines"],
      },
    ],
  },

  physical_disability: {
    tasks: ["Mobility Support", "Transfer Assistance", "Pressure care"],
    guidance: ["Use correct equipment"],
    alerts: {},
    carePlan: [
      {
        section_title: "Mobility & Moving",
        care_need: "Reduced physical ability",
        outcome: "Safe movement",
        actions: ["Use hoist if required", "Assist transfers"],
      },
    ],
  },

  end_of_life: {
    tasks: ["Comfort care", "Pain monitoring"],
    guidance: ["Prioritise dignity"],
    alerts: {
      pain_uncontrolled: {
        message: "🚨 Pain not controlled",
        severity: "critical",
      },
    },
    carePlan: [
      {
        section_title: "End-of-Life Wishes",
        care_need: "Palliative care",
        outcome: "Comfort and dignity",
        actions: ["Manage pain", "Respect wishes"],
      },
    ],
  },

  child: {
    tasks: ["Meals", "Play", "Education", "Sleep Routine"],
    guidance: ["Encourage engagement", "Maintain routine"],
    alerts: {
      nutrition_low: {
        message: "⚠️ Low food intake",
        severity: "medium",
      },
    },
    carePlan: [
      {
        section_title: "Development & Routine",
        care_need: "Growth and development",
        outcome: "Healthy development",
        actions: ["Encourage play", "Maintain structure"],
      },
    ],
  },

  baby: {
    tasks: ["Feeding", "Nappy change", "Sleep routine", "Comforting"],
    guidance: ["Monitor feeding", "Ensure safe sleep"],
    alerts: {
      feeding_low: {
        message: "⚠️ Reduced feeding observed",
        severity: "medium",
      },
    },
    carePlan: [
      {
        section_title: "Infant Care",
        care_need: "Basic needs",
        outcome: "Healthy infant",
        actions: ["Monitor feeding", "Track sleep"],
      },
    ],
  },

  teen: {
    tasks: ["Routine support", "Emotional check-in", "Medication"],
    guidance: ["Encourage independence"],
    alerts: {
      mood_low: {
        message: "⚠️ Emotional support needed",
        severity: "medium",
      },
    },
    carePlan: [
      {
        section_title: "Emotional Wellbeing",
        care_need: "Emotional development",
        outcome: "Stable wellbeing",
        actions: ["Check mood", "Encourage expression"],
      },
    ],
  },

  young_adult: {
    tasks: ["Medication", "Routine support", "Independence support"],
    guidance: ["Promote autonomy"],
    alerts: {},
    carePlan: [
      {
        section_title: "Independence",
        care_need: "Support autonomy",
        outcome: "Independent living",
        actions: ["Encourage self-care", "Support decisions"],
      },
    ],
  },

  adult: {
    tasks: ["Medication", "Mobility", "Daily living support"],
    guidance: [],
    alerts: {},
    carePlan: [
      {
        section_title: "General Care",
        care_need: "Daily living support",
        outcome: "Maintain independence",
        actions: ["Assist where needed"],
      },
    ],
  },
};
export const defaultCarePlan = [
  {
    section_title: "Nutrition & Hydration",
    care_need: "Risk of dehydration or poor intake",
    outcome: "Maintain adequate hydration and nutrition",
    actions: [
      "Encourage regular fluids",
      "Monitor food intake",
      "Record intake daily",
    ],
  },
  {
    section_title: "Mobility & Falls",
    care_need: "Reduced mobility and fall risk",
    outcome: "Maintain safe mobility",
    actions: [
      "Ensure walking aids are accessible",
      "Monitor for unsteadiness",
    ],
  },
];

export const getAdditionalCareTypes = (diagnosis: string[]) => {
  const types: string[] = [];

  diagnosis.forEach((d) => {
    const val = d.toLowerCase();

    if (val.includes("dementia") || val.includes("alzheimer")) {
      types.push("dementia");
    }

    if (val.includes("stroke") || val.includes("parkinson")) {
      types.push("physical_disability");
    }

    if (val.includes("end of life")) {
      types.push("end_of_life");
    }
  });

  return types;
};