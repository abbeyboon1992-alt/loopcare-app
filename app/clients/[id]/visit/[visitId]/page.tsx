"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function VisitRecordPage() {
  const { id, visitId } = useParams();
  const router = useRouter();

  const [visit, setVisit] = useState<any>(null);

  useEffect(() => {
    loadVisit();
  }, [visitId]);

  const loadVisit = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("id", visitId)
      .single();

    if (data) setVisit(data);
  };

  if (!visit) {
    return (
      <div className="p-6 text-[var(--text)]">
        Loading visit...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      {/* 🔙 BACK */}
      <button
        onClick={() => router.push(`/clients/${id}/visits`)}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Visit History
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Visit Record
      </h1>

      {/* DATE */}
      <div className="mb-4">
        <p className="text-[var(--muted)] text-sm">
          {new Date(visit.created_at).toLocaleString()}
        </p>
      </div>

      {/* OBSERVATIONS */}
      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-4">
        <h2 className="font-semibold mb-2">Observations</h2>

        <p>💧 Hydration: {visit.hydration || "-"}</p>
        <p>🍽️ Nutrition: {visit.nutrition || "-"}</p>
        <p>🚶 Mobility: {visit.mobility || "-"}</p>
        <p>🚽 Toileting: {visit.toileting || "-"}</p>
        <p>🙂 Mood: {visit.mood || "-"}</p>
        <p>💊 Medication: {visit.medication || "-"}</p>
      </div>

      {/* ALERTS (SIMPLE SOLO VERSION) */}
      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-4">
        <h2 className="font-semibold mb-2">Alerts</h2>

        {visit.hydration === "low" && (
          <div className="bg-orange-500 p-2 rounded mb-2">
            ⚠️ Low hydration
          </div>
        )}

        {visit.mood === "low" && (
          <div className="bg-yellow-500 p-2 rounded mb-2">
            💬 Low mood observed
          </div>
        )}

        {visit.medication === "refused" && (
          <div className="bg-red-600 p-2 rounded mb-2">
            🚨 Medication refused
          </div>
        )}

        {visit.hydration !== "low" &&
          visit.mood !== "low" &&
          visit.medication !== "refused" && (
            <p className="text-[var(--muted)]">No alerts</p>
          )}
      </div>

      {/* NOTES */}
      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg">
        <h2 className="font-semibold mb-2">Notes</h2>

        {visit.notes ? (
          <p>{visit.notes}</p>
        ) : (
          <p className="text-[var(--muted)]">No notes recorded</p>
        )}
      </div>

    </div>
  );
}