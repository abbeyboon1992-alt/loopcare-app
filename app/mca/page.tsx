"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, Suspense } from "react";
import { useAccess } from "@/app/context/AccessContext";
import { canAccessFeature } from "@/lib/featureAccess";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { generateAssessmentAlerts, saveAlerts } from "@/lib/alertEngine";

function MCAPageContent() {
  const router = useRouter();
  const access = useAccess();
  if (!access) return null;
  

  // ✅ MOVE HERE (AFTER access, BEFORE other hooks logic runs)
  if (
  !canAccessFeature(
    "mcaAssessment",
    access.plan,
  access.accountType,
  access.isTrialActive
)
) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">Upgrade to access MCA assessments</p>
        <button
          onClick={() => router.push("/upgrade")}
          className="bg-yellow-500 px-4 py-2 rounded"
        >
          Upgrade
        </button>
      </div>
    );
  }

  const searchParams = useSearchParams();
  const clientId = searchParams.get("client") || "";
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [form, setForm] = useState<any>({
    client_id: clientId,
    decision: "",
    impairment: "",
    understands: "",
    retains: "",
    weighs: "",
    communicates: "",
    has_capacity: "",
    assessor_name: "",
    assessor_role: "",
    notes: "",
  });

  const handleInput = (field: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
  if (!clientId) return;

  const loadMCA = async () => {
  if (!clientId) return;

  // 👉 IF EDITING SPECIFIC MCA
  if (editId) {
    const { data } = await supabase
      .from("mca_assessments")
      .select("*")
      .eq("id", editId)
      .single();

    if (data) {
      setEditingId(data.id);

      setForm({
        client_id: clientId,
        decision: data.decision || "",
        impairment: data.impairment || "",
        understands: data.understands ? "yes" : "no",
        retains: data.retains ? "yes" : "no",
        weighs: data.weighs ? "yes" : "no",
        communicates: data.communicates ? "yes" : "no",
        has_capacity: data.has_capacity ? "yes" : "no",
        assessor_name: data.assessor_name || "",
        assessor_role: data.assessor_role || "",
        notes: data.notes || "",
      });
    }
  }
};

  loadMCA();
}, [clientId]);

useEffect(() => {
  if (!clientId) return;

  // ❌ DO NOT autosave new MCA
  if (!editingId) return;

  const timeout = setTimeout(() => {
    handleSave();
  }, 2000);

  return () => clearTimeout(timeout);
}, [form]);

  // 🧠 AUTO DETERMINE CAPACITY
  useEffect(() => {
    const { understands, retains, weighs, communicates } = form;

    if (
      understands === "yes" &&
      retains === "yes" &&
      weighs === "yes" &&
      communicates === "yes"
    ) {
      setForm((prev: any) => ({
        ...prev,
        has_capacity: "yes",
      }));
    } else if (
      understands === "no" ||
      retains === "no" ||
      weighs === "no" ||
      communicates === "no"
    ) {
      setForm((prev: any) => ({
        ...prev,
        has_capacity: "no",
      }));
    }
  }, [form.understands, form.retains, form.weighs, form.communicates]);
const [savedMcaId, setSavedMcaId] = useState<string | null>(null);
  const handleSave = async () => {
    if (!clientId) return;

    setLoading(true);
    setSaving("saving");

    const { data: userData } = await supabase.auth.getUser();

    // 💾 SAVE MCA
    let error = null;

if (editingId) {
  // ✏️ UPDATE EXISTING MCA
  const res = await supabase
    .from("mca_assessments")
    .update({
      decision: form.decision,
      impairment: form.impairment,
      understands: form.understands === "yes",
      retains: form.retains === "yes",
      weighs: form.weighs === "yes",
      communicates: form.communicates === "yes",
      has_capacity: form.has_capacity === "yes",
      assessor_name: form.assessor_name,
      assessor_role: form.assessor_role,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editingId);

} else {
  // ➕ CREATE NEW MCA
  const { data: inserted, error: insertError } = await supabase
  .from("mca_assessments")
  .insert({
    client_id: clientId,
    decision: form.decision,
    impairment: form.impairment,
    understands: form.understands === "yes",
    retains: form.retains === "yes",
    weighs: form.weighs === "yes",
    communicates: form.communicates === "yes",
    has_capacity: form.has_capacity === "yes",
    assessor_name: form.assessor_name,
    assessor_role: form.assessor_role,
    notes: form.notes,
    created_by: userData?.user?.id,
  })
  .select()
  .single();

error = insertError;

// ✅ STORE ID
if (inserted?.id) {
  setSavedMcaId(inserted.id);
}
}

    if (error) {
      alert(error.message);
      setLoading(false);
      setSaving("idle");
      return;
    }

    // 🔗 UPDATE MAIN assessments
    await supabase
      .from("assessments")
      .update({
        mca_completed: true,
        capacity: form.has_capacity === "yes" ? "has capacity" : "lacks capacity",
        best_interest_required: form.has_capacity === "no" ? "yes" : "no",
      })
      .eq("client_id", clientId);

      // 🔥 RE-RUN ALERT ENGINE AFTER MCA SAVE
const { data: updatedAssessment } = await supabase
  .from("assessments")
  .select("*")
  .eq("client_id", clientId)
  .single();

if (updatedAssessment) {
  const alerts = generateAssessmentAlerts(updatedAssessment);

  // 🏢 GET ORGANISATION ID
const { data: profile } = await supabase
  .from("user_profiles")
  .select("organisation_id")
  .eq("user_id", userData?.user?.id)
  .single();

const orgId = profile?.organisation_id;

if (!orgId) return;

await saveAlerts({
  clientId,
  organisation_id: orgId,
  visit_id: null,
  alerts,
});
}

   setSaving("saved");

// ✅ DETERMINE FINAL MCA ID
const finalMcaId = editingId || savedMcaId || "";

setTimeout(() => {
  if (form.has_capacity === "no") {
    router.push(
      `/best-interest?client=${clientId}&mca=${finalMcaId}`
    );
  } else {
    router.push(
      `/assessments?client=${clientId}&section=cognition`
    );
  }
}, 1200);
  };

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
        Mental Capacity assessments
      </h1>

      {/* DECISION */}
      <textarea
        placeholder="What decision is being assessed?"
        value={form.decision}
        onChange={(e) => handleInput("decision", e.target.value)}
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* IMPAIRMENT */}
      <textarea
        placeholder="Is there an impairment of mind or brain?"
        value={form.impairment}
        onChange={(e) => handleInput("impairment", e.target.value)}
        className="w-full p-3 text-base mb-6 rounded bg-[var(--card)]"
      />

      {/* 4 STAGE TEST */}
      {[
        { key: "understands", label: "Can they understand the information?" },
        { key: "retains", label: "Can they retain the information?" },
        { key: "weighs", label: "Can they weigh up the decision?" },
        { key: "communicates", label: "Can they communicate the decision?" },
      ].map((q) => (
        <div key={q.key} className="mb-4">
          <p className="mb-2">{q.label}</p>

          <div className="flex gap-2">
            {["yes", "no"].map((opt) => (
              <button
                key={opt}
                onClick={() => handleInput(q.key, opt)}
                className={`px-3 py-2 rounded ${
                  form[q.key] === opt
                    ? "bg-blue-600"
                    : "bg-gray-600"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* RESULT */}
      {form.has_capacity && (
        <div
          className={`p-3 rounded mb-4 ${
            form.has_capacity === "yes"
              ? "bg-green-600"
              : "bg-red-600"
          }`}
        >
          {form.has_capacity === "yes"
            ? "✅ Has capacity"
            : "❌ Lacks capacity"}
        </div>
      )}

      {/* ASSESSOR */}
      <input
        placeholder="Assessor name"
        value={form.assessor_name}
        onChange={(e) =>
          handleInput("assessor_name", e.target.value)
        }
        className="w-full p-3 text-base mb-3 rounded bg-[var(--card)]"
      />

      <input
        placeholder="Assessor role"
        value={form.assessor_role}
        onChange={(e) =>
          handleInput("assessor_role", e.target.value)
        }
        className="w-full p-3 text-base mb-4 rounded bg-[var(--card)]"
      />

      {/* NOTES */}
      <textarea
        placeholder="Additional notes..."
        value={form.notes}
        onChange={(e) => handleInput("notes", e.target.value)}
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
          : "Save MCA assessments"}
      </button>
    </div>
  );
}
export default function MCAPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MCAPageContent />
    </Suspense>
  );
}