"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function VisitHistoryPage() {
  const { id } = useParams();
  const router = useRouter();

  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    loadVisits();
  }, [id]);

  const loadVisits = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      if (!id) return;

const { data } = await supabase
  .from("visit_notes")
  .select("*")
  .eq("client_id", id as string);
      .order("created_at", { ascending: false });

    if (data) setVisits(data);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      <button
        onClick={() => router.push(`/clients/${id}`)}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Client
      </button>

      <h1 className="text-2xl font-bold mb-6">
        Visit History
      </h1>

      {visits.length === 0 && (
        <p className="text-gray-500">No visits recorded</p>
      )}

      {visits.map((visit) => (
        <div
          key={visit.id}
          onClick={() => router.push(`/clients/${id}/visits/${visit.id}`)}
          className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-3 cursor-pointer hover:bg-[#334155]"
        >
          <p className="text-sm">
            {new Date(visit.created_at).toLocaleString()}
          </p>

          <p className="text-[var(--muted)] text-sm">
            Mood: {visit.mood || "-"} | Hydration: {visit.hydration || "-"}
          </p>
        </div>
      ))}

    </div>
  );
}