"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, Suspense } from "react";
import { canAccessFeature } from "@/lib/featureAccess";
import { createReferral } from "@/lib/referralEngine";
import { supabase } from "@/lib/supabase";
import EvidenceBlock from "@/components/assessment/evidenceBlock";
import { mergeAlerts } from "@/lib/mergeAlerts";
import { generateDiagnosisAlerts } from "@/lib/diagnosisAlertMap";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { generateRisks } from "@/lib/riskEngine";
import { saveAlerts, generateAssessmentAlerts } from "@/lib/alertEngine";
import { generateTasks } from "@/lib/taskEngine";
import { useMemo } from "react"; 
import React from "react";
import { syncTasksWithCarePlan } from "@/lib/carePlanTaskEngine";
import { assessmentVisibility } from "@/lib/assessmentVisibility";
import { useParams } from "next/navigation";

import { useAccess } from "@/app/context/AccessContext";
import {
  generateCarePlan,
  applyAlertsToCarePlan,
  removeResolvedActionsFromCarePlan,
} from "@/lib/carePlanEngine";
const toISODate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};
const fromISODate = (value: string | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0]; // YYYY-MM-DD for inputs
};
const safeDateDiffDays = (date: string | null | undefined) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
};
const calculateAge = (dob: string | null | undefined) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};
type SectionProps = {
  title: string;
  options: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  disabled?: boolean;
};
function Section({
  title,
  options,
  value,
  onChange,
  multi = false,
  disabled = false,
}: SectionProps) {
  const toggleValue = (opt: string) => {
    if (!multi) {
      onChange(opt);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    if (current.includes(opt)) {
      onChange(current.filter((v) => v !== opt));
    } else {
      onChange([...current, opt]);
    }
  };
  
  
  return (
    <div className="mb-6">
      <p className="mb-2">{title}</p>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((opt) => {
          const isActive = multi
  ? Array.isArray(value) && value.includes(opt)
  : String(value) === String(opt);
          return (
            <button
            type="button"
  key={opt}
  onClick={() => toggleValue(opt)}
  disabled={disabled}
  className={`px-3 py-2 rounded-md border text-sm ${
    disabled
      ? "opacity-50 cursor-not-allowed"
      : isActive
      ? "bg-blue-600 text-white border-blue-500"
      : "bg-[var(--card)] text-gray-200 border-[#475569]"
  }`}
>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
const CommunicationBox = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => {
  return (
    <textarea
  placeholder="Describe communication needs"
  value={value || ""}
  disabled={disabled}
  onChange={(e) => onChange(e.target.value)}
  className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
/>
  );
};
const TextAreaField = ({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  return (
    <textarea
      value={value || ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-3 text-base mb-4 rounded bg-[var(--card)] text-white"
    />
  );
};
function AssessmentPageContent() {
  const searchParams = useSearchParams();
const clientId = searchParams.get("client") || "";
  const [form, setForm] = useState<any>({
  client_id: clientId || "",
  hydration: "",
  nutrition: "",
  mobility: "",
  toileting: [],
  continence_ability: "",
  pad_type: "",
pad_delivery: "",
date_of_birth: "",
catheter_type: "",
stoma_type: "",
  mood: "",
  medications_list: "",
  medication_ability: "",
  pain: "",
  pain_impact: "",
  safeguarding: "",
  cognition: "",
  last_reviewed: "",
choking: "",
iddsi: "",
dnacpr: "",
equipment: [],
equipment_serviced: {},
equipment_last_service: {},
equipment_other: "",
  skin: "",
  repositioning_required: "",
  falls: "",
  falls_risk: "",
  capacity: "",
  communication: "",
  environment: "",
  washing: "",
  dressing: "",
  eating: "",
  safeguarding_notes: "",
  medical_conditions: "",
  allergies: "",
  dn_last_visit: "",
ot_last_review: "",
salt_last_review: "",
mdt_last_meeting: "",
mental_health_status: "",
mental_health_impact: "",
medication_review_date: "",
controlled_drugs: "",
best_interest_required: "",
best_interest_completed: false,
mca_completed: false,
communication_support: "",
fluid_level: "",
nutrition_notes: "",
respiratory_status: 0,
respiratory_support: "",
weight: 0,
weight_history: "",
height: 0,
bmi: 0,
must_score: 0,
unplanned_weight_loss: "",
escalation_plan: "",
early_warning_signs: "",
baseline_observations: "",
pressure_area_risk: "",
waterlow_score: 0,
skin_integrity_details: "",
wound_care_plan: "",
capacity_assessed_for: "",
capacity_assessment_date: "",
decision_type: "",
prn_protocol: "",
medication_side_effects: "",
medication_compliance_risk: "",
risk_trend: "",
last_deterioration: "",
baseline_status: "",
safeguarding_referral_made: "",
safeguarding_date: "",
safeguarding_outcome: "",
consent_obtained: "",
consent_type: "",
advance_decision: "",
lpa_health_welfare: "",
cognition_source: [],
cognition_evidence: false,
nutrition_source: [],
nutrition_evidence: false,
mobility_source: [],
mobility_evidence: false,
skin_source: [],
skin_evidence: false,
medication_source: [],
medication_evidence: false,
safeguarding_source: [],
safeguarding_evidence: false,
status: "in_progress",
version_number: 1,
review_type: "",
update_reason: "",
locked: false,
acute_disease_effect: "",
weight_3_months_ago: "",
resp_rate: 0,
oxygen_sats: 0,
oxygen_scale: "1",
on_oxygen: "no",
temperature: 0,
pulse: 0,
consciousness: "",
frailty_score: 0,
news2_score: 0,
bmi_category: "",
waterlow_medication_risk: "",
});
const safeForm = {
  ...form,

  // 🔒 ensure arrays exist
  equipment: form.equipment || [],
  medications: form.medications || [],
  flags: form.flags || [],

  // 🔒 ensure objects exist
  equipment_serviced: form.equipment_serviced || {},
  equipment_last_service: form.equipment_last_service || {},
  baseline_observations: form.baseline_observations || {},

  // 🔒 prevent input lock
  weight: form.weight ?? "",
  height: form.height ?? "",
  resp_rate: form.resp_rate ?? "",
  oxygen_sats: form.oxygen_sats ?? "",
  temperature: form.temperature ?? "",
  pulse: form.pulse ?? "",
};

useEffect(() => {
  if (!clientId || hasLoadedRef.current) return;
  hasLoadedRef.current = true;

  const loadAssessment = async () => {
    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      console.error("Load error:", error);
      return;
    }

    if (!data) return;

    setHasSavedAssessment(true);
    if (!data) {
  setForm((prev: any) => ({
    ...prev,
    client_id: id,
  }));
}

    setForm((prev: any) => ({
      ...prev,
      ...data,

      // ✅ HARDEN DATA (CRITICAL)
      equipment: Array.isArray(data.equipment) ? data.equipment : [],
      equipment_serviced:
        typeof data.equipment_serviced === "object" && data.equipment_serviced
          ? data.equipment_serviced
          : {},
      equipment_last_service:
        typeof data.equipment_last_service === "object" && data.equipment_last_service
          ? data.equipment_last_service
          : {},

      medications: Array.isArray(data.medications) ? data.medications : [],
      flags: Array.isArray(data.flags) ? data.flags : [],

      // ✅ sources always arrays
      cognition_source: Array.isArray(data.cognition_source) ? data.cognition_source : [],
      nutrition_source: Array.isArray(data.nutrition_source) ? data.nutrition_source : [],
      mobility_source: Array.isArray(data.mobility_source) ? data.mobility_source : [],
      skin_source: Array.isArray(data.skin_source) ? data.skin_source : [],
      medication_source: Array.isArray(data.medication_source) ? data.medication_source : [],
      safeguarding_source: Array.isArray(data.safeguarding_source) ? data.safeguarding_source : [],

      // ✅ booleans
      cognition_evidence: data.cognition_evidence === true,
      nutrition_evidence: data.nutrition_evidence === true,
      mobility_evidence: data.mobility_evidence === true,
      skin_evidence: data.skin_evidence === true,
      medication_evidence: data.medication_evidence === true,
      safeguarding_evidence: data.safeguarding_evidence === true,
    }));
  };

  loadAssessment();
}, [clientId]);
  
const params = useParams();
const id = Array.isArray(params?.id) ? params.id[0] : params?.id; 
// 🔥 ORG
const [organisationId, setOrganisationId] = useState<string | null>(null);

// 🔥 EVIDENCE
const [evidenceList, setEvidenceList] = useState<any[]>([]);

// 🔥 MEDICATIONS
const [medications, setMedications] = useState<any[]>([]);

// 🔥 UI STATE
const [viewMode, setViewMode] = useState(false);
const [pdfMode, setPdfMode] = useState<"standard" | "family">("standard");
const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
const [loading, setLoading] = useState(false);
  const isUserTypingRef = useRef(false);
  const router = useRouter();
const [referral, setReferral] = useState({
  type: "",
  details: "",
});
const generatePDF = async () => {
  const element =
    pdfMode === "family"
      ? document.getElementById("family-pdf")
      : document.getElementById("pdf-content");
  if (!element) return;
  const html2pdf = (await import("html2pdf.js")).default;
  html2pdf()
    .set({
      margin: 0.5,
      filename: `assessments-${pdfMode}-${form.client_id}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
};
  
const hasEvidenceToUpload = () => {
  return [
    form.cognition_evidence,
    form.nutrition_evidence,
    form.mobility_evidence,
    form.skin_evidence,
    form.medication_evidence,
    form.safeguarding_evidence,
  ].some(Boolean);
};
const client = {
  id: clientId,
  diagnosis: form.diagnosis || [],
};
const calculateMUST = () => {
  if (!form.weight || !form.height) return 0;
  const bmi = Number(form.bmi);
  let score = 0;
  // BMI score
  if (bmi < 18.5) score += 2;
  else if (bmi < 20) score += 1;
  // Weight loss %
  if (form.weight_3_months_ago) {
    const oldWeight = Number(form.weight_3_months_ago);
    const current = Number(form.weight);
    const loss = ((oldWeight - current) / oldWeight) * 100;
    if (loss > 10) score += 2;
    else if (loss > 5) score += 1;
  }
  // Acute disease effect
  if (form.acute_disease_effect === "yes") {
    score += 2;
  }
  return score;
};
const calculateWaterlow = () => {
  let score = 0;
  const bmi = Number(form.bmi);
  const age = calculateAge(form.date_of_birth) || 0;
  // 🔹 BMI
  if (bmi < 18.5) score += 3;
  else if (bmi < 20) score += 2;
  else if (bmi > 30) score += 1;
  // 🔹 SKIN
  if (form.skin === "at risk") score += 1;
  if (form.skin === "category 1") score += 2;
  if (form.skin === "category 2") score += 3;
  if (form.skin === "category 3") score += 4;
  if (form.skin === "category 4") score += 5;
  // 🔹 MOBILITY
  if (form.mobility === "needs support") score += 2;
  if (form.mobility === "dependent") score += 3;
  if (form.mobility === "bed bound") score += 4;
  // 🔹 CONTINENCE
  if (form.toileting?.includes("incontinent")) score += 3;
  if (form.toileting?.includes("catheter")) score += 2;
  // 🔹 AGE
  if (age >= 75) score += 3;
  else if (age >= 65) score += 2;
  else if (age >= 50) score += 1;
  // 🔹 MEDICATION
  if (form.waterlow_medication_risk === "yes") score += 2;
  return score;
};
const calculateNEWS2 = () => {
  let score = 0;
  const rr = Number(form.resp_rate);
  const sats = Number(form.oxygen_sats);
  const temp = Number(form.temperature);
  const pulse = Number(form.pulse);
  const consciousness = form.consciousness;
  const oxygen = form.on_oxygen;
  const scale = form.oxygen_scale;
  // 🔹 RESPIRATORY RATE
  if (rr <= 8) score += 3;
  else if (rr <= 11) score += 1;
  else if (rr <= 20) score += 0;
  else if (rr <= 24) score += 2;
  else if (rr >= 25) score += 3;
  // 🔹 OXYGEN SATS (SCALE 1 - default)
  if (scale === "1") {
    if (sats <= 91) score += 3;
    else if (sats <= 93) score += 2;
    else if (sats <= 95) score += 1;
    else if (sats >= 96) score += 0;
  }
  // 🔹 OXYGEN SATS (SCALE 2 - COPD etc)
  if (scale === "2") {
    if (sats <= 83) score += 3;
    else if (sats <= 85) score += 2;
    else if (sats <= 87) score += 1;
    else if (sats <= 92) score += 0;
    else if (sats >= 93) score += 3;
  }
  // 🔹 OXYGEN SUPPLEMENT
  if (oxygen === "yes") score += 2;
  // 🔹 TEMPERATURE
  if (temp <= 35) score += 3;
  else if (temp <= 36) score += 1;
  else if (temp <= 38) score += 0;
  else if (temp <= 39) score += 1;
  else if (temp >= 39.1) score += 2;
  // 🔹 PULSE
  if (pulse <= 40) score += 3;
  else if (pulse <= 50) score += 1;
  else if (pulse <= 90) score += 0;
  else if (pulse <= 110) score += 1;
  else if (pulse <= 130) score += 2;
  else if (pulse >= 131) score += 3;
  // 🔹 CONSCIOUSNESS (ACVPU)
  if (consciousness && consciousness !== "alert") {
    score += 3;
  }
  return score;
};
const blockIfView = (fn: () => void) => {
  if (viewMode) return;
  fn();
};
  useEffect(() => {
  const loadOrg = async () => {
    const { data } = await supabase.auth.getUser();

    if (!data?.user) return;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organisation_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profile?.organisation_id) {
      setOrganisationId(profile.organisation_id);
    }
  };

  loadOrg();
}, []);
const [prompts, setPrompts] = useState<any[]>([]);
  const [openSection, setOpenSection] = useState<string | null>("cognition");
const [hasLoaded, setHasLoaded] = useState(false);
const [timeline, setTimeline] = useState<any[]>([]);
const [isTyping, setIsTyping] = useState(false);
const [conflicts, setConflicts] = useState<any[]>([]);
const [recentVisits, setRecentVisits] = useState<any[]>([]);
const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);
const [showSafeguardingForm, setShowSafeguardingForm] = useState(false);
type SafeguardingFormType = {
  category: string;
  other_category: string;
  urgency: string;
  description: string;
  body_map_location: string;
  photo_urls: string;
  action_taken: string;
  follow_up: string;
  follow_up_date: string;
  reported_to: string;
};
const [safeguardingForm, setSafeguardingForm] =
  useState<SafeguardingFormType>({
    category: "",
    other_category: "",
    urgency: "",
    description: "",
    body_map_location: "",
    photo_urls: "",
    action_taken: "",
    follow_up: "",
    follow_up_date: "",
    reported_to: "",
  });
  const CATEGORY_OPTIONS = [
  { value: "Physical", label: "Physical" },
  { value: "Emotional/Psychological", label: "Emotional / Psychological" },
  { value: "Sexual", label: "Sexual" },
  { value: "Neglect/Acts of Omission", label: "Neglect / Acts of Omission" },
  { value: "Self-Neglect", label: "Self-Neglect" },
  { value: "Financial/Material", label: "Financial / Material" },
  { value: "Domestic Abuse", label: "Domestic Abuse" },
  { value: "Discriminatory", label: "Discriminatory" },
  { value: "Organisational", label: "Organisational" },
  { value: "Modern Slavery", label: "Modern Slavery" },
  { value: "Other", label: "Other" },
];
const handleLogConcern = async () => {
  if (!safeguardingForm.category) {
  alert("Please select a category");
  return;
}
  if (!clientId) {
    alert("No client selected.");
    return;
  }
  setIsSubmittingReferral(true);
  const { data: { user } } = await supabase.auth.getUser();
  console.log("🚨 CATEGORY DEBUG:", {
  category: safeguardingForm.category,
  other_category: safeguardingForm.other_category,
});
  const { error } = await supabase
  .from("concern_records")
  .insert([
    {
      client_id: clientId,
      organisation_id: organisationId || undefined,
      category: safeguardingForm.category,
other_category:
  safeguardingForm.category === "Other"
    ? safeguardingForm.other_category
    : null,
      urgency: safeguardingForm.urgency?.toLowerCase(),
      description: safeguardingForm.description,
      body_map_location: safeguardingForm.body_map_location,
      photo_urls: safeguardingForm.photo_urls
  ? [safeguardingForm.photo_urls]
  : [],
follow_up: safeguardingForm.follow_up
  ? [safeguardingForm.follow_up]
  : [],
      action_taken: safeguardingForm.action_taken,
      reported_to: safeguardingForm.reported_to,
      follow_up_date: safeguardingForm.follow_up_date || null,
      status: "open",
      created_by: user?.id,
      created_at: new Date().toISOString(),
    },
  ]);
    await supabase.from("alerts").insert({
  client_id: clientId,
  organisation_id: organisationId || undefined,
  type: "safeguarding",
  severity: safeguardingForm.urgency,
  message: safeguardingForm.description,
  status: "active",
});
  if (error) {
    console.error("Error logging concern:", error.message);
    alert("Failed to save to concern_records: " + error.message);
  } else {
    alert("Concern successfully logged!");
    setShowSafeguardingForm(false);
    // Reset form
    setSafeguardingForm({
  category: "",
  other_category: "",
  urgency: "",
  description: "",
  body_map_location: "",
  photo_urls: "",
  action_taken: "",
  follow_up: "",
  follow_up_date: "",
  reported_to: "",
});
  }
  setIsSubmittingReferral(false);
};
const handleSafeguardingInput = (
  field: keyof SafeguardingFormType,
  value: string
) => {
  setSafeguardingForm(prev => ({
    ...prev,
    [field]: value
  }));
};
const [selectedMcaId, setSelectedMcaId] = useState<string | null>(null);
const [selectedBiId, setSelectedBiId] = useState<string | null>(null);
const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
const formRef = useRef(form);
const lastSavedRef = useRef<string>("");
const isSavingRef = useRef(false);
const hasInitialised = useRef(false);
const hasSyncedRef = useRef(false);
const isUpdatingRef = useRef(false);
const [hasSavedAssessment, setHasSavedAssessment] = useState(false);
let access;

try {
  access = useAccess();
} catch (e) {
  console.error("Access context failed:", e);
  access = null;
}
// ✅ SAFE DEFAULTS (fixes TS error properly)
const plan = access && typeof access === "object" && "plan" in access ? access.plan : "free";
const accountType = access && typeof access === "object" && "accountType" in access ? access.accountType : "solo";
const isTrialActive = access && typeof access === "object" && "isTrialActive" in access ? access.isTrialActive : false;
const visibility =
  assessmentVisibility[accountType as keyof typeof assessmentVisibility] ||
  assessmentVisibility.solo;
const hasAssessmentAccess = canAccessFeature(
  "assessments",
  plan,
  accountType,
  isTrialActive
);
const hasMCAAccess = canAccessFeature(
  "mcaAssessment",
  plan,
  accountType,
  isTrialActive
);
const hasSmartAlertsAccess = canAccessFeature(
  "smartAlerts",
  plan,
  accountType,
  isTrialActive
);
const [mcaList, setMcaList] = useState<any[]>([]);
const [biList, setBiList] = useState<any[]>([]);
const [bestInterest, setBestInterest] = useState<any>(null);
const initialSectionRef = useRef<string | null>(null);

useEffect(() => {
  if (!initialSectionRef.current) {
    initialSectionRef.current = searchParams.get("section");
  }
}, [searchParams]);
useEffect(() => {
  if (isUpdatingRef.current) return;
  if (!form.capacity) return;
  if (
    form.capacity === "lacks capacity" &&
    form.best_interest_required !== "yes"
  ) {
    isUpdatingRef.current = true;
    setForm((prev: any) => ({
      ...prev,
      best_interest_required: "yes",
    }));
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }
}, [form.capacity]);
useEffect(() => {
  formRef.current = form;
}, [form]);
const handleInput = (field: string, value: any) => {
  isUserTypingRef.current = true;

  setForm((prev: any) => {
    if (field === "baseline_observations") {
      return {
        ...prev,
        baseline_observations: {
          ...(prev.baseline_observations || {}),
          ...(typeof value === "object" ? value : {}),
        },
      };
    }

    return {
      ...prev,
      [field]: value,
    };
  });

  // 🔥 release typing lock shortly after
  setTimeout(() => {
    isUserTypingRef.current = false;
  }, 300);
};
useEffect(() => {
  if (isUserTypingRef.current) return;

  if (saveTimeout.current) clearTimeout(saveTimeout.current);

  saveTimeout.current = setTimeout(async () => {
    if (isSavingRef.current) return;

    const payload = formRef.current;
    const current = JSON.stringify(payload);

    if (current === lastSavedRef.current) return;

    try {
      isSavingRef.current = true;
      setSaving("saving");

      await supabase
        .from("assessments")
        .upsert(payload, { onConflict: "client_id" });

      lastSavedRef.current = current;
      setSaving("saved");
    } catch (err) {
      console.error(err);
      setSaving("error");
    } finally {
      isSavingRef.current = false;
    }
  }, 1200);

  return () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
  };
}, [form]);
const handleEquipmentServiced = (item: string, value: "yes" | "no") => {
  setForm((prev: any) => ({
    ...prev,
    equipment_serviced: {
      ...(prev.equipment_serviced || {}),
      [item]: value,
    },
  }));
};
const handleEquipmentDate = (item: string, date: string | null) => {
  setForm((prev: any) => ({
    ...prev,
    equipment_last_service: {
      ...(prev.equipment_last_service || {}),
      [item]: date,
    },
  }));
};
const handleFileUpload = async (
  file: File,
  section: string,
  field: string
) => {
  if (!form.client_id || !organisationId) {
    alert("Missing client or organisation");
    return;
  }
  const filePath = `${form.client_id}/${section}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("assessment-evidence")
    .upload(filePath, file);
  if (uploadError) {
    console.error(uploadError);
    alert("Upload failed");
    return;
  }
  const { data } = supabase.storage
    .from("assessment-evidence")
    .getPublicUrl(filePath);
  await supabase.from("assessment_evidence").insert({
    client_id: form.client_id,
    organisation_id: organisationId || undefined,
    section,
    field,
    file_url: data.publicUrl,
    file_name: file.name,
    file_type: file.type,
  });
  // 🔥 refresh list
  setEvidenceList((prev) => [
    ...prev,
    {
      section,
      field,
      file_url: data.publicUrl,
      file_name: file.name,
    },
  ]);
};
const addMedication = () => {
  setMedications((prev: any[]) => [
    ...prev,
    { name: "", dose: "", frequency: "", route: "", time_of_day: "" },
  ]);
};

const removeMedication = (index: number) => {
  setMedications((prev: any[]) =>
    prev.filter((_, i) => i !== index)
  );
};

const updateMedication = (index: number, field: string, value: string) => {
  setMedications((prev: any[]) =>
    prev.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    )
  );
};
useEffect(() => {
  if (!clientId) return;

  setForm((prev: any) => ({
    ...prev,
    client_id: clientId,
  }));
}, [clientId]);
const hasLoadedRef = useRef(false);
useEffect(() => {
  const loadAssessment = async () => {
    if (!clientId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (data) {
  setHasSavedAssessment(true); // ✅ THIS IS THE KEY
  setForm((prev: any) => ({
  ...prev,
  ...data,
  // ✅ ensure correct types
    cognition: data.cognition || "",
    communication: data.communication || "",
    cognition_evidence: data.cognition_evidence === true,
nutrition_evidence: data.nutrition_evidence === true,
mobility_evidence: data.mobility_evidence === true,
skin_evidence: data.skin_evidence === true,
medication_evidence: data.medication_evidence === true,
safeguarding_evidence: data.safeguarding_evidence === true,
cognition_source: Array.isArray(data.cognition_source)
  ? data.cognition_source
  : data.cognition_source
  ? [data.cognition_source]
  : [],
nutrition_source: Array.isArray(data.nutrition_source)
  ? data.nutrition_source
  : data.nutrition_source
  ? [data.nutrition_source]
  : [],
mobility_source: Array.isArray(data.mobility_source)
  ? data.mobility_source
  : data.mobility_source
  ? [data.mobility_source]
  : [],
skin_source: Array.isArray(data.skin_source)
  ? data.skin_source
  : data.skin_source
  ? [data.skin_source]
  : [],
medication_source: Array.isArray(data.medication_source)
  ? data.medication_source
  : data.medication_source
  ? [data.medication_source]
  : [],
safeguarding_source: Array.isArray(data.safeguarding_source)
  ? data.safeguarding_source
  : data.safeguarding_source
  ? [data.safeguarding_source]
  : [],
    // ✅ FIX CRASH
    equipment: Array.isArray(data.equipment)
      ? data.equipment
      : data.equipment
      ? [data.equipment]
      : [],
    // ✅ FUTURE-PROOF
    equipment_serviced:
      typeof data.equipment_serviced === "object" &&
      data.equipment_serviced !== null
        ? data.equipment_serviced
        : {},
  }));
}
    setHasLoaded(true); // ✅ LOCK AFTER FIRST LOAD
    if (error) {
      console.error("Load error:", error.message);
    }
  };
  loadAssessment();
}, [clientId, hasLoaded]);
useEffect(() => {
  if (form.locked) {
    setViewMode(true);
  }
}, [form.locked]);
useEffect(() => {
  if (!clientId) return;
  const loadVersion = async () => {
    const { data } = await supabase
      .from("assessment_versions")
      .select("version_number")
      .eq("client_id", clientId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setForm((prev: any) => ({
        ...prev,
        version_number: data.version_number + 1,
      }));
    }
  };
  loadVersion();
}, [clientId]);
useEffect(() => {
  if (!clientId) return;
  const loadMCA = async () => {
    const { data } = await supabase
      .from("mca_assessments")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (data) setMcaList(data);
  };
 const loadBI = async () => {
  if (!clientId) return;

  const { data } = await supabase
    .from("best_interest_decisions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return;

  setBiList(data);

  // 🔥 THIS IS THE KEY FIX
  setBestInterest(data[0]); // latest record
};
  loadMCA();
  loadBI();
}, [clientId]);
useEffect(() => {
  if (!clientId) return;

  const hasMCA = mcaList.length > 0;

  const hasBI =
    form.best_interest_required === "yes"
      ? biList.length > 0
      : true;

  setForm((prev: any) => ({
    ...prev,
    mca_completed: hasMCA,
    best_interest_completed: hasBI,
  }));
}, [mcaList, biList]);
useEffect(() => {
  if (!clientId) return;
  const loadMeds = async () => {
    const { data } = await supabase
      .from("medications")
      .select("*")
      .eq("client_id", clientId);
    if (data) {
      setMedications(data);
    }
  };
  loadMeds();
}, [clientId]);
useEffect(() => {
  if (!clientId) return;
  const loadEvidence = async () => {
    const { data } = await supabase
      .from("assessment_evidence")
      .select("*")
      .eq("client_id", clientId);
    if (data) setEvidenceList(data);
  };
  loadEvidence();
}, [clientId]);
useEffect(() => {
  if (!clientId) return;
  const loadPrompts = async () => {
    const { data } = await supabase
      .from("assessment_prompt")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPrompts(data);
  };
  loadPrompts();
}, [clientId]);
useEffect(() => {
  if (!clientId) return;
  const loadVisits = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (data) setRecentVisits(data);
  };
  loadVisits();
}, [clientId]);
useEffect(() => {
  const must = calculateMUST();
  setForm((prev: any) => {
    if (prev.must_score === must) return prev;
    return { ...prev, must_score: must };
  });
}, [
  form.weight,
  form.height,
  form.weight_3_months_ago,
  form.acute_disease_effect,
]);
useEffect(() => {
  const score = calculateWaterlow();
  setForm((prev: any) => {
    if (prev.waterlow_score === score) return prev;
    return { ...prev, waterlow_score: score };
  });
}, [
  form.bmi,
  form.skin,
  form.mobility,
  form.toileting,
  form.waterlow_medication_risk,
]);
useEffect(() => {
  const score = calculateNEWS2();
  setForm((prev: any) => {
    if (prev.news2_score === score) return prev;
    return { ...prev, news2_score: score };
  });
}, [
  form.resp_rate,
  form.oxygen_sats,
  form.temperature,
  form.pulse,
  form.consciousness,
  form.on_oxygen,
  form.oxygen_scale,
]);
const detectConflict = (visits: any[], field: string) => {
  if (visits.length < 2) return false;
  const last3 = visits.slice(-3).map((v) => v[field]);
  const uniqueValues = [...new Set(last3)];
  return uniqueValues.length > 1;
};
const createPrompt = async ({
  type,
  message,
  suggested_value,
  source_visit_id,
}: any) => {
  const { data } = await supabase.auth.getUser();
  // 🚫 prevent duplicates
  const { data: existing } = await supabase
    .from("assessment_prompt")
    .select("id")
    .eq("client_id", form.client_id)
    .or(`type.eq.${type},type.eq.${type}_low`)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;
  await supabase.from("assessment_prompt").insert({
    client_id: form.client_id,
    organisation_id: organisationId || undefined,
    type,
    message,
    suggested_value,
    created_by: data?.user?.id,
    source_visit_id,
    status: "pending",
  });
};
const evaluateConfidence = (visits: any[], field: string, value: any, count = 2) => {
  const recent = visits.slice(-count);
  if (recent.length < count) return false;
  return recent.every((v) => v[field] === value);
};
const detectTrend = (visits: any[], field: string) => {
  if (visits.length < 3) return null;
  const last3 = visits.slice(-3).map((v) => v[field]);
  // worsening logic (example for nutrition)
  if (
    last3.includes("poor") &&
    last3.filter((v) => v === "poor").length >= 2
  ) {
    return "worsening";
  }
  // improving logic
  if (
    last3.includes("adequate") &&
    last3.filter((v) => v === "adequate").length >= 2
  ) {
    return "improving";
  }
  return null;
};
const syncAssessmentFromVisits = async ({
  visits,
  form,
  setForm,
  setPrompts,
}: any) => {
  if (!visits || visits.length < 2) return;
  const lastVisit = visits[visits.length - 1];
  const updates: any = {};
  const nutritionTrend = detectTrend(visits, "nutrition");
const mobilityTrend = detectTrend(visits, "mobility");
if (nutritionTrend === "worsening" || mobilityTrend === "worsening") {
    updates.risk_trend = "declining";
  }
  if (nutritionTrend === "improving" && mobilityTrend === "improving") {
    updates.risk_trend = "improving";
  }
  const autoUpdates: any[] = [];
  // 🧠 RULE 2 — MOBILITY DECLINE
  if (
    evaluateConfidence(visits, "mobility", "needs support", 2) &&
    form.mobility === "independent"
  ) {
    updates.mobility = "needs support";
    autoUpdates.push({
      field: "mobility",
      value: "needs support",
      reason: "Decline observed across visits",
    });
  }
  // 🧠 RULE 3 — NUTRITION WORSENING
  if (nutritionTrend === "worsening" && form.nutrition !== "poor") {
    updates.nutrition = "poor";
    autoUpdates.push({
      field: "nutrition",
      value: "poor",
      reason: "Worsening trend detected",
    });
  }
  // 🚫 NOTHING TO UPDATE
  if (Object.keys(updates).length === 0) return;
  // ✅ APPLY UPDATE TO UI
  setForm((prev: any) => ({
  ...prev,
  ...updates,
}));
  // ✅ SAVE TO DB
  await supabase
    .from("assessments")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", form.client_id);
  // 🧾 LOG VERSION (AUDIT TRAIL)
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("assessment_versions").insert({
    client_id: form.client_id,
    organisation_id: organisationId || undefined,
    version_number: form.version_number,
    data: updates,
    review_type: "auto_update",
    update_reason: "Auto-updated from visit trends",
    created_by: userData?.user?.id || null,
  });
  // 🧠 OPTIONAL — CLEAN PROMPTS (avoid duplicates)
  setPrompts((prev: any[]) =>
    prev.filter(
      (p) =>
        !autoUpdates.some((u) => p.type?.includes(u.field))
    )
  );
  console.log("✅ AUTO UPDATED:", autoUpdates);
};
useEffect(() => {
  if (!recentVisits.length) return;
  if (hasSyncedRef.current) return;
  hasSyncedRef.current = true;
  syncAssessmentFromVisits({
    visits: recentVisits,
    form: formRef.current, // ✅ use ref not state
    setForm,
    setPrompts,
  });
}, [recentVisits]);
const lastVisit = recentVisits?.[recentVisits.length - 1];
  // 🔥 AUTO RESOLVE ALERTS FROM VISIT DATA
const autoResolveAlerts = async () => {
  if (!lastVisit) return;
  const updates: string[] = [];
  // ✅ SKIN IMPROVED
  if (lastVisit.skin === "intact") {
    updates.push("skin_pressure");
  }
  // ✅ NUTRITION IMPROVED
  if (lastVisit.nutrition === "adequate") {
    updates.push("nutrition");
  }
  // ✅ HYDRATION IMPROVED
  if (lastVisit.hydration === "adequate") {
    updates.push("hydration");
  }
  // ✅ MEDICATION TAKEN
  if (lastVisit.medication === "taken") {
    updates.push("medication");
  }
  // 🚫 NOTHING TO RESOLVE
  if (updates.length === 0) return;
  // 🔥 UPDATE ALERTS
  for (const type of updates) {
    await supabase
      .from("alerts")
      .update({
        status: "resolved",
        closed_at: new Date().toISOString(),
      })
      .eq("client_id", form.client_id)
      .eq("type", type)
      .eq("status", "active");
  }
};
const hasResolvedRef = useRef(false);
useEffect(() => {
  if (!recentVisits.length) return;
  if (hasResolvedRef.current) return;
  hasResolvedRef.current = true;
  autoResolveAlerts();
}, [recentVisits]);
  useEffect(() => {
  const conflicts: any[] = [];
  if (detectConflict(recentVisits, "skin")) {
    conflicts.push({
      field: "skin",
      message: "Conflicting skin records detected",
    });
  }
  if (detectConflict(recentVisits, "mobility")) {
    conflicts.push({
      field: "mobility",
      message: "Conflicting mobility records detected",
    });
  }
  if (detectConflict(recentVisits, "nutrition")) {
    conflicts.push({
      field: "nutrition",
      message: "Conflicting nutrition records detected",
    });
  }
  setConflicts(conflicts);
  if (conflicts.length > 0) return;
  // KEEP EXISTING PROMPT LOGIC HERE
}, [recentVisits]);
useEffect(() => {
  if (!recentVisits.length) return;
  // 🚫 STOP PROMPTS IF CONFLICT EXISTS
  if (conflicts.length > 0) return;
  const lastVisit = recentVisits[recentVisits.length - 1];
  // 🔥 SKIN IMPROVEMENT
  if (
    evaluateConfidence(recentVisits, "skin", "intact", 3) &&
    form.skin === "pressure sore"
  ) {
    createPrompt({
      type: "skin_improved",
      message:
        "Skin appears improved across multiple visits. Update assessments?",
      suggested_value: {
        skin: "intact",
      },
      source_visit_id: lastVisit.id,
    });
  }
  // 🔥 NUTRITION TREND
  const nutritionTrend = detectTrend(recentVisits, "nutrition");
  if (nutritionTrend === "worsening") {
    createPrompt({
      type: "nutrition_decline",
      message:
        "Nutrition declining across recent visits — review required",
      suggested_value: {
        nutrition: "poor",
      },
      source_visit_id: lastVisit.id,
    });
  }
  // 🔥 MOBILITY DECLINE
  if (
    evaluateConfidence(recentVisits, "mobility", "needs support", 2) &&
    form.mobility === "independent"
  ) {
    createPrompt({
      type: "mobility_decline",
      message:
        "Mobility reduced across visits — update assessments?",
      suggested_value: {
        mobility: "needs support",
      },
      source_visit_id: lastVisit.id,
    });
  }
}, [recentVisits, conflicts, form]);
useEffect(() => {
  if (!clientId) return;
  const loadTimeline = async () => {
    // 🔹 VISITS
    const { data: visits } = await supabase
      .from("visit_notes")
      .select("id, created_at, notes, user_id")
      .eq("client_id", clientId);
    // 🔹 PROMPTS
    const { data: prompts } = await supabase
      .from("assessment_prompt")
      .select("*")
      .eq("client_id", clientId);
    // 🔹 VERSIONS
    const { data: versions } = await supabase
      .from("assessment_versions")
      .select("*")
      .eq("client_id", clientId);
    // 🔥 MERGE INTO TIMELINE
    const events: any[] = [];
    visits?.forEach((v) => {
      events.push({
        type: "visit",
        date: v.created_at,
        label: "Visit logged",
        description: v.notes,
        user_id: v.user_id,
      });
    });
    prompts?.forEach((p) => {
      events.push({
        type: "prompt",
        date: p.created_at,
        label: "Suggestion created",
        description: p.message,
        user_id: p.created_by,
      });
      if (p.status === "accepted" || p.status === "ignored") {
        events.push({
          type: "prompt_action",
          date: p.actioned_at,
          label:
            p.status === "accepted"
              ? "Suggestion accepted"
              : "Suggestion ignored",
          description: p.message,
          user_id: p.actioned_by,
        });
      }
    });
    versions?.forEach((v) => {
      events.push({
        type: "version",
        date: v.created_at,
        label: `assessments updated (v${v.version_number})`,
        description: v.update_reason,
        user_id: v.created_by,
      });
    });
    // 🔥 SORT BY DATE
    events.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
    setTimeline(events);
  };
  loadTimeline();
}, [clientId]);
const bmi = (() => {
  if (!form.weight || !form.height) return 0;
  const h = Number(form.height) / 100;
  const w = Number(form.weight);
  if (h <= 0) return 0;
  return Number((w / (h * h)).toFixed(1));
})();
const calculateScore = () => {
  let score = 0;

  // 🔹 BASIC RISKS
  if (form.hydration === "poor" || form.hydration === "refused") score += 3;
  if (form.nutrition === "poor" || form.nutrition === "refused") score += 3;
  if (form.falls_risk === "high") score += 3;
  if (form.falls === "multiple falls") score += 4;
  if (form.skin === "pressure sore") score += 4;
  if (form.safeguarding === "concern") score += 5;
  if (form.capacity === "lacks capacity") score += 2;
  if (form.cognition === "moderate" || form.cognition === "severe") score += 2;
  if (form.communication === "non-verbal") score += 2;
  if (form.environment === "unsafe") score += 3;
  if (form.washing === "dependent") score += 2;
  if (form.dressing === "dependent") score += 2;
  if (form.eating === "dependent") score += 2;
  if (form.pain === "severe") score += 2;

  // MUST
  const must = Number(form.must_score || 0);
  if (must >= 2) score += 6;
  else if (must === 1) score += 3;

  // weight loss
  if (form.unplanned_weight_loss === "yes") score += 4;

  // BMI
  const bmi = Number(form.bmi);
  if (bmi < 18.5) score += 4;
  if (bmi > 30) score += 1;

  return score;
};
const score = useMemo(() => {
  if (!form) return 0;
  return calculateScore();
}, [form]);
const bmiCategory = (() => {
  if (!bmi) return "";
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obese";
})();
  const hasScrolledRef = useRef(false);

useEffect(() => {
  if (hasScrolledRef.current) return;

  const section = initialSectionRef.current;
  if (!section) return;

  const el = document.getElementById(section);
  if (el) {
    el.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  }

  hasScrolledRef.current = true;
}, []);
const SOURCE_OPTIONS = [
  "observation",
  "family",
  "gp",
  "dn",
  "ot",
  "physio",
  "salt",
  "pharmacy",
  "mar_chart",
  "care_plan",
  "hospital",
  "dietician",
  "tissue viability",
  "social_worker",
  "other",
];
useEffect(() => {
  if (!clientId) return;
  const loadClient = async () => {
    const { data } = await supabase
      .from("clients")
      .select("date_of_birth")
      .eq("id", clientId)
      .maybeSingle();
    if (data?.date_of_birth) {
  setForm((prev: any) => ({
    ...prev,
    date_of_birth: data.date_of_birth,
  }));
}
  };
  loadClient();
}, [clientId])


const calculateFlags = (form: any) => {
  const flags: string[] = [];

  if (form.news2_score >= 5) flags.push("clinical_deterioration");
  if (form.must_score >= 2) flags.push("malnutrition_risk");
  if (form.falls_risk === "high") flags.push("falls_risk");
  if (form.safeguarding === "concern") flags.push("safeguarding");
  if (form.medication_compliance_risk === "high") flags.push("medication_risk");

  return flags;
};
const age = calculateAge(form.date_of_birth);

// ✅ SECTION COMPLETION LOGIC (SMART + CONDITIONAL)

const sectionChecks = {
  cognition: () => {
  if (!form.capacity || !form.cognition || !form.communication) {
    return false;
  }

  if (
    form.capacity === "lacks capacity" ||
    form.capacity === "fluctuating"
  ) {
    if (!form.mca_completed) return false;

    if (form.best_interest_required === "yes") {
      if (!form.best_interest_completed) return false;
    }
  }

  return true;
},

  nutrition: () =>
    form.hydration && form.nutrition,

  mobility: () =>
    form.mobility && form.falls_risk,

  toileting: () => {
    if (!form.toileting || form.toileting.length === 0) return false;

    if (form.toileting.includes("incontinent")) {
      return form.continence_ability;
    }

    return true;
  },

  medication: () => {
    // ✅ no meds = not applicable = complete
    if (medications.length === 0) return true;

    return form.medication_ability;
  },

  safeguarding: () => {
    if (form.safeguarding === "concern") {
      return form.safeguarding_notes;
    }
    return true;
  },

  clinical: () =>
    form.dnacpr && form.pain,

  daily: () =>
    form.washing && form.dressing && form.eating,

  medical: () =>
    form.medical_conditions,

  review: () =>
    form.last_reviewed,
};

const getSectionStatus = (sectionId: string) => {
  const hasValue = (val: any) => {
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim() !== "";
    if (typeof val === "number") return true;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return false;
  };

  switch (sectionId) {
    case "cognition": {
      const hasCapacity = hasValue(form.capacity);
      const hasCognition = hasValue(form.cognition);
      const hasCommunication = hasValue(form.communication);

      if (!hasCapacity && !hasCognition && !hasCommunication) {
        return "empty";
      }

      if (!(hasCapacity && hasCognition && hasCommunication)) {
        return "in_progress";
      }

      if (
        form.capacity === "lacks capacity" ||
        form.capacity === "fluctuating"
      ) {
        if (!form.mca_completed) return "attention";

        if (
          form.best_interest_required === "yes" &&
          !form.best_interest_completed
        ) {
          return "attention";
        }
      }

      return "complete";
    }

    case "nutrition": {
      const hasHydration = hasValue(form.hydration);
      const hasNutrition = hasValue(form.nutrition);

      if (!hasHydration && !hasNutrition) return "empty";
      if (hasHydration && hasNutrition) return "complete";
      return "in_progress";
    }

    case "mobility": {
      const hasMobility = hasValue(form.mobility);
      const hasFalls = hasValue(form.falls_risk);

      if (!hasMobility && !hasFalls) return "empty";
      if (hasMobility && hasFalls) return "complete";
      return "in_progress";
    }

    case "toileting": {
      const hasToileting = hasValue(form.toileting);

      if (!hasToileting) return "empty";

      if (form.toileting.includes("incontinent")) {
        return hasValue(form.continence_ability)
          ? "complete"
          : "in_progress";
      }

      return "complete";
    }

    case "medication": {
      if (medications.length === 0) return "empty";

      return hasValue(form.medication_ability)
        ? "complete"
        : "in_progress";
    }

    case "safeguarding": {
      if (!hasValue(form.safeguarding)) return "empty";

      if (
        form.safeguarding === "concern" &&
        !hasValue(form.safeguarding_outcome) // ✅ FIXED FIELD
      ) {
        return "attention";
      }

      return "complete";
    }

    case "clinical": {
      const hasDnacpr = hasValue(form.dnacpr);
      const hasPain = hasValue(form.pain);

      if (!hasDnacpr && !hasPain) return "empty";
      if (hasDnacpr && hasPain) return "complete";
      return "in_progress";
    }

    case "daily": {
      const hasWashing = hasValue(form.washing);
      const hasDressing = hasValue(form.dressing);
      const hasEating = hasValue(form.eating);

      if (!hasWashing && !hasDressing && !hasEating) return "empty";
      if (hasWashing && hasDressing && hasEating) return "complete";
      return "in_progress";
    }

    case "medical": {
      if (!hasValue(form.medical_conditions)) return "empty";
      return "complete";
    }

    case "review": {
      if (!hasValue(form.last_reviewed)) return "attention";
      return "complete";
    }

    default:
      return "empty";
  }
};

const getSectionProgress = (sectionId: string) => {
  const status = getSectionStatus(sectionId);

  if (status === "complete") return 100;
  if (status === "in_progress") return 50;
  if (status === "attention") return 25;

  return 0;
};

const calculateSectionConfidence = (sectionId: string) => {
  let score = 0;

  const hasValue = (val: any) => {
  if (val === null || val === undefined) return false;

  if (typeof val === "string") return val.trim() !== "";

  if (typeof val === "number") return true;

  if (Array.isArray(val)) return val.length > 0;

  if (typeof val === "object") return Object.keys(val).length > 0;

  return false;
};

  const sources = form[`${sectionId}_source`] || [];
  const hasEvidence = form[`${sectionId}_evidence`] === true;
  const documents = evidenceList.filter(
    (e) => e.section === sectionId
  );

  // 🔹 1. DATA PRESENT (40 pts)
  switch (sectionId) {
    case "cognition":
      if (hasValue(form.capacity)) score += 15;
      if (hasValue(form.cognition)) score += 15;
      if (hasValue(form.communication)) score += 10;
      break;

    case "nutrition":
      if (hasValue(form.hydration)) score += 20;
      if (hasValue(form.nutrition)) score += 20;
      break;

    case "mobility":
      if (hasValue(form.mobility)) score += 20;
      if (hasValue(form.falls_risk)) score += 20;
      break;

    case "skin":
      if (hasValue(form.skin)) score += 30;
      break;

    case "medication":
      if (medications.length > 0) score += 20;
      if (hasValue(form.medication_ability)) score += 20;
      break;

    case "safeguarding":
      if (hasValue(form.safeguarding)) score += 20;
      if (form.safeguarding === "concern" && hasValue(form.safeguarding_notes))
        score += 20;
      break;
  }

  // 🔹 2. SOURCES (30 pts)
  if (sources.length >= 2) score += 30;
  else if (sources.length === 1) score += 15;

  // 🔹 3. EVIDENCE FLAG (15 pts)
  if (hasEvidence) score += 15;

  // 🔹 4. DOCUMENT UPLOAD (15 pts)
  if (documents.length > 0) score += 15;

  return Math.min(score, 100);
};

const getConfidenceLevel = (score: number) => {
  if (score >= 80) return { label: "High", color: "green" };
  if (score >= 50) return { label: "Medium", color: "yellow" };
  return { label: "Low", color: "red" };
};

const getProgress = () => {
  const sections = Object.keys(sectionChecks);

  const scores = sections.map((section) => {
    const status = getSectionStatus(section);

    // 🔒 ignore completely empty sections
    if (status === "empty") return null;

    if (status === "complete") return 1;
    if (status === "in_progress") return 0.5;
    if (status === "attention") return 0.25;

    return 0;
  });

  const validScores = scores.filter((s) => s !== null);

  if (validScores.length === 0) return 0;

  const total = validScores.reduce((a: number, b: number) => a + b, 0);

  return Math.round((total / validScores.length) * 100);
};

const generateFlagAlerts = (flags: string[]) => {
  return flags.map((f) => ({
    type: f,
    severity: "high",
    message: f.replace(/_/g, " "),
  }));
};
const generateAISummary = (form: any, score: number) => {
  return `
Client has ${form.mobility || "unknown"} mobility,
${form.nutrition || "unknown"} nutrition,
and ${form.falls_risk || "unknown"} falls risk.

Overall risk score: ${score}.
`;
};
  const handleSubmit = async () => {
  setLoading(true);
  const lowConfidenceSections = [
  "cognition",
  "nutrition",
  "mobility",
  "clinical",
].filter((section) => calculateSectionConfidence(section) < 50);

if (lowConfidenceSections.length > 0) {
  alert(
    `Cannot complete assessment.\nLow confidence in: ${lowConfidenceSections.join(", ")}`
  );
  return;
}

  const riskScore = calculateScore();
const flags = calculateFlags(form);

const aiRiskScore = riskScore + (flags.length * 2);

  // ✅ DETERMINE STATUS PROPERLY
  let status = "completed";

  if (!form.hydration || !form.mobility) {
    status = "partial";
  }
  const autoFlags = calculateFlags(form);
const manualFlags = form.flags || [];
const combinedFlags = [...new Set([...autoFlags, ...manualFlags])];
  // 💾 SAVE assessments
  const cleanedForm = {
  ...Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      value === "" ? null : value,
    ])
  ),
  cognition_source: form.cognition_source || [],
  nutrition_source: form.nutrition_source || [],
  mobility_source: form.mobility_source || [],
  skin_source: form.skin_source || [],
  medication_source: form.medication_source || [],
  safeguarding_source: form.safeguarding_source || [],
  ai_summary: generateAISummary(form, riskScore),
ai_last_updated: new Date().toISOString(),
mca_completed: form.mca_completed,
best_interest_completed: form.best_interest_completed,
};

const { data, error } = await supabase
  .from("assessments")
  .upsert(
    {
      ...cleanedForm,
client_id: form.client_id,
risk_score: riskScore,
ai_risk_score: aiRiskScore,
requires_review: flags.length > 0,
safeguarding_flag: flags.includes("safeguarding"),
status,
flags: combinedFlags,
locked: true,
    },
    { onConflict: "client_id" }
  );

  // 🔥 GENERATE ALERTS
  const diagnosisAlerts = generateDiagnosisAlerts(client.diagnosis || []);
const rawAlerts = [
  ...generateDiagnosisAlerts(client.diagnosis),
  ...generateAssessmentAlerts(form),
];

const alerts = mergeAlerts(rawAlerts);

// 🔥 SAVE ALERTS
await saveAlerts({
  alerts,
  clientId: form.client_id,
});

// 🔥 GENERATE CARE PLAN
const carePlan = generateCarePlan(cleanedForm, alerts);

// 🔥 OPTIONAL: persist care plan here if needed

// 🔥 GENERATE TASKS
const tasks = generateTasks(carePlan, alerts);

// 🔥 OPTIONAL: save tasks if not already handled

// 📊 CREATE BASELINE VISIT (🔥 CRITICAL FOR GRAPHS)
await supabase.from("visit_notes").insert({
  client_id: form.client_id,
  organisation_id: organisationId || undefined,
  hydration: form.hydration,
  nutrition: form.nutrition,
  mood: form.mood || "neutral",
  mobility: form.mobility,
  skin: form.skin,
  medication: form.medication_ability === "independent" ? "taken" : "needs support",
  notes: "Baseline created from assessments",
  type: "baseline",
});

  if (error) {
    alert(error.message);
    setLoading(false);
    return;
  }

  // 🧾 SAVE VERSION SNAPSHOT
const { data: userData } = await supabase.auth.getUser();

await supabase.from("assessment_versions").insert({
  client_id: form.client_id,
  organisation_id: organisationId || undefined,
  version_number: form.version_number,
  data: cleanedForm,
  review_type: form.review_type || "initial",
  update_reason: form.update_reason || "Initial assessments",
  created_by: userData?.user?.id,
});

  // 💊 SAVE MEDICATIONS
if (medications.length > 0) {
  // delete old first (clean replace)
  await supabase
    .from("medications")
    .delete()
    .eq("client_id", form.client_id);

  await supabase.from("medications").insert(
    medications.map((m) => ({
      client_id: form.client_id,
      organisation_id: organisationId || undefined,
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      route: m.route,
      time_of_day: m.time_of_day,
      active: true,
    }))
  );
}   

 // 🚨 GENERATE FULL CARE SYSTEM (PRO ONLY)
if (hasSmartAlertsAccess) {
  await supabase
    .from("alerts")
    .delete()
    .eq("client_id", form.client_id)
    .eq("source", "assessments");

  const flags = calculateFlags(form);

const flagAlerts = generateFlagAlerts(flags);
const globalAlerts = generateAssessmentAlerts(form);
const risks = generateRisks(form);

const allAlerts = [
  ...flagAlerts,
  ...risks.map((r: any) => ({
    message: r.title,
    severity: r.severity,
    type: r.id,
    source: "assessments",
  })),
  ...globalAlerts.map((a: any) => ({
    ...a,
    source: "assessments",
  })),
];

const carePlan = generateCarePlan(form, alerts);

// ✅ APPLY ALERTS TO CARE PLAN (CORRECT)
await applyAlertsToCarePlan({
  clientId: id as string,
  alerts: allAlerts,
});
await syncTasksWithCarePlan(form.client_id);

await removeResolvedActionsFromCarePlan({
  clientId: form.client_id,
  activeAlerts: allAlerts,
});

await saveAlerts({
  clientId: form.client_id,
  organisation_id: organisationId || undefined,
  visit_id: null,
  alerts: allAlerts,
});

alerts.forEach((a) => {
  if (a.type === "safeguarding") {
    tasks.push({
      title: "Escalate safeguarding concern immediately",
      category: "safeguarding",
      description: "Safeguarding concern identified — requires immediate escalation",
      prompts: ["Notify manager", "Complete safeguarding referral"],
      due: new Date().toISOString(),
      status: "pending",
      linked_alert_type: a.type,
      priority: "high",
    });
  }

  if (a.type === "nutrition") {
    tasks.push({
      title: "Monitor food and fluid intake",
      category: "nutrition",
      description: "Nutrition risk identified — monitor intake closely",
      prompts: ["Encourage meals", "Record intake"],
      due: new Date().toISOString(),
      status: "pending",
      linked_alert_type: a.type,
      priority: "high",
    });
  }

  if (a.type === "falls") {
    tasks.push({
      title: "Implement falls prevention measures",
      category: "mobility",
      description: "Falls risk identified — ensure safety measures are in place",
      prompts: ["Check environment", "Review equipment"],
      due: new Date().toISOString(),
      status: "pending",
      linked_alert_type: a.type,
      priority: "high",
    });
  }
});

 

if (tasks?.length) {
  await supabase.from("visit_tasks").insert(
    tasks.map((t: any) => ({
      client_id: form.client_id,
      organisation_id: organisationId || undefined,
      task: t.title, // ✅ FIXED
      priority: t.priority || "normal",
      status: "pending",
    }))
  );
}

}

// ✅ ALWAYS RUN (OUTSIDE PRO BLOCK)
setLoading(false);

setForm((prev: any) => ({
  ...prev,
  status,
}));
setHasSavedAssessment(true);

// 🔥 SMART FLOW
if (form.capacity === "lacks capacity" || form.capacity === "fluctuating") {
  if (form.best_interest_required === "yes") {
    router.push(`/best-interest?client=${form.client_id}`);
  } else {
    router.push(`/mca?client=${form.client_id}`);
  }
} else {
  router.push(`/client?id=${form.client_id}`);
}
  };

const MultiSelectDropdown = ({
  value = [],
  onChange,
  options,
  placeholder = "Select sources",
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) => {
  return (
    <select
      multiple
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map(
          (o) => o.value
        );
        onChange(selected);
      }}
      className="w-full p-3 rounded bg-[var(--card)] text-white min-h-[120px]"
    >
      <option disabled value="">
        {placeholder}
      </option>

      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};

const getImmediateAlerts = () => {
  const alerts = [];

  if (form.safeguarding_flag) {
  alerts.push("🚨 Safeguarding flag raised — immediate escalation required");
}

  if (Number(form.frailty_score) >= 7) {
  alerts.push("🚨 Severe frailty — high risk of deterioration");
}

  if (Number(form.news2_score) >= 7) {
  alerts.push("🚨 NEWS2 ≥7 — Call 999 / emergency response required");
}

if (Number(form.news2_score) >= 5) {
  alerts.push("⚠️ NEWS2 ≥5 — Urgent GP / clinical review required");
}

if (Number(form.news2_score) >= 3) {
  alerts.push("⚠️ NEWS2 ≥3 — Increase monitoring frequency");
}

  if (form.skin === "pressure sore") {
    alerts.push("🚨 Pressure sore → Contact District Nurse immediately");
  }

  if (form.falls_risk === "high") {
  alerts.push("🚨 High falls risk — full risk assessments required");

  if (!form.equipment || form.equipment.length === 0) {
    alerts.push("⚠️ No equipment in place — urgent OT referral required");
  }
}

  if (form.choking === "high") {
    alerts.push("🚨 Choking risk → SALT referral required");
  }

  if (form.safeguarding === "concern") {
    alerts.push("🚨 Safeguarding concern → escalate immediately");
  }

  // MUST HIGH RISK
if (Number(form.must_score) >= 2) {
  alerts.push("🚨 High malnutrition risk...");
}

// BMI UNDERWEIGHT
if (Number(form.bmi) < 18.5) {
  alerts.push("🚨 Underweight — monitor intake and escalate");
}

// BMI OBESE
if (Number(form.bmi) >= 30) {
  alerts.push("⚠️ Obesity risk — monitor mobility & cardiovascular health");
}

   if (form.mdt_last_meeting) {
    const diff = safeDateDiffDays(form.mdt_last_meeting);

if (diff !== null && diff > 365) {
  alerts.push("⚠️ MDT review overdue (12+ months)");
}
  }

  if (
  form.medication_review_date &&
  medications.length > 0
) {
    const diff =
      new Date().getTime() -
      new Date(form.medication_review_date).getTime();

    if (diff > 1000 * 60 * 60 * 24 * 180) {
      alerts.push("🚨 Medication review overdue (6+ months)");
    }
  }

  if (form.controlled_drugs === "yes") {
    alerts.push("⚠️ Controlled drugs in use → ensure monitoring");
  }

  // 🔥 EARLY WARNING SIGNS
if (form.early_warning_signs) {
  alerts.push("🚨 Early warning signs identified — monitor closely and escalate if needed");
}

// 🔥 ESCALATION PLAN
if (form.escalation_plan) {
  alerts.push("⚠️ Escalation plan in place — ensure staff follow protocol");
}

// 🔥 LAST DETERIORATION
if (form.last_deterioration) {
  const days = safeDateDiffDays(form.last_deterioration);

  if (days !== null && days < 7) {
    alerts.push("🚨 Recent deterioration — increased monitoring required");
  }
}

// 🔥 PRESSURE AREA RISK
if (form.pressure_area_risk === "high") {
  alerts.push("🚨 High pressure area risk — repositioning + skin monitoring required");
}

// 🔥 WOUND CARE PLAN
if (form.wound_care_plan) {
  alerts.push("⚠️ Wound care in place — ensure dressing regime followed");
}

// 🔥 MEDICATION SIDE EFFECTS
if (form.medication_side_effects) {
  alerts.push("⚠️ Medication side effects reported — review required");
}

  return alerts;
};
const daysSinceReview = safeDateDiffDays(form.last_reviewed);
const isOverdue =
  daysSinceReview !== null && daysSinceReview > 30;
  const SectionWrapper = ({
  id,
  title,
  progress,
  children,
  disabled,
}: {
  id: string;
  title: string;
  progress: number;
  children: React.ReactNode;
  disabled?: boolean;
}) => {
  const isOpen = openSection === id;
  return (
    <div id={id} className="bg-[var(--card)] rounded mb-4 overflow-hidden">
      {/* HEADER */}
      <div
  onClick={() => setOpenSection(isOpen ? null : id)}
  className="flex justify-between items-center p-4 cursor-pointer"
>
  <div>
    <h2 className="font-semibold">{title}</h2>

    {/* 🔥 CONFIDENCE DISPLAY */}
    {(() => {
      const score = calculateSectionConfidence(id);
      const level = getConfidenceLevel(score);

      return (
        <div className="text-xs mt-1 flex items-center gap-2">
          <span className="text-[var(--muted)]">
            Confidence: {score}%
          </span>

          <span
            className={`px-2 py-0.5 rounded text-black ${
              level.color === "green"
                ? "bg-green-400"
                : level.color === "yellow"
                ? "bg-yellow-400"
                : "bg-red-400"
            }`}
          >
            {level.label}
          </span>
        </div>
      );
    })()}
  </div>

  <div className="flex items-center gap-3">
    <span className="text-xs text-[var(--muted)]">
      {progress}%
    </span>
    <span className="text-sm">{isOpen ? "▲" : "▼"}</span>
  </div>
</div>

      {/* CONTENT */}
      <div
  className={`px-4 pb-4 transition-all ${
    isOpen ? "block" : "hidden"
  }`}
>
  {(() => {
    const score = calculateSectionConfidence(id);

    if (score < 50) {
      return (
        <div className="bg-red-600/20 border border-red-500 p-2 rounded mb-3 text-xs">
          ⚠️ Low confidence — insufficient evidence or sources
        </div>
      );
    }

    if (score < 80) {
      return (
        <div className="bg-yellow-600/20 border border-yellow-500 p-2 rounded mb-3 text-xs">
          ⚠️ Medium confidence — consider adding evidence
        </div>
      );
    }

    return null;
  })()}

  {children}
</div>
    </div>
  );
};

const friendlyText = {
  mobility: {
    independent: "Moves around safely on their own",
    "needs support": "Needs some help to move safely",
    dependent: "Relies on others for movement",
    "bed bound": "Stays in bed and needs full support",
  },
  nutrition: {
    adequate: "Eating and drinking well",
    reduced: "Eating or drinking less than usual",
    poor: "Struggling to eat or drink enough",
    refused: "Not eating or drinking",
  },
  skin: {
    intact: "Skin is healthy",
    "at risk": "Skin needs monitoring",
    "pressure sore": "Has a pressure sore requiring care",
  },
  falls_risk: {
    low: "Low risk of falling",
    moderate: "Some risk of falling",
    high: "High risk of falling",
  },
  safeguarding: {
    none: "No concerns",
    concern: "There is a safeguarding concern being managed",
  },
};
const createReferral = async (payload: {
  client_id: string;
  referral_type: string;
  details: string;
  organisation_id?: string;
  status: string;
}) => {
  try {
    await supabase.from("referrals").insert(payload);
  } catch (e) {
    console.log("Referral failed", e);
  }
};
const getFriendly = (field: string, value: any) => {
  if (!value) return "Not recorded";

  const map = (friendlyText as any)[field];
  if (!map) return value;

  return map[value] || value;
};

const compareToBaseline = (field: string, current: any) => {
  const baseline = form.baseline_observations?.[field];

  if (!baseline) return null;

  if (baseline !== current) {
    return "⚠️ Changed from baseline";
  }

  return null;
};

const FamilyPDFView = () => {
  const scoreValue = calculateScore();

  const riskLabel =
  scoreValue >= 10
    ? "Higher level of support needed"
    : scoreValue >= 5
    ? "Some additional support needed"
    : "Low level of support needed";

  const riskColor =
    scoreValue >= 10
      ? "text-red-600"
      : scoreValue >= 5
      ? "text-yellow-600"
      : "text-green-600";

  return (
    <div className="bg-white text-black p-6 space-y-4 text-sm">
      <h1 className="text-xl font-bold mb-2">Care Summary</h1>

      {form.ai_summary && (
        <div className="bg-blue-100 border border-blue-400 p-3 rounded mb-4">
          <h2 className="font-semibold mb-2">🧠 AI Summary</h2>
          <p className="whitespace-pre-line">{form.ai_summary}</p>
        </div>
      )}

      <p>
        This summary explains the current care needs and support in place in a
        clear and simple way.
      </p>

      <div className="space-y-2">
        <div><strong>Mobility:</strong> {getFriendly("mobility", form.mobility)}</div>
        <div><strong>Eating & Drinking:</strong> {getFriendly("nutrition", form.nutrition)}</div>
        <div><strong>Skin:</strong> {getFriendly("skin", form.skin)}</div>
        <div><strong>Falls Risk:</strong> {getFriendly("falls_risk", form.falls_risk)}</div>
        <div><strong>Cognition:</strong> {getFriendly("cognition", form.cognition)}</div>
        <div><strong>Medication Support:</strong> {getFriendly("medication_ability", form.medication_ability)}</div>
        <div><strong>Safety:</strong> {getFriendly("safeguarding", form.safeguarding)}</div>
      </div>

      {form.early_warning_signs && (
  <div className="text-yellow-400 text-sm">
    ⚠️ Early warning signs recorded
    <div className="text-xs text-yellow-300 mt-1">
      {form.early_warning_signs}
    </div>
  </div>
)}

      {form.escalation_plan && (
  <div className="text-blue-400 text-sm">
    📞 Escalation plan available
    <div className="text-xs text-blue-300 mt-1">
      {form.escalation_plan}
    </div>
  </div>
)}

      <div className="mt-4">
        <strong>Overall Risk Level:</strong>{" "}
        <span className={`font-semibold ${riskColor}`}>
          {riskLabel}
        </span>
      </div>

      <div className="mt-6 text-xs text-gray-600">
        This report is designed to help families understand care needs in a simple,
        reassuring way. Speak to the care provider if you have any concerns.
      </div>
    </div>
  );
};
const baseline = form.baseline_observations ?? {};
return (
  <>
    {!access || typeof access !== "object" ? (
      <div className="p-6 text-center">Loading...</div>
    ) : !hasAssessmentAccess ? (
      <div className="p-6 text-center">
        <p className="mb-4">Assessments are a Pro feature</p>
        <button
          onClick={() => router.push("/upgrade")}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Upgrade
        </button>
      </div>
    ) : (
      <div
        id="pdf-content"
        className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 md:p-6 max-w-3xl mx-auto"
      >
<div className="flex justify-start mb-4">
  <button
  type="button"
  onClick={() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/clients");
    }
  }}
  className="mb-6 text-sm text-blue-400"
>
  ← Back
</button>
</div>
      <div className="flex items-center justify-between mb-6">

  {/* LEFT */}
  <div>
    <h1 className="text-2xl font-bold">
      Assessment (v{form.version_number || 1})
    </h1>

    {hasSavedAssessment && viewMode && form.locked === true && (
      <div className="bg-yellow-600 p-3 rounded mt-3">
        <p className="mb-2 text-sm">🔒 assessments locked</p>

        <button
          type="button"
          onClick={async () => {
            await supabase
              .from("assessments")
              .update({ locked: false })
              .eq("client_id", form.client_id);

            setViewMode(false);

            setForm((prev: any) => ({
              ...prev,
              locked: false,
            }));
          }}
          className="bg-black px-3 py-1 rounded"
        >
          Start Review
        </button>
      </div>
    )}
  </div>

  {/* RIGHT */}
  <div className="flex items-center gap-2">
    {hasSavedAssessment && viewMode && form.locked === true && (
      <>
        <button
          type="button"
          onClick={() => setPdfMode("standard")}
          className={`px-3 py-1 rounded text-sm ${
            pdfMode === "standard"
              ? "bg-blue-600 text-white"
              : "bg-gray-600"
          }`}
        >
          Professional
        </button>

        <button
          type="button"
          onClick={() => setPdfMode("family")}
          className={`px-3 py-1 rounded text-sm ${
            pdfMode === "family"
              ? "bg-green-600 text-white"
              : "bg-gray-600"
          }`}
        >
          Family View
        </button>

        <button
          type="button"
          onClick={generatePDF}
          className="bg-purple-600 px-3 py-1 rounded text-sm"
        >
          Download PDF
        </button>
      </>
    )}

    <button
      type="button"
      onClick={() => setViewMode((prev) => !prev)}
      className={`px-3 py-1 rounded text-sm transition ${
        viewMode
          ? "bg-blue-600 text-white"
          : "bg-[var(--card)] text-gray-200"
      }`}
    >
      {viewMode ? "Edit Mode" : "View Mode"}
    </button>

    <div className="text-xs px-3 py-1 rounded bg-[var(--card)]">
      {saving === "saving" && "Saving..."}
      {saving === "saved" && "Saved"}
      {saving === "error" && "Error"}
    </div>
  </div>
</div>
      <p className="text-sm text-[var(--muted)] mb-4">
  Status: {form.status || "in progress"}
</p>
      <div className="mb-6">
  <div className="w-full bg-[var(--card)] rounded-full h-3">
    <div
      className="bg-gradient-to-r from-blue-500 to-green-400 h-3 rounded-full transition-all"
      style={{ width: `${getProgress()}%` }}
    />
  </div>

  <p className="text-sm text-[var(--muted)] mt-2">
    {getProgress()}% complete
  </p>
</div>
{accountType === "team" && prompts.length > 0 && (
  <div className="bg-yellow-600 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">
      ⚠️ Suggested Updates from Visits
    </h2>

    {prompts.map((p) => (
      <div key={p.id} className="mb-3 p-3 bg-[var(--card)] rounded">
        <p className="text-sm mb-2">{p.message}</p>

        <div className="flex gap-2">
          <button
          type="button"
            onClick={async () => {
              if (conflicts.length > 0) {
  alert("Resolve conflicting records before applying updates");
  return;
}
              const { data } = await supabase.auth.getUser();

              // APPLY UPDATE
              setForm((prev: any) => ({
  ...prev,
  ...p.suggested_value,
}));

              // MARK ACCEPTED
              await supabase
                .from("assessment_prompt")
                .update({
                  status: "accepted",
                  actioned_by: data?.user?.id,
                  actioned_at: new Date().toISOString(),
                })
                .eq("id", p.id);

              setPrompts((prev: any[]) =>
  prev.filter((x: any) => x.id !== p.id)
);
            }}
            className="bg-green-600 px-3 py-1 rounded text-sm"
          >
            Accept
          </button>

          <button
          type="button"
            onClick={async () => {
              const { data } = await supabase.auth.getUser();

              await supabase
                .from("assessment_prompt")
                .update({
                  status: "ignored",
                  actioned_by: data?.user?.id,
                  actioned_at: new Date().toISOString(),
                })
                .eq("id", p.id);

              setPrompts((prev: any[]) =>
  prev.filter((x: any) => x.id !== p.id)
);
            }}
            className="bg-gray-600 px-3 py-1 rounded text-sm"
          >
            Ignore
          </button>
        </div>
      </div>
    ))}
  </div>
)}
{conflicts.length > 0 && (
  <div className="bg-red-600 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">
      ⚠️ Conflicting information detected
    </h2>

    {conflicts.map((c, i) => (
  <p key={`conflict-${i}`} className="text-sm">
    • {c.message}
  </p>
))}

    <p className="text-xs mt-2 text-gray-200">
      Please review before updating the assessments.
    </p>
  </div>
)}
{viewMode && plan === "pro" && (
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-6">
    <div className="bg-red-900/20 border border-red-500 p-4 rounded mb-6">
  <h2 className="font-semibold mb-2">🚨 Clinical Priority Flags</h2>

  {form.risk_trend === "declining" && (
    <p className="text-red-400 text-sm">Declining condition detected</p>
  )}

  {safeDateDiffDays(form.last_deterioration) !== null &&
    safeDateDiffDays(form.last_deterioration)! < 7 && (
      <p className="text-red-400 text-sm">
        Recent deterioration (last 7 days)
      </p>
    )}

  {form.frailty_score >= 7 && (
    <p className="text-red-400 text-sm">
      Severe frailty — high deterioration risk
    </p>
  )}

  {form.early_warning_signs && (
    <p className="text-yellow-400 text-sm">
      Early warning signs documented
    </p>
  )}

  {form.escalation_plan && (
    <p className="text-blue-400 text-sm">
      Escalation plan in place
    </p>
  )}
</div>
    <h2 className="font-semibold mb-3">Summary</h2>

    {form.risk_trend && (
  <p className="text-sm mb-2">
    <strong>Risk Trend:</strong> {form.risk_trend}
  </p>
)}

    <p className="text-sm mb-2">
      <strong>Mobility:</strong> {form.mobility || "Not recorded"}
    </p>

    {compareToBaseline("mobility", form.mobility) && (
  <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">
    ⚠️ Change from normal:
    <div>{compareToBaseline("mobility", form.mobility)}</div>
  </div>
)}

    <p className="text-sm mb-2">
      <strong>Nutrition:</strong> {form.nutrition || "Not recorded"}
    </p>

    <p className="text-sm mb-2">
      <strong>Skin:</strong> {form.skin || "Not recorded"}
    </p>

    <p className="text-sm mb-2">
      <strong>Falls Risk:</strong> {form.falls_risk || "Not recorded"}
    </p>

    <p className="text-sm mb-2">
      <strong>Safeguarding:</strong> {form.safeguarding || "None"}
    </p>

    <p className="text-sm mt-3">
      <strong>Risk Level:</strong>{" "}
      {score >= 10
        ? "High"
        : score >= 5
        ? "Moderate"
        : "Low"}
    </p>
  </div>
)}
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-6">
  <h2 className="font-semibold mb-3">🧾 Timeline</h2>

  <div className="space-y-3 max-h-[300px] overflow-y-auto">
    {timeline.map((item, i) => (
      <div
        key={`${item.type}-${item.date}-${item.id || i}`}
        className="border-l-2 border-[var(--border)]-600 pl-3"
      >
        <p className="text-xs text-[var(--muted)]">
          {new Date(item.date).toLocaleString()}
        </p>

        <p
  className={`text-sm font-semibold ${
    item.type === "visit"
      ? "text-blue-400"
      : item.type === "prompt"
      ? "text-yellow-400"
      : item.type === "prompt_action"
      ? "text-green-400"
      : "text-purple-400"
  }`}
>
  {item.label}
</p>

        {item.description && (
          <p className="text-xs text-gray-300">
            {item.description}
          </p>
        )}
      </div>
    ))}
  </div>
</div>
<SectionWrapper
  id="cognition"
  title="Cognition & Capacity"
  progress={getSectionProgress("cognition")}
>
      <Section
  title="Mental Capacity"
  options={["has capacity", "lacks capacity", "fluctuating"]}
  value={form.capacity || ""}
  onChange={(v) => handleInput("capacity", v)}
  disabled={viewMode}
/>

<Section
  title="Best Interest Decision Required"
  options={["no", "yes"]}
  value={form.best_interest_required || ""}
  onChange={(v) => handleInput("best_interest_required", v)}
  disabled={viewMode}
/>
{(form.capacity === "lacks capacity" || form.capacity === "fluctuating") && (
  <div className="bg-red-600/20 border border-red-500 p-3 rounded mb-4">
    <p className="text-sm mb-2">
      ⚠️ Capacity concern identified — MCA assessments required
    </p>

    {!viewMode && (
      <button
      type="button"
        onClick={() => {
          if (!hasMCAAccess) {
            router.push("/upgrade");
          } else {
            router.push(`/mca?client=${form.client_id}`);
          }
        }}
        className={`w-full p-3 text-base rounded-xl font-medium ${
  hasMCAAccess
    ? "bg-blue-600 text-white"
    : "bg-gray-200 text-gray-500 cursor-not-allowed"
}`}
      >
        {mcaList.length > 0
          ? "➕ Add / Update MCA assessments"
          : "Start MCA assessments"}{" "}
        {!hasMCAAccess && "🔒"}
      </button>
    )}

    {mcaList.length > 0 && (
  <details className="mt-3">
  <summary className="text-xs text-[var(--muted)] cursor-pointer">
    Previous MCA Assessments
  </summary>

  <div className="mt-2 space-y-2">
    {mcaList.map((mca) => (
      <div
        key={mca.id}
        onClick={() => {
          setSelectedMcaId(mca.id);

          const linkedBi = biList.find(
            (bi) => bi.linked_mca_id === mca.id
          );

          if (linkedBi) {
            setSelectedBiId(linkedBi.id);
          }
        }}
        className={`bg-[var(--card)] p-3 rounded flex justify-between items-center cursor-pointer ${
          selectedMcaId === mca.id ? "border border-blue-400" : ""
        } ${
          selectedBiId &&
          biList.find((bi) => bi.id === selectedBiId)?.linked_mca_id === mca.id
            ? "bg-blue-500/20 border-blue-400"
            : ""
        }`}
      >
        <div>
          <p className="text-sm font-medium">
            {mca.decision || "No decision recorded"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {new Date(mca.created_at).toLocaleDateString()}
          </p>
        </div>

        <button
        type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/mca?client=${form.client_id}&edit=${mca.id}`);
          }}
          className="text-blue-400 text-sm"
        >
          Edit
        </button>
      </div>
    ))}
  </div>
</details>
)}
    
  </div>
)}

{form.best_interest_required === "yes" && (
  <div className="bg-yellow-600 p-3 rounded mb-4">
    <p className="text-sm mb-2">
      ⚠️ Best interest decision must be completed
    </p>

    <button
    type="button"
  onClick={() => {
    if (!hasMCAAccess) {
      router.push("/upgrade");
    } else {
      router.push(`/best-interest?client=${form.client_id}`);
    }
  }}
  className={`px-3 py-2 rounded ${
  hasMCAAccess ? "bg-black" : "bg-gray-400 cursor-not-allowed"
}`}
>
  {biList.length > 0
    ? "➕ Add / Update Best Interest"
    : "Complete Best Interest"}{" "}
  {!hasMCAAccess && "🔒"}
</button>
{biList.length > 0 && (
  <details className="mt-3">
  <summary className="text-xs text-[var(--muted)] cursor-pointer">
    Previous Best Interest Decisions
  </summary>

  <div className="mt-2 space-y-2">
    {biList.map((bi) => (
      <div
        key={bi.id}
        onClick={() => {
          setSelectedBiId(bi.id);

          if (bi.linked_mca_id) {
            setSelectedMcaId(bi.linked_mca_id);
          }
        }}
        className={`bg-[var(--card)] p-3 rounded flex justify-between items-center cursor-pointer ${
          selectedBiId === bi.id ? "border border-yellow-400" : ""
        } ${
          bi.linked_mca_id === selectedMcaId
            ? "bg-yellow-500/20 border-yellow-400"
            : ""
        }`}
      >
        <div>
          <p className="text-sm font-medium">
            {bi.decision || "No decision recorded"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {new Date(bi.created_at).toLocaleDateString()}
          </p>
        </div>

        <button
        type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/best-interest?client=${form.client_id}&edit=${bi.id}`);
          }}
          className="text-blue-400 text-sm"
        >
          Edit
        </button>
      </div>
    ))}
  </div>
</details>
)}
    
  </div>
)}

{/* COGNITION */}
        <Section
    title="Cognition"
    options={["no impairment", "mild", "moderate", "severe"]}
    value={form?.cognition || ""}
    onChange={(v) => handleInput("cognition", v)}
    disabled={viewMode}
  />

<Section
  title="Communication"
  options={["independent", "needs support", "non-verbal"]}
  value={form.communication || ""}
  onChange={(v) => handleInput("communication", v)}
  disabled={viewMode}
/>

{(form.capacity || !viewMode) && (
  <>
    <CommunicationBox
      value={form.communication_support}
      onChange={(val) => handleInput("communication_support", val)}
      disabled={viewMode}
    />

    <div className="bg-[var(--card)] p-3 rounded mt-4 space-y-3">
  <p className="text-sm font-semibold">Consent & Legal</p>

  <Section
    title="Consent Obtained"
    options={["yes", "no"]}
    value={form.consent_obtained || ""}
    onChange={(v) => handleInput("consent_obtained", v)}
    disabled={viewMode}
  />

  <Section
    title="Consent Type"
    options={["verbal", "written", "best interest"]}
    value={form.consent_type || ""}
    onChange={(v) => handleInput("consent_type", v)}
    disabled={viewMode}
  />

  <Section
    title="Advance Decision"
    options={["none", "dnacpr", "living will"]}
    value={form.advance_decision || ""}
    onChange={(v) => handleInput("advance_decision", v)}
    disabled={viewMode}
  />

  <Section
    title="LPA Health & Welfare"
    options={["no", "yes"]}
    value={form.lpa_health_welfare || ""}
    onChange={(v) => handleInput("lpa_health_welfare", v)}
    disabled={viewMode}
  />

  <input
    type="text"
    placeholder="Capacity assessed for"
    value={form.capacity_assessed_for || ""}
    onChange={(e) => handleInput("capacity_assessed_for", e.target.value)}
    className="w-full p-3 rounded bg-[var(--card)]"
  />

  <input
    type="date"
    value={fromISODate(form.capacity_assessment_date)}
    onChange={(e) => handleInput("capacity_assessment_date", e.target.value)}
    className="w-full p-3 rounded bg-[var(--card)]"
  />

  <input
    type="text"
    placeholder="Decision type"
    value={form.decision_type || ""}
    onChange={(e) => handleInput("decision_type", e.target.value)}
    className="w-full p-3 rounded bg-[var(--card)]"
  />

  {bestInterest && (
  <div className="mt-3 p-3 bg-green-900/20 border border-green-700 rounded text-xs">
    ⚖️ Best Interest Completed

    <p><strong>Decision:</strong> {bestInterest.decision}</p>
    <p><strong>Outcome:</strong> {bestInterest.outcome}</p>

    <button
      onClick={() =>
        router.push(`/best-interest?client=${clientId}&edit=${bestInterest.id}`)
      }
      className="text-blue-400 underline mt-2"
    >
      View / Edit
    </button>
  </div>
)}
</div>
  </>
)}
<EvidenceBlock
  section="cognition"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>

<SectionWrapper
  id="nutrition"
  title="Nutrition & Hydration"
  progress={getSectionProgress("nutrition")}
  >
      
      {/* HYDRATION */}
      <Section
        title="Hydration"
        options={["adequate", "reduced", "poor", "refused"]}
        value={form.hydration || ""}
        onChange={(v) => handleInput("hydration", v)}
        disabled={viewMode}
      />

      {/* NUTRITION */}
      <Section
        title="Nutrition"
        options={["adequate", "reduced", "poor", "refused"]}
        value={form.nutrition || ""}
        onChange={(v) => handleInput("nutrition", v)}
        disabled={viewMode}
      />
      <TextAreaField
  value={form.nutrition_notes}
  onChange={(val) => handleInput("nutrition_notes", val)}
  placeholder="Describe intake (e.g. small meals, fortified diet, supplements)"
  disabled={viewMode}
/>

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mt-4 space-y-3">
  <p className="text-sm font-semibold">Weight & Nutritional Risk</p>

  {/* WEIGHT */}
<div>
  <label className="text-sm text-[var(--muted)]">Weight (kg)</label>
  <input
    type="number"
    inputMode="decimal"
    value={form.weight ?? ""}
    onChange={(e) =>
      handleInput(
        "weight",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 mt-1 text-base rounded bg-[var(--card)]"
  />
</div>

{/* HEIGHT */}
<div>
  <label className="text-sm text-[var(--muted)]">Height (cm)</label>
  <input
    type="number"
    inputMode="decimal"
    value={form.height ?? ""}
    onChange={(e) =>
      handleInput(
        "height",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 mt-1 text-base rounded bg-[var(--card)]"
  />
</div>

  <div>
  <label className="text-sm text-[var(--muted)]">BMI</label>
  <input
    type="number"
    value={bmi || ""}
    readOnly
    className="w-full p-3 mt-1 text-base rounded bg-[var(--card)]"
  />
</div>

  {bmiCategory === "underweight" && (
  <div className="bg-red-600 p-3 rounded">
    🚨 Underweight — MUST assessments required
  </div>
)}

{bmiCategory === "obese" && (
  <div className="bg-yellow-600 p-3 rounded">
    ⚠️ Obesity risk — monitor mobility & cardiovascular risk
  </div>
)}

  <Section
    title="Unplanned Weight Loss"
    options={["no", "yes"]}
    value={form.unplanned_weight_loss || ""}
    onChange={(v) => handleInput("unplanned_weight_loss", v)}
    disabled={viewMode}
  />
</div>

      <Section
  title="Choking Risk"
  options={["no risk", "low", "moderate", "high"]}
  value={form.choking || ""}
  onChange={(v) => handleInput("choking", v)}
  disabled={viewMode}
/>
{["moderate", "high"].includes(form.choking) && (
  <div className="bg-red-600/20 border border-red-500 p-3 rounded mb-4">
    <p className="text-sm mb-2">
      ⚠️ Choking risk identified — IDDSI required
    </p>

    <Section
      title="Food IDDSI Level (Required)"
      options={[
        "Level 7 Regular",
        "Level 6 Soft",
        "Level 5 Minced",
        "Level 4 Pureed",
      ]}
      value={form.iddsi || ""}
      onChange={(v) => handleInput("iddsi", v)}
      disabled={viewMode}
    />

    <Section
      title="Fluid Thickness Level (Required)"
      options={[
        "Level 0 Thin",
        "Level 1 Slightly Thick",
        "Level 2 Mildly Thick",
        "Level 3 Moderately Thick",
        "Level 4 Extremely Thick",
      ]}
      value={form.fluid_level || ""}
      onChange={(v) => handleInput("fluid_level", v)}
      disabled={viewMode}
    />
  </div>
)}
<EvidenceBlock
  section="nutrition"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>

      {/* MOBILITY */}
<SectionWrapper
  id="mobility"
  title="Mobility & Falls"
  progress={getSectionProgress("mobility")}
  disabled={viewMode}
>
  <Section
    title="Mobility Ability"
    options={["independent", "needs support", "dependent", "bed bound"]}
    value={form.mobility || ""}
    onChange={(v) => handleInput("mobility", v)}
    disabled={viewMode}
  />

  <Section
    title="Falls Risk"
    options={["low", "moderate", "high"]}
    value={form.falls_risk || ""}
    onChange={(v) => handleInput("falls_risk", v)}
    disabled={viewMode}
  />
  {form.falls_risk === "high" && (
  <div className="bg-yellow-600/20 border border-yellow-500 p-3 rounded mb-4">
    <p className="text-sm mb-2">
      ⚠️ High falls risk — equipment and referral required
    </p>

    {(!form.equipment || form.equipment.length === 0) && (
      <p className="text-xs text-red-400">
        No equipment selected — action required
      </p>
    )}

  </div>
)}

  <Section
  title="Equipment"
  options={[
    "walking frame",
    "wheelchair",
    "hoist",
    "hospital bed",
    "other",
  ]}
  value={form.equipment || []}
  onChange={(v) =>
    handleInput(
      "equipment",
      Array.isArray(v) ? v.filter((x) => x && x !== "") : v
    )
  }
  disabled={viewMode}
  multi
/>

  {form.equipment?.includes("other") && (
    <TextAreaField
  value={form.equipment_other}
  onChange={(val) => handleInput("equipment_other", val)}
  placeholder="Specify other equipment"
  disabled={viewMode}
/>
  )}

  {Array.isArray(form.equipment) && form.equipment.length > 0 && (
  <>
    {form.equipment
      .filter((item: string) => item && item !== "")
      .map((item: string, index: number) => (
        <div
          key={`${item}-${index}`}
          className="mb-4 p-3 rounded bg-[var(--card)]"
        >

          <p className="mb-2 text-sm font-semibold">
            {item} — Serviced?
          </p>
          <input
  type="date"
  value={fromISODate(form.equipment_last_service?.[item])}
  onChange={(e) =>
  handleEquipmentDate(item, e.target.value)
}
  className="w-full p-2 rounded bg-[var(--card)]"
/>

          <div className="flex gap-2 mb-2">
            {(["yes", "no"] as ("yes" | "no")[]).map((opt) => {
              const isActive =
                form.equipment_serviced?.[item] === opt;

              return (
                <button
                type="button"
                  key={opt}
                  onClick={() => handleEquipmentServiced(item, opt)}
disabled={viewMode}
                  className={`px-3 py-1 rounded text-sm ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-600"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {(form.equipment_serviced?.[item] === "no" ||
  form.equipment_serviced?.[item] === undefined) && (
  <div className="bg-red-600 p-2 rounded mt-2">
    <p className="text-sm mb-2">
      🚨 {item} requires servicing
    </p>

              <button
              type="button"
  onClick={async () => {
  try {
    console.log("CLICKED", {
      client_id: form.client_id,
      organisationId,
      item,
    });

    const result = await createReferral({
      client_id: form.client_id,
      referral_type: "Equipment Service",
      details: `${item} requires servicing`,
      organisation_id: organisationId ?? undefined,
      status: "pending",
    });

    console.log("RESULT:", result);

    alert("Referral created");
  } catch (err) {
    console.error("REFERRAL ERROR:", err);
    alert("Failed to create referral");
  }
}}
  className="bg-black px-3 py-1 rounded text-sm disabled:opacity-50"
>
  Book Service
</button>
            </div>
          )}
        </div>
      ))}

    </>
  )}

  <Section
    title="Falls History"
    options={["none", "recent fall", "multiple falls"]}
    value={form.falls || ""}
    onChange={(v) => handleInput("falls", v)}
    disabled={viewMode}
  />
  <EvidenceBlock
  section="mobility"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>

<SectionWrapper
  id="toileting"
  title="Personal Care & Continence"
  progress={getSectionProgress("toileting")}
>
      {/* TOILETING */}
      <Section
  title="Toileting"
  options={[
    "continent",
    "incontinent",
    "catheter",
    "stoma",
  ]}
  value={form.toileting || []}
  onChange={(v) => handleInput("toileting", v)}
  disabled={viewMode}
  multi
/>

{form.toileting?.includes("incontinent") && (
  <>
    <Section
      title={viewMode ? "Toilet Support" : "Continence Ability"}
      options={["independent", "needs support", "dependent"]}
      value={form.continence_ability || ""}
      onChange={(v) => handleInput("continence_ability", v)}
      disabled={viewMode}
    />

    <TextAreaField
  value={form.pad_type}
  onChange={(val) => handleInput("pad_type", val)}
  placeholder="Pad type"
  disabled={viewMode}
/>

    <div className="mb-4">
      <label className="text-sm text-[var(--muted)]">
        Last Pad Delivery Date
      </label>
      <input
        type="date"
        value={fromISODate(form.pad_delivery)}
onChange={(e) => handleInput("pad_delivery", e.target.value)}
        className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
      />
    </div>
  </>
)}

{form.toileting?.includes("catheter") && (
  <Section
    title="Catheter Type"
    options={["urethral", "suprapubic"]}
    value={form.catheter_type || ""}
    onChange={(v) => handleInput("catheter_type", v)}
    disabled={viewMode}
  />
)}

{form.toileting?.includes("stoma") && (
  <Section
    title="Stoma Type"
    options={["colostomy", "ileostomy", "urostomy"]}
    value={form.stoma_type || ""}
    onChange={(v) => handleInput("stoma_type", v)}
    disabled={viewMode}
  />
)}
      <Section
  title="Skin Integrity"
  options={[
  "intact",
  "at risk",
  "category 1",
  "category 2",
  "category 3",
  "category 4"
]}
  value={form.skin || ""}
  onChange={(v) => handleInput("skin", v)}
  disabled={viewMode}
/>

<TextAreaField
  value={form.skin_integrity_details}
  onChange={(val) => handleInput("skin_integrity_details", val)}
  placeholder="Describe skin condition, wounds, redness, etc."
  disabled={viewMode}
/>

<div className="bg-blue-900/30 p-3 rounded text-xs">
  <p><strong>Pressure Ulcer Categories:</strong></p>
  <p>• Category 1: Redness</p>
  <p>• Category 2: Skin break</p>
  <p>• Category 3: Deep tissue damage</p>
  <p>• Category 4: Severe tissue damage</p>
</div>

<Section
  title="Repositioning Required"
  options={["no", "2 hourly", "4 hourly", "bed bound protocol"]}
  value={form.repositioning_required || ""}
  onChange={(v) => handleInput("repositioning_required", v)}
  disabled={viewMode}
/>
<EvidenceBlock
  section="skin"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>

<SectionWrapper
  id="medication"
  title="Medication & Clinical Oversight"
  progress={getSectionProgress("medication")}
>
      {/* MEDICATION */}
      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4">
  <h2 className="font-semibold mb-2">Medications</h2>

  <div className="space-y-4">

  {medications.map((med, index) => (
  <div key={index} className="bg-[var(--card)] p-3 rounded space-y-2">

    <input
      type="text"
      placeholder="Medication name"
      value={med.name || ""}
      onChange={(e) =>
        updateMedication(index, "name", e.target.value)
      }
      className="w-full p-2 rounded bg-[var(--card)]"
    />

    <input
      type="text"
      placeholder="Dose (e.g. 500mg)"
      value={med.dose || ""}
      onChange={(e) =>
        updateMedication(index, "dose", e.target.value)
      }
      className="w-full p-2 rounded bg-[var(--card)]"
    />

    <input
      type="text"
      placeholder="Frequency (BD, TDS)"
      value={med.frequency || ""}
      onChange={(e) =>
        updateMedication(index, "frequency", e.target.value)
      }
      className="w-full p-2 rounded bg-[var(--card)]"
    />

    <input
      type="text"
      placeholder="Route"
      value={med.route || ""}
      onChange={(e) =>
        updateMedication(index, "route", e.target.value)
      }
      className="w-full p-2 rounded bg-[var(--card)]"
    />

    <input
      type="text"
      placeholder="Time of day"
      value={med.time_of_day || ""}
      onChange={(e) =>
        updateMedication(index, "time_of_day", e.target.value)
      }
      className="w-full p-2 rounded bg-[var(--card)]"
    />

    <button
      type="button"
      onClick={() => removeMedication(index)}
      className="text-red-400 text-sm"
    >
      Remove
    </button>
  </div>
))}
  <button
  type="button"
  onClick={addMedication}
  disabled={viewMode}
  className="bg-blue-600 px-3 py-2 rounded disabled:opacity-50"
>
    + Add Medication
  </button>

</div>

  <Section
  title="Medication Ability"
  options={["independent", "needs prompting", "administered by carer"]}
  value={form.medication_ability || ""}
  onChange={(v) => handleInput("medication_ability", v)}
  disabled={viewMode}
/>
</div>

<TextAreaField
  value={form.prn_protocol}
  onChange={(val) => handleInput("prn_protocol", val)}
  placeholder="PRN protocol (when required meds should be given)"
  disabled={viewMode}
/>

<Section
  title="Medication Compliance Risk"
  options={["low", "moderate", "high"]}
  value={form.medication_compliance_risk || ""}
  onChange={(v) => handleInput("medication_compliance_risk", v)}
  disabled={viewMode}
/>

      <div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    Medication Review Date (GP / Psychiatrist)
  </label>
  <input
    type="date"
    value={fromISODate(form.medication_review_date)}
onChange={(e) => handleInput("medication_review_date", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

<Section
  title="Controlled Drugs"
  options={["none", "yes"]}
  value={form.controlled_drugs || ""}
  onChange={(v) => handleInput("controlled_drugs", v)}
  disabled={viewMode}
/>

<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    MDT (Multi-Disciplinary Team) Last Meeting Date
  </label>
  <input
    type="date"
    value={fromISODate(form.mdt_last_meeting)}
onChange={(e) => handleInput("mdt_last_meeting", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

<Section
  title="Mental Health Status"
  options={["stable", "low mood", "anxious", "distressed"]}
  value={form.mental_health_status || ""}
  onChange={(v) => handleInput("mental_health_status", v)}
  disabled={viewMode}
/>

<Section
  title="Impact on Daily Living"
  options={["none", "needs reassurance", "needs prompting", "refuses care"]}
  value={form.mental_health_impact || ""}
  onChange={(v) => handleInput("mental_health_impact", v)}
  disabled={viewMode}
/>
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 space-y-3">
  <p className="text-sm font-semibold">🫁 Respiratory Management</p>
<Section
  title="Respiratory Support"
  options={["none", "inhaler", "oxygen", "nebuliser"]}
  value={form.respiratory_support || ""}
  onChange={(v) => handleInput("respiratory_support", v)}
  disabled={viewMode}
/>
{form.respiratory_support === "oxygen" && (
  <div className="bg-blue-900/20 border border-blue-500 p-3 rounded space-y-3">

    <input
      type="number"
      placeholder="Oxygen Flow Rate (L/min)"
      value={form.oxygen_flow_rate ?? ""}
      onChange={(e) =>
        handleInput(
          "oxygen_flow_rate",
          e.target.value === "" ? "" : Number(e.target.value)
        )
      }
      className="w-full p-3 rounded bg-[var(--card)]"
    />
    <Section
  title="Oxygen Usage"
  options={[
    "continuous",
    "PRN (as needed)",
    "night only",
  ]}
  value={form.oxygen_usage || ""}
  onChange={(v) => handleInput("oxygen_usage", v)}
  disabled={viewMode}
/>

    <Section
      title="Oxygen Delivery Method"
      options={["nasal cannula", "mask", "venturi mask"]}
      value={form.oxygen_delivery || ""}
      onChange={(v) => handleInput("oxygen_delivery", v)}
      disabled={viewMode}
    />

    <Section
      title="Target Oxygen Saturation"
      options={["88–92% (COPD)", "94–98% (normal)"]}
      value={form.target_sats || ""}
      onChange={(v) => handleInput("target_sats", v)}
      disabled={viewMode}
    />

  </div>
)}
{form.respiratory_support === "nebuliser" && (
  <div className="bg-yellow-900/20 border border-yellow-500 p-3 rounded space-y-3">

    <input
      type="text"
      placeholder="Medication (e.g. Salbutamol)"
      value={form.nebuliser_medication || ""}
      onChange={(e) =>
        handleInput("nebuliser_medication", e.target.value)
      }
      className="w-full p-3 rounded bg-[var(--card)]"
    />

    <input
      type="text"
      placeholder="Frequency (e.g. PRN / 4x daily)"
      value={form.nebuliser_frequency || ""}
      onChange={(e) =>
        handleInput("nebuliser_frequency", e.target.value)
      }
      className="w-full p-3 rounded bg-[var(--card)]"
    />

  </div>
)}
{form.respiratory_support === "inhaler" && (
  <div className="bg-green-900/20 border border-green-500 p-3 rounded">

    <Section
      title="Inhaler Support Required"
      options={[
        "independent",
        "needs prompting",
        "needs assistance",
      ]}
      value={form.inhaler_support || ""}
      onChange={(v) => handleInput("inhaler_support", v)}
      disabled={viewMode}
    />

  </div>
)}
</div>
<EvidenceBlock
  section="medication"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>

      <SectionWrapper
  id="clinical"
  title="Clinical Status"
  progress={getSectionProgress("clinical")}
>

  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 space-y-3">
  <p className="text-sm font-semibold">🔥 Pressure Ulcer Risk (Waterlow)</p>

 <div>
  <label className="text-sm text-[var(--muted)]">
    Age (auto-calculated)
  </label>
  <input
    type="number"
    value={age || ""}
    readOnly
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)] cursor-not-allowed"
  />
</div>


<label className="text-sm text-[var(--muted)]">
  Waterlow Score
</label>
  <Section
    title="Medication Risk (e.g. steroids, cytotoxics)"
    options={["no", "yes"]}
    value={form.waterlow_medication_risk || ""}
    onChange={(v) => handleInput("waterlow_medication_risk", v)}
    disabled={viewMode}
  />

  <input
    type="number"
  inputMode="decimal"
    value={form.waterlow_score || 0}
    readOnly
    className="w-full p-3 text-base rounded bg-[var(--card)] cursor-not-allowed"
  />

  <Section
  title="Pressure Area Risk"
  options={["low", "moderate", "high"]}
  value={form.pressure_area_risk || ""}
  onChange={(v) => handleInput("pressure_area_risk", v)}
  disabled={viewMode}
/>

  {form.waterlow_score >= 20 && (
    <div className="bg-red-600 p-2 rounded">
      🚨 Very High Risk (Waterlow ≥20)
    </div>
  )}

  {form.waterlow_score >= 15 && form.waterlow_score < 20 && (
    <div className="bg-orange-600 p-2 rounded">
      ⚠️ High Risk (Waterlow 15–19)
    </div>
  )}

  {form.waterlow_score >= 10 && form.waterlow_score < 15 && (
    <div className="bg-yellow-600 p-2 rounded">
      ⚠️ At Risk (Waterlow 10–14)
    </div>
  )}
</div>
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4 space-y-3">
  <p className="text-sm font-semibold">🫁 Early Warning Score (NEWS2)</p>

  <div>
  <label className="text-sm text-[var(--muted)]">
    Respiratory Rate (breaths per minute)
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={form.resp_rate || ""}
    onChange={(e) =>
      handleInput("resp_rate", e.target.value ? Number(e.target.value) : "")
    }
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>
  <div>
  <label className="text-sm text-[var(--muted)]">
    Oxygen Saturation (SpO2 %)
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={form.oxygen_sats ?? ""}
    onChange={(e) =>
      handleInput(
        "oxygen_sats",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

  <Section
    title="Oxygen Scale"
    options={["1", "2"]}
    value={form.oxygen_scale || "1"}
    onChange={(v) => handleInput("oxygen_scale", v)}
    disabled={viewMode}
  />

  <Section
    title="On Oxygen"
    options={["no", "yes"]}
    value={
  form.respiratory_support === "oxygen" ? "yes" : form.on_oxygen || "no"
}
onChange={(v) => handleInput("on_oxygen", v)}
    disabled={viewMode}
  />
  {form.on_oxygen === "yes" && !form.respiratory_support && (
  <div className="bg-red-600/20 border border-red-500 p-2 rounded">
    ⚠️ Oxygen recorded in observations but no respiratory support plan set
  </div>
)}

  <div>
  <label className="text-sm text-[var(--muted)]">
    Temperature (°C)
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={form.temperature ?? ""}
    onChange={(e) =>
      handleInput(
        "temperature",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

  <div>
  <label className="text-sm text-[var(--muted)]">
    Pulse (bpm)
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={form.pulse ?? ""}
    onChange={(e) =>
      handleInput(
        "pulse",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

  <Section
    title="Consciousness (ACVPU)"
    options={["alert", "confusion", "voice", "pain", "unresponsive"]}
    value={form.consciousness || ""}
    onChange={(v) => handleInput("consciousness", v)}
    disabled={viewMode}
  />

  <div>
  <label className="text-sm text-[var(--muted)]">
    NEWS2 Score
  </label>
  <input
    type="number"
    value={form.news2_score || 0}
    readOnly
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

  {form.news2_score >= 7 && (
    <div className="bg-red-600 p-2 rounded">
      🚨 NEWS2 ≥7 → Emergency response required
    </div>
  )}

  {form.news2_score >= 5 && form.news2_score < 7 && (
    <div className="bg-orange-600 p-2 rounded">
      ⚠️ NEWS2 5–6 → Urgent clinical review
    </div>
  )}

  {form.news2_score >= 3 && form.news2_score < 5 && (
    <div className="bg-yellow-600 p-2 rounded">
      ⚠️ NEWS2 ≥3 → Monitor closely
    </div>
  )}

  <div className="bg-blue-900/30 p-3 rounded text-xs space-y-1">
  <p><strong>How to measure:</strong></p>
  <p>• Respiratory Rate: Count breaths for 30 seconds ×2</p>
  <p>• Oxygen Saturation: Use finger probe (pulse oximeter)</p>
  <p>• Temperature: Use digital thermometer</p>
  <p>• Pulse: Count beats for 30 seconds ×2</p>

  <p className="mt-2"><strong>Oxygen Scale:</strong></p>
  <p>• Scale 1 = Normal patients</p>
  <p>• Scale 2 = COPD / chronic respiratory patients</p>
</div>
</div>

<div>
  <label className="text-sm text-[var(--muted)]">
    Clinical Frailty Score (1–9)
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={form.frailty_score ?? ""}
    onChange={(e) =>
      handleInput(
        "frailty_score",
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>
      <Section
  title="DNACPR Status"
  options={["in place", "not in place", "unknown"]}
  value={form.dnacpr || ""}
  onChange={(v) => handleInput("dnacpr", v)}
  disabled={viewMode}
/>

      <Section
  title="Pain Level"
  options={["none", "mild", "moderate", "severe"]}
  value={form.pain || ""}
  onChange={(v) => handleInput("pain", v)}
  disabled={viewMode}
/>
<Section
  title="Pain Impact on Function"
  options={["no impact", "limits movement", "limits daily care", "severe impact"]}
  value={form.pain_impact || ""}
  onChange={(v) => handleInput("pain_impact", v)}
  disabled={viewMode}
/>

<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    District Nurse Last Visit Date
  </label>
  <input
    type="date"
    value={fromISODate(form.dn_last_visit)}
onChange={(e) => handleInput("dn_last_visit", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    Occupational Therapy (OT) Last Review Date
  </label>
  <input
    type="date"
    value={fromISODate(form.ot_last_review)}
onChange={(e) => handleInput("ot_last_review", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    Speech & Language Therapy (SALT) Last Review Date
  </label>
  <input
    type="date"
    value={fromISODate(form.salt_last_review)}
onChange={(e) => handleInput("salt_last_review", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

<TextAreaField
  value={form.early_warning_signs}
  onChange={(val) => handleInput("early_warning_signs", val)}
  placeholder="Early warning signs (e.g. confusion, reduced intake)"
  disabled={viewMode}
/>

<TextAreaField
  value={form.escalation_plan}
  onChange={(val) => handleInput("escalation_plan", val)}
  placeholder="Escalation plan (e.g. call GP if NEWS2 > 5)"
  disabled={viewMode}
/>

<div className="bg-[var(--card)] p-3 rounded mt-4 space-y-3">
  <p className="text-sm font-semibold">Baseline (Normal for Client)</p>

  <Section
    title="Baseline Mobility"
    options={["independent", "needs support", "dependent", "bed bound"]}
    value={baseline.mobility || ""}
    onChange={(v) =>
      handleInput("baseline_observations", {
        ...form.baseline_observations,
        mobility: v,
      })
    }
    disabled={viewMode}
  />

  <Section
    title="Baseline Nutrition"
    options={["adequate", "reduced", "poor", "refused"]}
    value={baseline.nutrition || ""}
    onChange={(v) =>
      handleInput("baseline_observations", {
        ...form.baseline_observations,
        nutrition: v,
      })
    }
    disabled={viewMode}
  />

  <Section
    title="Baseline Cognition"
    options={["no impairment", "mild", "moderate", "severe"]}
    value={baseline.cognition || ""}
    onChange={(v) =>
      handleInput("baseline_observations", {
        ...form.baseline_observations,
        cognition: v,
      })
    }
    disabled={viewMode}
  />
</div>

<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    Last Deterioration Date
  </label>
  <input
    type="date"
    value={fromISODate(form.last_deterioration)}
    onChange={(e) => handleInput("last_deterioration", e.target.value)}
    className="w-full p-3 mt-1 rounded bg-[var(--card)]"
  />
</div>

<TextAreaField
  value={form.baseline_status}
  onChange={(val) => handleInput("baseline_status", val)}
  placeholder="Baseline status (normal presentation)"
  disabled={viewMode}
/>

<TextAreaField
  value={form.wound_care_plan}
  onChange={(val) => handleInput("wound_care_plan", val)}
  placeholder="Wound care plan"
  disabled={viewMode}
/>

<TextAreaField
  value={form.medication_side_effects}
  onChange={(val) => handleInput("medication_side_effects", val)}
  placeholder="Medication side effects"
  disabled={viewMode}
/>
</SectionWrapper>

<SectionWrapper
  id="safeguarding"
  title="Safeguarding & Risk"
  progress={getSectionProgress("safeguarding")}
>
  <div className="flex justify-between mb-2">
    <h2 className="font-semibold">Safeguarding & Risk</h2>
    <span className="text-xs text-[var(--muted)]">
  {getSectionProgress("safeguarding")}%
</span>
  </div>

  <Section
    title="Safeguarding"
    options={["none", "concern"]}
    value={form.safeguarding || ""}
    onChange={(v) => handleInput("safeguarding", v)}
    disabled={viewMode}
  />

  {form.safeguarding === "concern" && (
  <>
    <Section
      title="Referral Made"
      options={["no", "yes"]}
      value={form.safeguarding_referral_made || ""}
      onChange={(v) => handleInput("safeguarding_referral_made", v)}
      disabled={viewMode}
    />

    {form.safeguarding_referral_made === "yes" && (
      <>
        <div className="mb-4">
          <label className="text-sm text-[var(--muted)]">
            Safeguarding Referral Date
          </label>
          <input
            type="date"
            value={fromISODate(form.safeguarding_date)}
            onChange={(e) =>
              handleInput("safeguarding_date", e.target.value)
            }
            className="w-full p-3 mt-1 rounded bg-[var(--card)]"
          />
        </div>

        <TextAreaField
          value={form.safeguarding_outcome}
          onChange={(val) =>
            handleInput("safeguarding_outcome", val)
          }
          placeholder="Outcome of safeguarding referral"
          disabled={viewMode}
        />
      </>
    )}
  </>
)}

  {form.safeguarding === "concern" && (
  <div className="mt-4 space-y-4">

    {/* 🔥 ADD SPACE BEFORE BUTTON */}
    <div className="pt-2">
      <button
      type="button"
  onClick={() => setShowSafeguardingForm(true)}
  disabled={viewMode}
  className="bg-red-600 px-4 py-2 rounded disabled:opacity-50"
>
  🚨 Log Concern
</button>

{showSafeguardingForm && (
  <div className="space-y-4 p-4 bg-[var(--card)] rounded-lg border border-red-500/30">
    <h3 className="text-lg font-bold text-red-400">Log New Concern</h3>
    <p className="text-xs text-[var(--muted)]">
  Record safeguarding concerns clearly and accurately. This may be used for formal reporting.
</p>
    
    {/* CATEGORY + URGENCY GROUP */}
<div className="bg-[var(--bg)] p-3 rounded space-y-3">

  {/* Category Selection */}
  <div>
    <label className="block text-sm mb-1">Category of Concern</label>
    <select 
      className="w-full p-2 rounded bg-[var(--card)] border border-[#475569]"
      value={safeguardingForm.category}
      onChange={(e) => handleSafeguardingInput("category", e.target.value)}
    >
      <option value="">Select Category...</option>

      {CATEGORY_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>

    {safeguardingForm.category === "Other" && (
      <input
        type="text"
        placeholder="Specify category"
        className="w-full p-2 mt-2 rounded bg-[var(--card)] border border-[#475569]"
        value={safeguardingForm.other_category || ""}
        onChange={(e) =>
          handleSafeguardingInput("other_category", e.target.value)
        }
      />
    )}
  </div>

  {/* Urgency Selection */}
  <Section 
    title="Urgency Level"
    options={["low", "medium", "high", "critical"]}
    value={safeguardingForm.urgency}
    onChange={(val) => handleSafeguardingInput("urgency", val as string)}
  />

</div>

    {/* DESCRIPTION + ACTION GROUP */}
<div className="bg-[var(--bg)] p-3 rounded space-y-3">

  {/* Description Field */}
  <div>
    <label className="block text-sm mb-1">Description of Concern</label>
    <textarea 
      className="w-full p-2 rounded bg-[var(--card)] border border-[#475569] min-h-[100px]"
      placeholder="Provide full details of the observation..."
      value={safeguardingForm.description}
      onChange={(e) =>
        handleSafeguardingInput("description", e.target.value)
      }
    />
  </div>

  {/* Action Taken Field */}
  <div>
    <label className="block text-sm mb-1">Action Taken</label>
    <input 
      type="text"
      className="w-full p-2 rounded bg-[var(--card)] border border-[#475569]"
      placeholder="Who was notified? What immediate action was taken?"
      value={safeguardingForm.action_taken}
      onChange={(e) =>
        handleSafeguardingInput("action_taken", e.target.value)
      }
    />
  </div>

  {/* Follow Up */}
  <div>
    <label className="block text-sm mb-1">Follow-up Plan</label>
    <textarea
      className="w-full p-2 rounded bg-[var(--card)] border border-[#475569]"
      placeholder="Follow up actions / plan"
      value={safeguardingForm.follow_up}
      onChange={(e) =>
        handleSafeguardingInput("follow_up", e.target.value)
      }
    />
  </div>

</div>

    {/* THE SUBMIT BUTTON */}
    
  <div className="bg-yellow-600 p-3 rounded mt-4 text-sm">
    ⚠️ Some areas still need completing before safe care planning
  </div>

    <div className="flex justify-end gap-3 mt-4">
      <button 
        type="button"
        onClick={() => setShowSafeguardingForm(false)}
        className="px-4 py-2 text-sm text-[var(--muted)]"
      >
        Cancel
      </button>
      <button 
        type="button"
        disabled={isSubmittingReferral}
        onClick={handleLogConcern}
        className={`px-6 py-2 rounded-md font-bold text-white transition-all ${
          isSubmittingReferral ? "bg-gray-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
        }`}
      >
        {isSubmittingReferral ? "Logging Concern..." : "Confirm & Log Concern"}
      </button>
       </div> {/* buttons */}
  </div>   
)} 

    </div> {/* pt-2 */}
  </div>
)}
<p className="text-sm font-semibold mt-6">
  🏠 Environmental Risk
</p>
  <div className="mt-6">
  <Section
    title="Environment Risk"
    options={["safe", "cluttered", "unsafe"]}
    value={form.environment || ""}
    onChange={(v) => handleInput("environment", v)}
    disabled={viewMode}
  />
</div>
<EvidenceBlock
  section="safeguarding"
  form={form}
  handleInput={handleInput}
  handleFileUpload={handleFileUpload}
  evidenceList={evidenceList}
  viewMode={viewMode}
  options={SOURCE_OPTIONS}
/>
</SectionWrapper>
<SectionWrapper
  id="daily"
  title="Daily Living"
  progress={getSectionProgress("daily")}
>
  <h2 className="font-semibold mb-2">Daily Living</h2>
<Section
  title="Washing"
  options={["independent", "needs support", "dependent"]}
  value={form.washing || ""}
  onChange={(v) => handleInput("washing", v)}
  disabled={viewMode}
/>

<Section
  title="Dressing"
  options={["independent", "needs support", "dependent"]}
  value={form.dressing || ""}
  onChange={(v) => handleInput("dressing", v)}
  disabled={viewMode}
/>

<Section
  title="Eating Ability"
  options={["independent", "needs support", "dependent"]}
  value={form.eating || ""}
  onChange={(v) => handleInput("eating", v)}
  disabled={viewMode}
/>
</SectionWrapper>

<SectionWrapper
  id="medical"
  title="Medical Information"
  progress={getSectionProgress("medical")}
>
  <div className="flex justify-between mb-2">
    <h2 className="font-semibold">Medical Information</h2>
    <span className="text-xs text-[var(--muted)]">
  {getSectionProgress("medical")}%
</span>
  </div>
<input
  placeholder="Medical conditions"
  value={form.medical_conditions || ""}
  onChange={(e) => handleInput("medical_conditions", e.target.value)}
  className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
/>

<input
  placeholder="Allergies"
  value={form.allergies || ""}
  onChange={(e) => handleInput("allergies", e.target.value)}
  className="w-full p-3 text-base mb-6 rounded bg-[var(--card)] text-white"
/>
</SectionWrapper>
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-6 border border-yellow-500/30">
   
<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4">
{form.flags?.length > 0 && (
  <div className="bg-red-900/20 border border-red-500 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">🚨 System Flags</h2>

    {form.flags.map((f: string) => (
      <p key={f} className="text-sm text-red-400">
        • {f.replace("_", " ")}
      </p>
    ))}
  </div>
)}
  <h2 className="font-semibold mb-2">Risk Score</h2>

  {score >= 10 && (
  <p className="text-red-400 text-sm mt-2">
    ⚠️ High risk — ensure all sections are fully completed
  </p>
)}

  <p className="text-2xl font-bold">
    {score}
  </p>

  <p className="text-sm text-[var(--muted)]">
    {score >= 10
      ? "High Risk"
      : score >= 5
      ? "Moderate Risk"
      : "Low Risk"}
  </p>
</div>
</div>
{form.requires_review && (
  <div className="bg-yellow-600 p-3 rounded mb-4 text-sm">
    ⚠️ This assessment requires review due to identified risks
  </div>
)}
<SectionWrapper
  id="review"
  title="Review & Compliance"
  progress={getSectionProgress("review")}
>
  <div className="flex justify-between mb-2">
    <h2 className="font-semibold">Review & Compliance</h2>
    <span className="text-xs text-[var(--muted)]">
  {getSectionProgress("review")}%
</span>
  </div>
<div className="mb-4">
  <label className="text-sm text-[var(--muted)]">
    assessments Last Reviewed Date
  </label>
  <input
    type="date"
    value={fromISODate(form.last_reviewed)}
onChange={(e) => handleInput("last_reviewed", e.target.value)}
    className="w-full p-3 text-base mt-1 rounded bg-[var(--card)]"
  />
</div>

{form.last_reviewed && (
  <p className={`text-sm ${isOverdue ? "text-red-400" : "text-green-400"}`}>
    {isOverdue ? "⚠️ Review overdue" : "Up to date"}
  </p>
)}
</SectionWrapper>
{hasSmartAlertsAccess && (
  <div className="bg-red-600 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">
      🚨 Live Clinical Alerts
    </h2>

    {getImmediateAlerts().map((a, i) => (
      <p key={i} className="text-sm">
        • {a}
      </p>
    ))}
  </div>
)}
{!hasSmartAlertsAccess && getImmediateAlerts().length > 0 && (
  <div className="bg-yellow-600 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">
      ⚠️ Risks detected
    </h2>
    <p className="text-sm">
      Upgrade to view required actions and alerts.
    </p>
  </div>
)}

<div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4">
  <h2 className="font-semibold mb-2">Log Referral</h2>

  {hasSmartAlertsAccess && getImmediateAlerts().length > 0 && (
  <div className="bg-red-600 p-4 rounded mb-4">
    <h2 className="font-semibold mb-2">
      Immediate Actions Required
    </h2>

    {getImmediateAlerts().map((a, i) => (
      <p key={`alert-${i}`}>• {a}</p>
    ))}

    <select
      value={referral.type || ""}
      onChange={(e) =>
        setReferral({ ...referral, type: e.target.value })
      }
    >
      <option value="">Select referral</option>
      <option value="DN">District Nurse</option>
      <option value="OT">Occupational Therapy</option>
      <option value="SALT">Speech & Language</option>
      <option value="GP">GP</option>
    </select>

    <TextAreaField
      value={referral.details}
      onChange={(val) =>
        setReferral({ ...referral, details: val })
      }
      placeholder="Referral notes"
      disabled={viewMode}
    />
  </div>
)}

{!form.locked && form.status === "completed" && (
  <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mb-4">
    <h2 className="font-semibold mb-2">Review Details</h2>

    <select
      value={form.review_type || ""}
      onChange={(e) => handleInput("review_type", e.target.value)}
      className="w-full p-3 text-base mb-2 rounded bg-[var(--card)]"
    >
      <option value="">Select review type</option>
      <option value="routine">Routine Review</option>
      <option value="incident">Incident / Fall</option>
      <option value="hospital">Post Hospital Discharge</option>
      <option value="change">Change in Needs</option>
    </select>

    <TextAreaField
  value={form.update_reason}
  onChange={(val) => handleInput("update_reason", val)}
  placeholder="Reason for update..."
  disabled={viewMode}
/>
  </div>
)}
      {/* SUBMIT */}
      
    {!viewMode && (
  <button
  type="button"
    onClick={() => {
      setSaving("saving");
      handleSubmit();
    }}
    className="w-full bg-green-600 py-3 rounded mt-6"
  >
    {loading ? "Saving..." : "Save assessments"}
  </button>
)}

       <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg mt-6 border border-yellow-500">
        <p className="text-sm text-[var(--muted)] mb-3">
          Without upgrade:
          • No automatic escalation alerts  
          • No advanced risk scoring  
          • No referral tracking automation  
          • No compliance monitoring.

          Upgrade to enable full safety protection.
        </p>

        <button
        type="button"
          onClick={() => router.push("/upgrade")}
          className="bg-yellow-500 text-black px-4 py-2 rounded"
        >
          Unlock
        </button>
      </div>
{pdfMode === "family" && (
  <div id="family-pdf" style={{ display: "none" }}>
    <FamilyPDFView />
  </div>
)}
</div>
      </div>
      )}
    </>
  );
}
export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AssessmentPageContent />
    </Suspense>
  );
}