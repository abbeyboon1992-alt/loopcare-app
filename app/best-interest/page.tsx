"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { generateAssessmentAlerts, saveAlerts, injectBestInterestIntoCarePlan } from "@/lib/alertEngine";

function BestInterestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client");
  const editId = searchParams.get("edit");
  const mcaIdFromUrl = searchParams.get("mca");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedMcaId, setLinkedMcaId] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
  client_id: clientId,
  decision: "",
  people_consulted: "",
  wishes: "",
  beliefs_values: "",
  least_restrictive_option: "",
  outcome: "",
  rationale: "",
});

  const handleInput = (field: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!clientId) return;

    setLoading(true);
    setSaving("saving");

    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
  .from("user_profiles")
  .select("organisation_id")
  .eq("user_id", userData?.user?.id)
  .single();

const orgId = profile?.organisation_id;

    // 💾 SAVE BEST INTEREST
   let error = null;

if (editingId) {
  // ✏️ UPDATE
  const res = await supabase
    .from("best_interest_decisions")
    .update({
  organisation_id: orgId,
  linked_mca_id: linkedMcaId,
  decision: form.decision,
  people_consulted: form.people_consulted
    ? form.people_consulted.split(",").map((p: string) => p.trim())
    : [],
  wishes: form.wishes,
  beliefs_values: form.beliefs_values,
  least_restrictive_option: form.least_restrictive_option,
  outcome: form.outcome,
  rationale: form.rationale,
  updated_at: new Date().toISOString(),
  updated_by: userData?.user?.id, // ✅ HERE
})
    .eq("id", editingId);

  error = res.error;
} else {
  // ➕ CREATE NEW
  const res = await supabase
    .from("best_interest_decisions")
.insert({
  organisation_id: orgId, // 🔥 ADD THIS
  linked_mca_id: linkedMcaId,// 🔥 THIS IS THE LINK
  decision: form.decision,
      people_consulted: form.people_consulted
        ? form.people_consulted.split(",").map((p: string) => p.trim())
        : [],
      wishes: form.wishes,
      beliefs_values: form.beliefs_values,
      least_restrictive_option: form.least_restrictive_option,
      outcome: form.outcome,
      rationale: form.rationale,
      created_by: userData?.user?.id,
      updated_by: userData?.user?.id,
    });

  error = res.error;
}

    // 🔗 UPDATE MAIN assessments
    await supabase
      .from("assessments")
      .update({
        best_interest_completed: "yes",
      })
      .eq("client_id", clientId);

      // 🔥 RE-RUN ALERT ENGINE AFTER BEST INTEREST SAVE
const { data: updatedAssessment } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", clientId)
  .single();

if (updatedAssessment) {
  const alerts = generateAssessmentAlerts(updatedAssessment);

  await saveAlerts({
  clientId,
  organisation_id: orgId,
  visit_id: null,
  alerts,
});
await injectBestInterestIntoCarePlan({ clientId });
}


    setSaving("saved");

    setTimeout(() => {
      router.push(`/assessments?client=${clientId}`);
    }, 1200);
  };

  useEffect(() => {
  if (!clientId) return;

  const loadBestInterest = async () => {
  if (!clientId) return;

  // 👉 EDIT MODE
  if (editId) {
    const { data } = await supabase
      .from("best_interest_decisions")
      .select("*")
      .eq("id", editId)
      .single();

    if (data) {
      setEditingId(data.id);
      setLinkedMcaId(data.linked_mca_id || null);

      setForm({
        client_id: clientId,
        decision: data.decision || "",
        people_consulted: Array.isArray(data.people_consulted)
          ? data.people_consulted.join(", ")
          : "",
        wishes: data.wishes || "",
        beliefs_values: data.beliefs_values || "",
        least_restrictive_option: data.least_restrictive_option || "",
        outcome: data.outcome || "",
        rationale: data.rationale || "",
      });
    }
  }
};
  loadBestInterest();
}, [clientId]);

useEffect(() => {
  if (!clientId) return;

  // ❌ DO NOT autosave new records
  if (!editingId) return;

  const timeout = setTimeout(() => {
    handleSave();
  }, 2000);

  return () => clearTimeout(timeout);
}, [form, editingId]);

useEffect(() => {
  if (!clientId) return;

  const getMca = async () => {
    // ✅ PRIORITY 1: URL PARAM
    if (mcaIdFromUrl) {
      setLinkedMcaId(mcaIdFromUrl);
      return;
    }

    // ✅ PRIORITY 2: LATEST MCA
    const { data } = await supabase
      .from("mca_assessments")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      setLinkedMcaId(data.id);
    }
  };

  getMca();
}, [clientId, mcaIdFromUrl]);

  return (
    <div className="min-h-screen bg-[var(--card)] text-white p-6 max-w-2xl mx-auto">

      <button
  onClick={() =>
  router.push(`/assessments?client=${clientId}&section=cognition`)
}
  className="mb-4 text-sm text-blue-400"
>
  ← Complete later
</button>

      <h1 className="text-2xl font-bold mb-6">
        Best Interest Decision
      </h1>

      {/* DECISION */}
      <textarea
        placeholder="What decision is being made?"
        value={form.decision}
        onChange={(e) => handleInput("decision", e.target.value)}
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* PEOPLE CONSULTED */}
      <textarea
        placeholder="Who was consulted? (comma separated e.g. daughter, GP, carer)"
        value={form.people_consulted}
        onChange={(e) =>
          handleInput("people_consulted", e.target.value)
        }
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* WISHES */}
      <textarea
        placeholder="Known wishes and feelings of the person"
        value={form.wishes}
        onChange={(e) => handleInput("wishes", e.target.value)}
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* BELIEFS */}
      <textarea
        placeholder="Beliefs, values, cultural considerations"
        value={form.beliefs_values}
        onChange={(e) =>
          handleInput("beliefs_values", e.target.value)
        }
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* LEAST RESTRICTIVE */}
      <textarea
        placeholder="Least restrictive option considered"
        value={form.least_restrictive_option}
        onChange={(e) =>
          handleInput("least_restrictive_option", e.target.value)
        }
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* OUTCOME */}
      <textarea
        placeholder="Final decision / outcome"
        value={form.outcome}
        onChange={(e) => handleInput("outcome", e.target.value)}
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* RATIONALE */}
      <textarea
        placeholder="Rationale for decision (why this is in best interest)"
        value={form.rationale}
        onChange={(e) => handleInput("rationale", e.target.value)}
        className="w-full p-3 text-base mb-6 rounded bg-[var(--card)]"
      />

      {/* SAVE */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-green-600 py-3 rounded"
      >
        {saving === "saving"
          ? "Saving..."
          : saving === "saved"
          ? "Saved"
          : "Save Best Interest Decision"}
      </button>
    </div>
  );
}
export default function BestInterestPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BestInterestPageContent />
    </Suspense>
  );
}