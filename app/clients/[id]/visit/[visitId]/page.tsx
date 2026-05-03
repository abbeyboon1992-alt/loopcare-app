"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function VisitRecordPage() {
  const params = useParams<{ id: string; visitId: string }>();
  const id = params?.id;
  const visitId = params?.visitId;

  const router = useRouter();

  const [visit, setVisit] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [assessments, setAssessments] = useState<any>(null);

  useEffect(() => {
    if (!visitId || !id) return;

    loadVisit();
    loadClient();
  }, [visitId, id]);

  const loadVisit = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("id", visitId)
      .single();

    if (data) setVisit(data);
  };

  const loadClient = async () => {
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", id)
      .maybeSingle();

    if (clientData) setClient(clientData);
    if (assessmentData) setAssessments(assessmentData);
  };

  // ✅ SAFE PARSE (visit_notes might store JSON or flat)
  const data = visit?.observations || visit || {};

  // ✅ SIMPLE ALERT ENGINE (LOCAL)
  const getClinicalAlerts = () => {
    const alerts: any[] = [];

    if (data.hydration === "poor" || data.hydration === "none") {
      alerts.push({ message: "Low hydration", severity: "high" });
    }

    if (data.mobility === "fall") {
      alerts.push({ message: "Fall recorded", severity: "critical" });
    }

    if (data.medication === "refused") {
      alerts.push({ message: "Medication refused", severity: "high" });
    }

    if (data.mood === "low" || data.mood === "distressed") {
      alerts.push({ message: "Low mood", severity: "medium" });
    }

    return alerts;
  };

  const combinedAlerts = getClinicalAlerts();

  if (!visit) {
    return (
      <div className="p-6 text-[var(--text)]">
        Loading visit...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      {/* 🧾 CLIENT SNAPSHOT */}
      {client && (
        <div className="bg-[var(--card)] p-4 rounded mb-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-2">
            {client.first_name} {client.last_name}
          </h2>

          <div className="text-sm text-[var(--muted)] space-y-1">
            <p>Care Type: {client.care_type || "-"}</p>

            {client.diagnosis?.length > 0 && (
              <p>Diagnosis: {client.diagnosis.join(", ")}</p>
            )}

            {assessments && (
              <>
                <p>Mobility: {assessments.mobility || "-"}</p>
                <p>Hydration Risk: {assessments.hydration || "-"}</p>
                <p>Skin: {assessments.skin || "-"}</p>
                <p>Cognition: {assessments.cognition || "-"}</p>
              </>
            )}
          </div>
        </div>
      )}

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
      <p className="text-[var(--muted)] text-sm mb-4">
        {new Date(visit.created_at).toLocaleString()}
      </p>

      {/* ⚠️ PRIORITY RISKS */}
      <div className="mb-4 bg-yellow-700/30 border border-yellow-600 p-3 rounded">
        <h2 className="font-semibold mb-2">⚠️ Priority Risks</h2>

        {combinedAlerts
          .filter((a) => a.severity === "high" || a.severity === "critical")
          .map((a, i) => (
            <p key={i} className="text-sm">
              • {a.message}
            </p>
          ))}

        {combinedAlerts.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            No risks identified
          </p>
        )}
      </div>

      {/* 📊 CLINICAL SUMMARY */}
      <div className="mb-4 bg-[var(--card)] p-4 rounded border border-gray-700">
        <h2 className="font-semibold mb-2">Clinical Summary</h2>

        <div className="text-sm space-y-1">
          <p>💧 Hydration: {data.hydration || "-"}</p>
          <p>🍽️ Nutrition: {data.nutrition || "-"}</p>
          <p>🚶 Mobility: {data.mobility || "-"}</p>
          <p>🚽 Toileting: {data.toileting || "-"}</p>
          <p>🙂 Mood: {data.mood || "-"}</p>
          <p>💊 Medication: {data.medication || "-"}</p>
          <p>😖 Pain: {data.pain || "-"}</p>
          <p>🫁 Breathing: {data.breathing || "-"}</p>
          <p>🧠 Cognition: {data.cognition || "-"}</p>
          <p>🧴 Skin: {data.skin || "-"}</p>
          <p>🚨 Safeguarding: {data.safeguarding || "-"}</p>
        </div>
      </div>

      {/* 🔥 RISK INTERPRETATION */}
      <div className="mb-4 bg-yellow-600/20 p-3 rounded">
        <h2 className="font-semibold mb-2">Risk Interpretation</h2>

        {combinedAlerts.map((a, i) => (
          <p key={i} className="text-sm">
            • {a.message}
          </p>
        ))}
      </div>

      {/* 🧠 ASSESSMENT WARNINGS */}
      {assessments && (
        <div className="mb-4 bg-red-700/30 border border-red-600 p-3 rounded">
          <h2 className="text-sm font-semibold mb-1">
            ⚠ Clinical Watch Points
          </h2>

          {assessments.hydration === "poor" && (
            <p>• Dehydration risk</p>
          )}

          {assessments.mobility === "high risk" && (
            <p>• Falls risk</p>
          )}

          {assessments.skin !== "intact" && (
            <p>• Skin breakdown risk</p>
          )}
        </div>
      )}

      {/* NOTES */}
      <div className="bg-[var(--card)] p-4 rounded">
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