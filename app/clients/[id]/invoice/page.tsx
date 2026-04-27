"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CreateInvoicePage() {
  const { id } = useParams();
  const router = useRouter();

  const [visits, setVisits] = useState<any[]>([]);
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);

  useEffect(() => {
    loadVisits();
  }, [id]);

  const loadVisits = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (data) setVisits(data);
  };

  const toggleVisit = (visitId: string) => {
    setSelectedVisits((prev) =>
      prev.includes(visitId)
        ? prev.filter((v) => v !== visitId)
        : [...prev, visitId]
    );
  };

  const createInvoice = async () => {
    const selected = visits.filter((v) =>
      selectedVisits.includes(v.id)
    );

    const visit_count = selected.length;
    const total_hours = visit_count; // simple version
    const subtotal = visit_count * 20; // flat rate

    const { error } = await supabase.from("invoices").insert({
      client_id: id,
      visit_count,
      total_hours,
      subtotal,
    });

    if (error) {
      alert("Error creating invoice");
      return;
    }

    router.push("/invoices");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      <button
        onClick={() => router.push(`/clients/${id}`)}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Client
      </button>

      <h1 className="text-2xl mb-4">Create Invoice</h1>

      <p className="mb-4 text-[var(--muted)]">
        Select visits to include
      </p>

      {visits.map((visit) => (
        <div
          key={visit.id}
          onClick={() => toggleVisit(visit.id)}
          className={`p-3 mb-2 rounded cursor-pointer ${
            selectedVisits.includes(visit.id)
              ? "bg-green-600"
              : "bg-[var(--card)]"
          }`}
        >
          {new Date(visit.created_at).toLocaleString()}
        </div>
      ))}

      <button
        onClick={createInvoice}
        className="w-full bg-purple-600 py-3 rounded mt-4"
      >
        Create Invoice
      </button>

      <button
  onClick={() => alert("Sending soon")}
  className="bg-blue-600 px-3 py-1 rounded mt-2"
>
  Send
</button>

    </div>
  );
}