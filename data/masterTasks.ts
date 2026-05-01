export type MasterTask = {
  category: string;
  name: string;
  description: string;
  care_types?: string[];
  diagnosis?: string[];
  always?: boolean;
  prompts?: string[];
};
export const masterTasks: MasterTask[] = [
  {
  category: "Capacity, Consent",
  name: "📝 Consented to care",
  description: "Consent recorded",
  care_types: ["elderly", "mental_health", "child"],
  diagnosis: ["other"],
  always: true,
  prompts: [
    "Was consent explicitly given?",
    "How was consent communicated?",
    "Any concerns about understanding or coercion?"
  ]
},
{
  category: "Capacity, Consent",
  name: "🧠 Capacity assessed",
  description: "Capacity assessed",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["dementia", "alzheimers", "learning disability", "mental_health", "delirium"],
  always: false,
  prompts: [
    "What decision was capacity assessed for?",
    "Did the client demonstrate understanding, retention, and communication?",
    "Outcome of assessment?"
  ]
},
   {
  category: "Capacity, Consent",
  name: "⚖️ Best interest decision followed",
  description: "Best interest decision logged",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["dementia", "alzheimers", "learning disability", "mental_health"],
  always: false,
  prompts: [
    "What decision was made in best interest?",
    "Who was involved in the decision?",
    "Was the least restrictive option considered?"
  ]
},
  {
    category: "Communication",
    name: "👂Hearing aids",
    description: "Hearing aids",
    care_types: ["elderly"],
    diagnosis: ["frailty"],
    always: false,
  },
  {
    category: "Communication",
    name: "👓 Glasses",
    description: "Glasses",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Communication",
    name: "🖼️Picture cards",
    description: "Picture Cards",
    care_types: ["child"],
    diagnosis: ["autism", "learning disability"],
    always: false,
  },
   {
    category: "Communication",
    name: "🧏 Sign language",
    description: "Sign language",
    care_types: ["child", "mental_health"],
    diagnosis: ["learning disability"],
    always: false,
  },
  {
    category: "Communication",
    name: "Communication",
    description: "Other",
    care_types: ["elderly", "mental_health", "child"],
    diagnosis: ["other"],
    always: true,
  },

   // 🔥 PERSONAL CARE (CORE = ALWAYS TRUE)
  {
  category: "Personal Care (ADLs)",
  name: "🛁 Bathing / showering / bed bath",
  description: "Bathing / showering / bed bath",
  care_types: ["elderly"],
  diagnosis: ["frailty", "stroke", "parkinson’s"],
  always: true,
  prompts: [
    "Type of wash provided?",
    "Level of assistance required?",
    "Skin condition observed?"
  ]
},
  {
    category: "Personal Care (ADLs)",
    name: "👕 Dressing / undressing",
    description: "Dressing / undressing",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
    category: "Personal Care (ADLs)",
    name: "🦷 Oral hygiene (teeth, dentures)",
    description: "Oral hygiene (teeth, dentures)",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
    category: "Personal Care (ADLs)",
    name: "💇 Hair care / shaving",
    description: "Hair care / shaving",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: true,
  },
  {
  category: "Personal Care (ADLs)",
  name: "🚽 Toileting support",
  description: "Toileting support",
  care_types: ["elderly"],
  diagnosis: ["frailty", "stroke"],
  always: true,
  prompts: [
    "Was assistance required?",
    "Any signs of constipation or discomfort?",
    "Output normal?"
  ]
},
  {
    category: "Personal Care (ADLs)",
    name: "🩲 Continence care (pads changed)",
    description: "Continence care (pads changed)",
    care_types: ["elderly"],
    diagnosis: ["frailty", "stroke"],
    always: true,
  },
  {
  category: "Personal Care (ADLs)",
  name: "🧴 Skin care (creams, pressure areas)",
  description: "Skin care (creams, pressure areas)",
  care_types: ["elderly"],
  diagnosis: ["frailty", "diabetes"],
  always: true,
  prompts: [
    "Areas treated?",
    "Any redness, sores, or breakdown?",
    "Creams applied as prescribed?"
  ]
},
  {
    category: "Personal Care (ADLs)",
    name: "🛏️ Repositioning (pressure relief)",
    description: "Repositioning (pressure relief)",
    care_types: ["elderly"],
    diagnosis: ["frailty", "stroke"],
    always: false,
  },
  {
    category: "Personal Care (ADLs)",
    name: "💅 Nails checked",
    description: "Nails checked",
    care_types: ["elderly"],
    diagnosis: ["diabetes"],
    always: false,
  },

  // 🍽️ NUTRITION
  {
    category: "Nutrition & Hydration",
    name: "🍳 Meal preparation",
    description: "Meal preparation",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
  category: "Nutrition & Hydration",
  name: "🍽️ Meal support / feeding",
  description: "Meal support / feeding",
  care_types: ["elderly", "child"],
  diagnosis: ["stroke", "frailty"],
  always: true,
  prompts: [
    "Was assistance required?",
    "Amount eaten?",
    "Any swallowing difficulties?"
  ]
},
  {
  category: "Nutrition & Hydration",
  name: "🥤Fluids offered",
  description: "Fluids offered",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["dementia", "frailty"],
  always: true,
  prompts: [
    "How much fluid was taken?",
    "Any refusal or difficulty?",
    "Signs of dehydration (dry mouth, confusion, low output)?"
  ]
},
  {
    category: "Nutrition & Hydration",
    name: "☕ Snacks / drinks provided",
    description: "Snacks / drinks provided",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
  category: "Nutrition & Hydration",
  name: "⚠️ Appetite concerns",
  description: "Appetite concerns",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["cancer", "mental_health"],
  always: false,
  prompts: [
    "Reduced appetite noted?",
    "Duration of concern?",
    "Any weight loss or refusal?"
  ]
},

  // 🧹 DAILY LIVING
  {
    category: "Daily Living",
    name: "🧹Cleaning / tidying",
    description: "Cleaning / tidying",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "🧺Laundry / ironing",
    description: "Laundry / ironing",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "🛏️Bed making / linen change",
    description: "Bed making / linen change",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "🛒Shopping / errands",
    description: "Shopping / errands",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "🗑️Waste disposal",
    description: "Waste disposal",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "🔌Appliance safety check",
    description: "Appliance safety check",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Daily Living",
    name: "📦Stocking essentials",
    description: "Stocking essentials",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
   // 💬 WELLBEING
  {
  category: "Emotional Wellbeing",
  name: "💬Companionship / conversation",
  description: "Companionship / conversation",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["mental_health", "dementia"],
  always: true,
  prompts: [
    "Engagement level?",
    "Mood during interaction?",
    "Any concerns raised?"
  ]
},
  {
    category: "Emotional Wellbeing",
    name: "😊Emotional support",
    description: "Emotional support",
    care_types: ["mental_health"],
    diagnosis: ["mental_health"],
    always: true,
  },
   {
    category: "Emotional Wellbeing",
    name: "🎲Activities / hobbies",
    description: "Activities / hobbies",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
    category: "Emotional Wellbeing",
    name: "🚶Walks / outings",
    description: "Walks / outings",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
   {
    category: "Emotional Wellbeing",
    name: "🧠Cognitive stimulation",
    description: "Cognitive stimulation",
    care_types: ["elderly"],
    diagnosis: ["dementia", "alzheimers"],
    always: false,
  },
   {
    category: "Emotional Wellbeing",
    name: "👨‍👩‍👧Family interaction support",
    description: "Family interaction support",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
  {
  category: "Emotional Wellbeing",
  name: "📣Mood / behaviour monitoring",
  description: "Mood / behaviour monitoring",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["mental_health", "dementia"],
  always: true,
  prompts: [
    "Mood observed?",
    "Any behavioural changes?",
    "Triggers or patterns noticed?"
  ]
},
  // ❤️ HEALTH
 {
  category: "Medical Conditions & Overview",
  name: "🩸Blood pressure",
  description: "Blood pressure",
  care_types: ["elderly"],
  diagnosis: ["hypertension", "heart failure"],
  always: false,
  prompts: [
    "Reading recorded?",
    "Within normal range?",
    "Any symptoms (dizziness, headache)?"
  ]
},
  {
    category: "Medical Conditions & Overview",
    name: "❤️Pulse check",
    description: "Pulse check",
    care_types: ["elderly"],
    diagnosis: ["heart failure"],
    always: false,
  },
  {
    category: "Medical Conditions & Overview",
    name: "🌡️Temperature",
    description: "Temperature",
    care_types: ["elderly", "child"],
    diagnosis: ["infection", "other"],
    always: false,
  },
   {
    category: "Medical Conditions & Overview",
    name: "⚖️Weight monitoring",
    description: "Weight monitoring",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Medical Conditions & Overview",
    name: "🫁Oxygen saturation",
    description: "Oxygen saturation",
    care_types: ["elderly"],
    diagnosis: ["copd"],
    always: false,
  },
 {
  category: "Medical Conditions & Overview",
  name: "😣Pain level tracking",
  description: "Pain level tracking",
  care_types: ["elderly", "mental_health"],
  diagnosis: ["chronic pain", "cancer"],
  always: true,
  prompts: [
    "Pain score (0–10)?",
    "Location of pain?",
    "Pain relief given and effect?"
  ]
},
  {
    category: "Medical Conditions & Overview",
    name: "🚶Mobility assessments",
    description: "Mobility assessments",
    care_types: ["elderly"],
    diagnosis: ["frailty", "stroke"],
    always: true,
  },
    {
    category: "Medical Conditions & Overview",
    name: "⚠️Falls risk monitoring",
    description: "Falls risk monitoring",
    care_types: ["elderly"],
    diagnosis: ["frailty", "parkinson’s"],
    always: true,
  },

  // 🔒 SAFETY
  {
    category: "Risks & Safety",
    name: "🔒Doors / windows secured",
    description: "Doors / windows secured",
    care_types: ["elderly"],
    diagnosis: ["dementia"],
    always: true,
  },
  {
    category: "Risks & Safety",
    name: "🔥Fire safety check",
    description: "Fire safety check",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Risks & Safety",
    name: "⚡Electrical safety check",
    description: "Electrical safety check",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
    category: "Risks & Safety",
    name: "🧯Equipment checked",
    description: "Equipment checked",
    care_types: ["elderly"],
    diagnosis: ["other"],
    always: false,
  },
  {
  category: "Risks & Safety",
  name: "🧼Infection control (PPE used)",
  description: "Infection control (PPE used)",
  care_types: ["elderly", "child"],
  diagnosis: ["other"],
  always: true,
  prompts: [
    "PPE used?",
    "Any infection risks identified?",
    "Hand hygiene completed?"
  ]
},
   {
    category: "Risks & Safety",
    name: "🧤Hand hygiene followed",
    description: "Hand hygiene followed",
    care_types: ["elderly", "child"],
    diagnosis: ["other"],
    always: true,
  },
 {
  category: "Risks & Safety",
  name: "⚠️Hazards identified & logged",
  description: "Hazards identified & logged",
  care_types: ["elderly"],
  diagnosis: ["other"],
  always: true,
  prompts: [
    "What hazard was identified?",
    "Immediate action taken?",
    "Was it escalated or logged?"
  ]
},
   // 📘 COMPLIANCE
  {
  category: "Compliance",
  name: "📘 Care plan updated",
  description: "Care plan updated",
  care_types: ["elderly", "mental_health", "child"],
  diagnosis: ["other"],
  always: false,
  prompts: [
    "What was updated?",
    "Reason for update?",
    "Does it reflect current needs?"
  ]
},
  {
  category: "Compliance",
  name: "👨‍👩‍👧 Communicated with family",
  description: "Family communication recorded",
  care_types: ["elderly", "child"],
  diagnosis: ["other"],
  always: false,
  prompts: [
    "Who was contacted?",
    "What was discussed?",
    "Any follow-up required?"
  ]
},
  {
    category: "Compliance",
    name: "📞 Professionals updated in care",
    description: "Professional updates logged",
    care_types: ["elderly"],
    diagnosis: ["other", "end of life"],
    always: false,
  },
];