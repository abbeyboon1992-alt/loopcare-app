// 🔹 NORMALISER
const normalise = (str: string): string =>
  str.toLowerCase().replace(/[^a-z]/g, "");

// 🔹 DIAGNOSIS MAP (STRICT TYPED)
const DIAGNOSIS_MAP: Record<string, string[]> = {
  dementia: ["dementia", "alzheimers"],
  autism: ["autism"],
  adhd: ["adhd"],
  learningdisability: ["learningdisability"],
  parkinsons: ["parkinsons"],
  stroke: ["stroke"],
  mentalhealth: ["mentalhealth"],
  epilepsy: ["epilepsy"],
  diabetes: ["diabetes"],
  endoflife: ["endoflife"],
  frailty: ["frailty"],
  delirium: ["delirium"],
  copd: ["copd"],
  heartfailure: ["heartfailure"],
  cancer: ["cancer"],
  hypertension: ["hypertension"],
  osteoporosis: ["osteoporosis"],
  chronicpain: ["chronicpain"],
  substanceuse: ["substanceusedisorder"],
};
export const diagnosisCarePlanTemplates: Record<string, any[]> = {
  dementia: [
    {
      title: "Cognitive Wellbeing",
      care_need: "Cognitive impairment affecting memory and orientation",
      outcome: "Maintain orientation and reduce distress",
      actions: [
        "Provide reassurance",
        "Use simple communication",
        "Maintain routine",
      ],
    },
    {
      title: "Risks & Safety",
      care_need: "Risk of wandering",
      outcome: "Ensure safety",
      actions: [
        "Monitor location",
        "Ensure doors secure",
        "Secure environment",
      ],
    },
  ],

  diabetes: [
    {
      title: "Nutrition & Hydration",
      care_need: "Blood sugar management required",
      outcome: "Maintain stable glucose levels",
      actions: [
        "Monitor food intake",
        "Follow diabetic diet",
      ],
    },
    {
      title: "Medication Support",
      care_need: "Insulin or medication management",
      outcome: "Safe medication administration",
      actions: [
        "Administer insulin if required",
        "Monitor blood glucose",
      ],
    },
  ],

  parkinsons: [
    {
      title: "Mobility & Moving",
      care_need: "Mobility affected by Parkinson’s",
      outcome: "Maintain safe movement",
      actions: [
        "Assist with walking",
        "Ensure aids are used",
      ],
    },
    {
      title: "Nutrition & Hydration",
      care_need: "Risk of swallowing difficulty",
      outcome: "Safe eating and drinking",
      actions: [
        "Follow SALT guidance",
        "Ensure upright positioning",
      ],
    },
  ],

  stroke: [
    {
      title: "Mobility & Moving",
      care_need: "Reduced mobility post-stroke",
      outcome: "Maximise independence",
      actions: [
        "Assist transfers",
        "Follow physio plan",
      ],
    },
    {
      title: "Communication Needs",
      care_need: "Speech or communication difficulty",
      outcome: "Effective communication",
      actions: [
        "Use simple language",
        "Allow time to respond",
      ],
    },
  ],

  copd: [
    {
      title: "Medical Conditions & Overview",
      care_need: "Chronic respiratory condition",
      outcome: "Maintain stable breathing",
      actions: [
        "Monitor breathing",
        "Use oxygen if prescribed",
      ],
    },
  ],

  heartfailure: [
    {
      title: "Medical Conditions & Overview",
      care_need: "Fluid retention risk",
      outcome: "Maintain fluid balance",
      actions: [
        "Monitor swelling",
        "Track weight if required",
      ],
    },
  ],

  epilepsy: [
    {
      title: "Risks & Safety",
      care_need: "Risk of seizures",
      outcome: "Ensure safety during episodes",
      actions: [
        "Follow seizure protocol",
        "Monitor duration",
      ],
    },
  ],

   mentalhealth: [
    {
      title: "Emotional Wellbeing",
      care_need: "Mental health condition impacting daily function",
      outcome: "Improve emotional stability",
      actions: ["Provide reassurance", "Monitor mood", "Encourage engagement"],
    },
  ],

  autism: [
    {
      title: "Communication Needs",
      care_need: "Communication differences",
      outcome: "Improve understanding",
      actions: [
        "Use clear language",
        "Avoid overload",
      ],
    },
    {
      title: "Environment",
      care_need: "Sensory sensitivities",
      outcome: "Reduce distress",
      actions: [
        "Minimise noise",
        "Maintain calm environment",
      ],
    },
  ],

   frailty: [
    {
      title: "Mobility & Moving",
      care_need: "General frailty and weakness",
      outcome: "Maintain mobility and prevent falls",
      actions: ["Assist mobility", "Encourage gentle activity"],
    },
  ],

  endoflife: [
    {
      title: "End-of-Life Wishes",
      care_need: "Palliative care required",
      outcome: "Maintain comfort and dignity",
      actions: ["Follow care plan", "Manage pain", "Support family"],
    },
  ],

  hypertension: [
    {
      title: "Medical Conditions & Overview",
      care_need: "High blood pressure",
      outcome: "Maintain stable BP",
      actions: ["Monitor BP", "Ensure medication compliance"],
    },
  ],
  osteoporosis: [
    {
      title: "Mobility & Moving",
      care_need: "Fragile bones",
      outcome: "Prevent fractures",
      actions: ["Falls prevention", "Safe transfers"],
    },
  ],

  chronicpain: [
    {
      title: "Pain Management",
      care_need: "Chronic pain affecting function",
      outcome: "Reduce pain impact",
      actions: ["Administer medication", "Monitor pain levels"],
    },
  ],

  substanceuse: [
    {
      title: "Risks & Safety",
      care_need: "Substance misuse risk",
      outcome: "Reduce harm",
      actions: ["Monitor behaviour", "Escalate concerns"],
    },
  ],

  delirium: [
    {
      title: "Cognitive Wellbeing",
      care_need: "Acute confusion",
      outcome: "Stabilise cognition",
      actions: ["Monitor closely", "Ensure hydration"],
    },
  ],

  learningdisability: [
    {
      title: "Cognitive Wellbeing",
      care_need: "Support required for decision making",
      outcome: "Promote independence",
      actions: [
        "Use easy-read materials",
        "Support decisions",
      ],
    },
  ],
};
export function generateDiagnosisCarePlan(client: any) {
  if (!client?.diagnosis) return [];

  const list = Array.isArray(client.diagnosis)
    ? client.diagnosis
    : [client.diagnosis];

  const sections: any[] = [];
  const seen = new Set<string>();

  list.forEach((diag: string) => {
    const clean = normalise(diag);

    const matchKey = Object.entries(DIAGNOSIS_MAP).find(
  ([key, values]: [string, string[]]) =>
    values.some((v: string) => clean.includes(v))
)?.[0];

    if (!matchKey) return;

    const templates = diagnosisCarePlanTemplates[matchKey];
    if (!templates) return;

    templates.forEach((section) => {
      const uniqueKey = section.title + section.care_need;

      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        sections.push(section);
      }
    });
  });

  return sections;
}