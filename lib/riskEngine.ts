export function generateRisks(form: any) {
  const risks: any[] = [];

  const news2 = Number(form.news2_score || 0);
  const must = Number(form.must_score || 0);
  const waterlow = Number(form.waterlow_score || 0);

  // 🚨 1. ACUTE DETERIORATION (NEWS2)
  if (news2 >= 7) {
    risks.push({
      id: "deterioration_critical",
      category: "clinical",
      severity: "critical",
      title: "Severe deterioration (NEWS2)",
      description: `NEWS2 score ${news2}`,
      actions: [
        "Call 999 immediately",
        "Monitor observations continuously",
        "Escalate to emergency services",
      ],
      review_days: 0,
    });
  } else if (news2 >= 5) {
    risks.push({
      id: "deterioration_high",
      category: "clinical",
      severity: "high",
      title: "Urgent deterioration",
      description: `NEWS2 score ${news2}`,
      actions: [
        "Urgent GP/clinical review",
        "Repeat observations within 1 hour",
      ],
      review_days: 0,
    });
  } else if (news2 >= 3) {
    risks.push({
      id: "deterioration_monitor",
      category: "clinical",
      severity: "medium",
      title: "Early deterioration",
      description: `NEWS2 score ${news2}`,
      actions: [
        "Increase monitoring frequency",
        "Review clinical status",
      ],
      review_days: 1,
    });
  }

  // 🩹 2. SKIN / WATERLOW
  if (waterlow >= 20) {
    risks.push({
      id: "pressure_very_high",
      category: "skin",
      severity: "critical",
      title: "Very high pressure ulcer risk",
      description: `Waterlow score ${waterlow}`,
      actions: [
        "Urgent Tissue Viability referral",
        "Reposition every 2 hours",
        "Use pressure-relieving equipment",
      ],
      review_days: 1,
    });
  } else if (waterlow >= 15) {
    risks.push({
      id: "pressure_high",
      category: "skin",
      severity: "high",
      title: "High pressure ulcer risk",
      description: `Waterlow score ${waterlow}`,
      actions: [
        "Reposition regularly",
        "Monitor skin daily",
      ],
      review_days: 2,
    });
  }

  if (["category 3", "category 4"].includes(form.skin)) {
    risks.push({
      id: "pressure_damage",
      category: "skin",
      severity: "critical",
      title: "Severe pressure damage",
      description: "Advanced pressure ulcer",
      actions: [
        "Immediate District Nurse referral",
        "Wound care plan required",
      ],
      review_days: 1,
    });
  }

  // 🍽️ 3. NUTRITION (MUST)
  if (must >= 2) {
    risks.push({
      id: "malnutrition_high",
      category: "nutrition",
      severity: "high",
      title: "High malnutrition risk",
      description: `MUST score ${must}`,
      actions: [
        "Refer to dietician",
        "Start food/fluid chart",
        "Weekly weight monitoring",
      ],
      review_days: 3,
    });
  } else if (must === 1) {
    risks.push({
      id: "malnutrition_medium",
      category: "nutrition",
      severity: "medium",
      title: "Moderate malnutrition risk",
      actions: [
        "Monitor intake",
        "Encourage nutrition",
      ],
      review_days: 7,
    });
  }

  // 🍴 CHOKING
  if (form.choking === "high") {
    risks.push({
      id: "choking",
      category: "nutrition",
      severity: "high",
      title: "Choking risk",
      actions: [
        "Refer to SALT",
        "Follow IDDSI guidance",
        "Supervise all meals",
      ],
      review_days: 1,
    });
  }

  // 🚶 4. FALLS
  if (form.falls === "multiple falls") {
    risks.push({
      id: "falls_high",
      category: "mobility",
      severity: "high",
      title: "High falls risk",
      actions: [
        "Refer to OT",
        "Ensure equipment in place",
        "Review environment",
      ],
      review_days: 3,
    });
  }

  if (form.mobility === "dependent" || form.mobility === "bed bound") {
    risks.push({
      id: "immobility",
      category: "mobility",
      severity: "medium",
      title: "Immobility risk",
      actions: [
        "Encourage repositioning",
        "Monitor for pressure damage",
      ],
      review_days: 7,
    });
  }

  // 💊 5. MEDICATION
  if (form.medication_ability === "needs prompting") {
    risks.push({
      id: "medication_compliance",
      category: "medication",
      severity: "medium",
      title: "Medication compliance risk",
      actions: [
        "Prompt medication",
        "Monitor adherence",
      ],
      review_days: 7,
    });
  }

  if (form.controlled_drugs === "yes") {
    risks.push({
      id: "controlled_drugs",
      category: "medication",
      severity: "high",
      title: "Controlled drug monitoring",
      actions: [
        "Ensure CD register maintained",
        "Double-check administration",
      ],
      review_days: 1,
    });
  }

  // 🛡️ 6. SAFEGUARDING
  if (form.safeguarding === "concern") {
    risks.push({
      id: "safeguarding",
      category: "safeguarding",
      severity: "critical",
      title: "Safeguarding concern",
      actions: [
        "Report immediately",
        "Follow safeguarding procedures",
      ],
      review_days: 0,
    });
  }

  return risks;
}