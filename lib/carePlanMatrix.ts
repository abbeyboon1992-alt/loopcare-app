type Rule = {
  section: string;
  condition: (a: any, client?: any) => boolean;
  care_need: string;
  outcome: string;
  actions: string[];
};

export const carePlanMatrix: Rule[] = [
  // 🥤 HYDRATION
  {
  section: "Nutrition & Hydration",
  condition: (a) => a.hydration === "poor",
  care_need: "Risk of dehydration",
  outcome: "Maintain adequate hydration",
  actions: ["Encourage fluids", "Monitor intake"],
},
{
  section: "Nutrition & Hydration",
  condition: (a) => a.hydration === "poor",
  care_need: "Risk of dehydration",
  outcome: "Maintain adequate hydration",
  actions: ["Encourage fluids", "Monitor intake"],
},
{
  condition: (a) => a.hydration === "none",
  section: "Nutrition & Hydration",
  care_need: "Severe dehydration risk",
  outcome: "Restore hydration urgently",
  actions: ["Encourage fluids immediately", "Escalate if persists"],
},
{
  condition: (a) => a.hydration === "none",
  section: "Nutrition & Hydration",
  care_need: "Severe dehydration risk",
  outcome: "Restore hydration urgently",
  actions: ["Encourage fluids immediately", "Escalate if persists"],
},
  {
    section: "Nutrition & Hydration",
    condition: (a) => a.hydration === "none",
    care_need: "Severe dehydration risk",
    outcome: "Urgent hydration support",
    actions: ["Encourage fluids immediately", "Escalate if continues"],
  },

  // 🍽️ NUTRITION
  {
    section: "Nutrition & Hydration",
    condition: (a) => a.nutrition === "poor" || a.nutrition === "refused",
    care_need: "Risk of malnutrition",
    outcome: "Maintain adequate nutrition",
    actions: ["Encourage meals", "Monitor intake"],
  },
  {
  section: "Nutrition & Hydration",
  condition: (a) => a.hydration === "poor",
  care_need: "Risk of dehydration",
  outcome: "Maintain adequate hydration",
  actions: ["Encourage fluids", "Monitor intake"],
},
{
  condition: (a) => a.hydration === "none",
  section: "Nutrition & Hydration",
  care_need: "Severe dehydration risk",
  outcome: "Restore hydration urgently",
  actions: ["Encourage fluids immediately", "Escalate if persists"],
},

  // 🚶 MOBILITY
  {
    section: "Mobility & Moving",
    condition: (a) => a.mobility === "fall",
    care_need: "High falls risk",
    outcome: "Prevent falls",
    actions: ["Supervise mobility", "Ensure aids are used"],
  },
  {
  section: "Mobility & Moving",
  condition: (a) => a.mobility === "fall",
  care_need: "High falls risk",
  outcome: "Prevent falls",
  actions: ["Supervise mobility", "Ensure aids used"],
},
{
  condition: (a) => a.mobility === "decline",
  section: "Mobility & Moving",
  care_need: "Mobility decline",
  outcome: "Maintain safe movement",
  actions: ["Assist transfers", "Monitor changes"],
},
{
  section: "Mobility & Moving",
  condition: (a) => a.falls > 0,
  care_need: "History of falls",
  outcome: "Reduce falls risk",
  actions: ["Review environment", "Increase supervision"],
},
  {
    section: "Mobility & Moving",
    condition: (a) => a.mobility === "decline",
    care_need: "Mobility decline",
    outcome: "Maintain safe mobility",
    actions: ["Assist movement", "Monitor changes"],
  },

  // 🧠 COGNITION
  {
    section: "Cognitive Wellbeing",
    condition: (a) => a.cognition === "confused",
    care_need: "Cognitive impairment",
    outcome: "Maintain orientation",
    actions: ["Provide reassurance", "Use prompts"],
  },
  {
  section: "Cognitive Wellbeing",
  condition: (a) => a.cognition === "confused",
  care_need: "Cognitive impairment",
  outcome: "Maintain orientation",
  actions: ["Provide prompts", "Reassurance"],
},
{
  section: "Cognitive Wellbeing",
  condition: (a) => a.capacity === "lacks capacity",
  care_need: "Lacks decision-making capacity",
  outcome: "Safe decisions made",
  actions: ["Follow MCA principles", "Best interest decisions"],
},

  // 😊 MOOD
  {
    section: "Emotional Wellbeing",
    condition: (a) => a.mood === "low",
    care_need: "Low mood",
    outcome: "Improve emotional wellbeing",
    actions: ["Encourage engagement", "Provide reassurance"],
  },
  {
  section: "Emotional Wellbeing",
  condition: (a) => a.mood === "low",
  care_need: "Low mood",
  outcome: "Improve wellbeing",
  actions: ["Encourage engagement"],
},
{
  condition: (a) => a.behaviour === "agitated",
  section: "Emotional Wellbeing",
  care_need: "Agitated behaviour",
  outcome: "Reduce distress",
  actions: ["Use de-escalation"],
},

  // 💊 MEDICATION
  {
    section: "Medication Support",
    condition: (a) => a.medication === "missed",
    care_need: "Medication non-compliance",
    outcome: "Ensure medication taken safely",
    actions: ["Record reason", "Monitor compliance"],
  },
  {
  section: "Medication Support",
  condition: (a) => a.medication === "missed",
  care_need: "Medication non-compliance",
  outcome: "Medication taken safely",
  actions: ["Record reason", "Monitor compliance"],
},
  {
    section: "Medication Support",
    condition: (a) => a.medication === "refused",
    care_need: "Medication refusal",
    outcome: "Promote safe medication use",
    actions: ["Encourage gently", "Escalate if repeated"],
  },
  {
  section: "Medication Support",
  condition: (a) => a.medication_ability === "unable",
  care_need: "Unable to self-medicate",
  outcome: "Safe medication administration",
  actions: ["Administer medication", "Monitor effects"],
},

  // 🧴 SKIN
  {
    section: "Personal Care (ADLs)",
    condition: (a) => a.skin && a.skin.includes("category"),
    care_need: "Pressure damage risk",
    outcome: "Maintain skin integrity",
    actions: ["Reposition regularly", "Monitor skin"],
  },
  {
  section: "Personal Care (ADLs)",
  condition: (a) => a.skin === "breakdown",
  care_need: "Skin breakdown present",
  outcome: "Promote healing",
  actions: ["Monitor wound", "Escalate if worsening"],
},

{
  section: "Personal Care (ADLs)",
  condition: (a) => a.toileting === "incontinent",
  care_need: "Incontinence care required",
  outcome: "Maintain hygiene and dignity",
  actions: ["Regular checks", "Provide continence care"],
},
{
  condition: (a) => a.toileting?.includes("stoma"),
  section: "Personal Care (ADLs)",
  care_need: "Stoma care required",
  outcome: "Stoma managed safely",
  actions: ["Monitor output", "Check skin"],
},

  // 🚽 STOMA
  {
    section: "Personal Care (ADLs)",
    condition: (a) => a.toileting?.includes("stoma"),
    care_need: "Stoma care required",
    outcome: "Stoma managed safely",
    actions: ["Support stoma care", "Monitor output", "Check skin"],
  },

  // 🚽 CATHETER
  {
    section: "Personal Care (ADLs)",
    condition: (a) => a.toileting?.includes("catheter"),
    care_need: "Catheter care required",
    outcome: "Catheter functioning safely",
    actions: ["Monitor output", "Check for infection"],
  },

  // 🫁 BREATHING
  {
    section: "Medical Conditions & Overview",
    condition: (a) => a.breathing === "laboured",
    care_need: "Respiratory distress",
    outcome: "Maintain safe breathing",
    actions: ["Monitor closely", "Escalate if worsening"],
  },
  {
  section: "Medical Conditions & Overview",
  condition: (a) => a.breathing === "laboured",
  care_need: "Respiratory distress",
  outcome: "Maintain breathing",
  actions: ["Monitor closely", "Escalate"],
},

  // 💢 PAIN
  {
    section: "Medical Conditions & Overview",
    condition: (a) => a.pain === "high",
    care_need: "Pain impacting wellbeing",
    outcome: "Pain controlled",
    actions: ["Administer medication", "Monitor pain"],
  },
  {
  section: "Medical Conditions & Overview",
  condition: (a) => a.pain === "high",
  care_need: "Pain affecting wellbeing",
  outcome: "Pain controlled",
  actions: ["Administer medication", "Monitor pain"],
},
  {
  section: "Nutrition & Hydration",
  condition: (a) => a.must_score >= 2,
  care_need: "High risk of malnutrition (MUST)",
  outcome: "Nutritional status improved",
  actions: [
    "Monitor weight regularly",
    "Encourage high-calorie meals",
    "Refer to dietician if required",
  ],
},
{
  section: "Nutrition & Hydration",
  condition: (a) => a.must_score >= 2,
  care_need: "High malnutrition risk",
  outcome: "Improve nutritional status",
  actions: [
    "Weekly weight monitoring",
    "High calorie diet",
    "Refer to dietician",
  ],
},
{
  section: "Personal Care (ADLs)",
  condition: (a) => a.waterlow_score >= 20,
  care_need: "Very high risk of pressure ulcers",
  outcome: "Skin integrity maintained",
  actions: [
    "Reposition every 2 hours",
    "Use pressure-relieving equipment",
    "Monitor skin daily",
  ],
},
{
  section: "Personal Care (ADLs)",
  condition: (a) => a.waterlow_score >= 20,
  care_need: "Very high pressure ulcer risk",
  outcome: "Prevent skin breakdown",
  actions: [
    "Reposition every 2 hours",
    "Pressure mattress required",
  ],
},
{
  section: "Personal Care (ADLs)",
  condition: (a) => a.waterlow_score >= 10 && a.waterlow_score < 20,
  care_need: "Moderate risk of pressure damage",
  outcome: "Prevent pressure ulcers",
  actions: [
    "Reposition regularly",
    "Check pressure areas",
  ],
},
{
  section: "Medical Conditions & Overview",
  condition: (a) => a.news2_score >= 5,
  care_need: "Clinical deterioration risk (NEWS2)",
  outcome: "Deterioration identified early",
  actions: [
    "Monitor observations closely",
    "Escalate to GP/111 immediately",
  ],
},
{
  section: "Medical Conditions & Overview",
  condition: (a) => a.news2_score >= 5,
  care_need: "Clinical deterioration",
  outcome: "Early detection",
  actions: ["Monitor observations", "Escalate"],
},
{
  section: "Medical Conditions & Overview",
  condition: (a) => a.news2_score >= 7,
  care_need: "Severe clinical deterioration",
  outcome: "Emergency response initiated",
  actions: [
    "Call emergency services",
    "Monitor continuously",
  ],
},
{
  section: "Mobility & Moving",
  condition: (a) => a.uses_hoist === true,
  care_need: "Requires hoist for transfers",
  outcome: "Safe transfers maintained",
  actions: [
    "Use hoist correctly",
    "Check sling before use",
  ],
},
{
  section: "Mobility & Moving",
  condition: (a) => a.uses_walking_aid === true,
  care_need: "Requires walking aid",
  outcome: "Maintain safe mobility",
  actions: [
    "Ensure walking aid is used",
    "Check equipment condition",
  ],
},
{
  section: "Environment",
  condition: (a) => a.has_bed_rails === true,
  care_need: "Bed rails in use",
  outcome: "Prevent falls from bed",
  actions: [
    "Check bed rail safety",
    "Ensure correct positioning",
  ],
},


  // ⚠️ SAFEGUARDING
  {
    section: "Risks & Safety",
    condition: (a) => a.safeguarding === "concern",
    care_need: "Safeguarding concern",
    outcome: "Ensure safety",
    actions: ["Report immediately", "Follow safeguarding procedure"],
  },
  {
  section: "Risks & Safety",
  condition: (a) => a.safeguarding === "concern",
  care_need: "Safeguarding concern",
  outcome: "Ensure safety",
  actions: ["Report immediately"],
},

//DNACPR
{
  section: "Medical Conditions & Overview",
  condition: (_, client) => client?.dnacpr === true,
  care_need: "DNACPR in place",
  outcome: "Care aligned with wishes",
  actions: ["Ensure staff aware"],
},

//allergies
{
  section: "Medical Conditions & Overview",
  condition: (_, client) => !!client?.allergies,
  care_need: "Allergy risk",
  outcome: "Avoid reactions",
  actions: ["Avoid allergens"],
},

//equipment

{
  section: "Mobility & Moving",
  condition: (a) => a.uses_hoist === true,
  care_need: "Requires hoist",
  outcome: "Safe transfers",
  actions: ["Use hoist correctly"],
},
{
  section: "Environment",
  condition: (a) => a.has_bed_rails === true,
  care_need: "Bed rails in use",
  outcome: "Prevent falls",
  actions: ["Check rails safety"],
},
];

export function generateCareFromMatrix(
  assessments: any,
  client?: any
) {
  const sectionMap: Record<string, any> = {};

  const add = (section: string, rule: Rule) => {
    if (!sectionMap[section]) {
      sectionMap[section] = {
        care_need: [],
        outcome: new Set(),
        actions: new Set(),
      };
    }

    sectionMap[section].care_need.push(rule.care_need);
    sectionMap[section].outcome.add(rule.outcome);
    rule.actions.forEach((a) =>
      sectionMap[section].actions.add(a)
    );
  };

  carePlanMatrix.forEach((rule) => {
    if (rule.condition(assessments, client)) {
      add(rule.section, rule);
    }
  });

  return sectionMap;
}