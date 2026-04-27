"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function InvoicesPage() {
  const router = useRouter();

  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setInvoices(data);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      {/* 🔙 BACK */}
      <button
        onClick={() => router.push("/clients")}
        className="mb-6 text-sm text-blue-400"
      >
        ← Back to Clients
      </button>

      <h1 className="text-2xl font-bold mb-6">
        Invoices
      </h1>

      {invoices.length === 0 && (
        <p className="text-gray-500">No invoices yet</p>
      )}

      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-3"
        >
          <p className="text-sm mb-1">
            {new Date(invoice.created_at).toLocaleString()}
          </p>

          <p className="text-gray-300">
            Visits: {invoice.visit_count}
          </p>

          <p className="text-gray-300">
            Hours: {invoice.total_hours}
          </p>

          <p className="font-semibold mt-2">
            £{invoice.subtotal}
          </p>
        </div>
      ))}
    </div>
  );
}