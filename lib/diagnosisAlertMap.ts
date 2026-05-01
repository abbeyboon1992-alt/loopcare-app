const diagnosisAlertMap: Record<string, string[]> = {
  dementia: ["wandering", "cognition"],
  diabetes: ["nutrition", "hypo_risk"],
  parkinsons: ["mobility", "falls"],
  stroke: ["mobility", "communication"],
  copd: ["breathing"],
  heartfailure: ["fluid_retention"],
  epilepsy: ["seizure"],
  frailty: ["falls", "nutrition"],
  delirium: ["cognition"],
  mentalhealth: ["emotional_distress"],
};
// 🔹 reuse same normaliser (duplicate is fine OR extract to shared util later)
const normalise = (str: string): string =>
  str.toLowerCase().replace(/[^a-z]/g, "");

// 🔹 MUST match your diagnosis map file
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

export function generateDiagnosisAlerts(diagnosis: string[] = []) {
  const alerts: any[] = [];

  diagnosis.forEach((d) => {
    const clean = normalise(d);

    const matchKey = Object.entries(DIAGNOSIS_MAP).find(
      ([, values]) => values.some((v) => clean.includes(v))
    )?.[0];

    if (!matchKey) return;

    const alertTypes = diagnosisAlertMap[matchKey] || [];

    alertTypes.forEach((type: string) => {
      alerts.push({
        type,
        severity: "medium",
        message: `Risk identified: ${type.replace("_", " ")}`,
        source: "diagnosis",
      });
    });
  });

  return alerts;
}