import { careTypes, getAdditionalCareTypes, defaultCarePlan } from "./careTypes";

type CareTypeKey = keyof typeof careTypes;

type Section = {
  section_title: string;
  care_need: string;
  outcome: string;
  actions: string[];
  priority: number;
  sources: string[];
};

export const generateCarePlan = ({
  client,
  assessments,
}: {
  client: any;
  assessments?: any;
}) => {
  if (!client) return [];

  const baseType = client.care_type?.toLowerCase();

  const extraTypes = getAdditionalCareTypes(
    Array.isArray(client.diagnosis)
      ? client.diagnosis
      : [client.diagnosis]
  );

  const allTypes = [...new Set([baseType, ...extraTypes])];

  const sectionMap: Record<string, Section> = {};

  const upsertSection = (newSection: Section) => {
    const existing = sectionMap[newSection.section_title];

    if (!existing) {
      sectionMap[newSection.section_title] = newSection;
      return;
    }

    if (newSection.priority > existing.priority) {
      sectionMap[newSection.section_title] = newSection;
    } else {
      existing.actions = [
        ...new Set([...existing.actions, ...newSection.actions]),
      ];
      existing.sources = [
        ...new Set([...existing.sources, ...newSection.sources]),
      ];
    }
  };

  // 🟢 1. CARE TYPE BASELINE
  allTypes.forEach((type) => {
    if (!type || !(type in careTypes)) return;

    const key = type as CareTypeKey;
    const config = careTypes[key];

    if (!config?.carePlan) return;

    config.carePlan.forEach((section: any) => {
      upsertSection({
        section_title: section.section_title,
        care_need: section.care_need,
        outcome: section.outcome,
        actions: section.actions || [],
        priority: 1,
        sources: [type],
      });
    });
  });

  // 🟠 2. DIAGNOSIS LAYER
  const diagnosisList = Array.isArray(client.diagnosis)
    ? client.diagnosis
    : [client.diagnosis];

  diagnosisList.forEach((d: string) => {
    const val = d?.toLowerCase();
    if (!val) return;

    if (val.includes("dementia")) {
      upsertSection({
        section_title: "Cognitive Wellbeing",
        care_need: "Progressive cognitive decline",
        outcome: "Maintain orientation and safety",
        actions: ["Use reassurance", "Provide structured routine"],
        priority: 2,
        sources: ["diagnosis:dementia"],
      });
    }

    if (val.includes("diabetes")) {
      upsertSection({
        section_title: "Nutrition & Hydration",
        care_need: "Blood sugar instability risk",
        outcome: "Maintain stable glucose levels",
        actions: ["Monitor diet", "Check blood sugar"],
        priority: 2,
        sources: ["diagnosis:diabetes"],
      });
    }

    if (val.includes("end of life")) {
      upsertSection({
        section_title: "End-of-Life Wishes",
        care_need: "Palliative care needs",
        outcome: "Ensure comfort and dignity",
        actions: ["Pain management", "Respect wishes"],
        priority: 2,
        sources: ["diagnosis:eol"],
      });
    }
  });

  // 🔴 3. ASSESSMENT (HIGHEST PRIORITY)
  if (assessments) {
    if (assessments.hydration === "poor") {
      upsertSection({
        section_title: "Nutrition & Hydration",
        care_need: "Dehydration risk",
        outcome: "Restore hydration",
        actions: ["Encourage fluids", "Track intake closely"],
        priority: 3,
        sources: ["assessment:hydration"],
      });
    }

    if (assessments.mobility === "fall") {
      upsertSection({
        section_title: "Mobility & Moving",
        care_need: "High falls risk",
        outcome: "Prevent injury",
        actions: ["Assist all transfers", "Use aids"],
        priority: 3,
        sources: ["assessment:mobility"],
      });
    }

    if (assessments.medication === "refused") {
      upsertSection({
        section_title: "Medication Support",
        care_need: "Medication refusal",
        outcome: "Improve compliance",
        actions: ["Monitor closely", "Escalate refusal"],
        priority: 3,
        sources: ["assessment:medication"],
      });
    }

    if (assessments.cognition === "impaired") {
      upsertSection({
        section_title: "Cognitive Wellbeing",
        care_need: "Impaired cognition",
        outcome: "Ensure safety and clarity",
        actions: ["Provide reassurance", "Reorient regularly"],
        priority: 3,
        sources: ["assessment:cognition"],
      });
    }
  }

  // 🟡 4. FALLBACK BASELINE (NOW IN CORRECT PLACE)
  if (Object.keys(sectionMap).length === 0) {
    defaultCarePlan.forEach((section) => {
      upsertSection({
        ...section,
        priority: 0,
        sources: ["default"],
      });
    });
  }

  return Object.values(sectionMap);
};