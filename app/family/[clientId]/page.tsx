"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function FamilyPortal() {
  const { clientId } = useParams();
  const router = useRouter();

  const [authorised, setAuthorised] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [feedback, setFeedback] = useState("");

  // ✅ CHECK SESSION
  useEffect(() => {
  const checkAccess = async () => {
    const token = localStorage.getItem("family_token");

const res = await fetch("/api/family/check-session", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
    const data = await res.json();

    // ❌ NOT LOGGED IN / INVALID SESSION
    if (!data.valid) {
      router.push(`/family-access/${clientId}`);
      return;
    }

    // 🔒 NOT PRO USER
    if (data.plan !== "pro") {
      router.push("/upgrade");
      return;
    }

    // ✅ AUTHORISED
    setAuthorised(true);
  };

  checkAccess();
}, [clientId]);

  // ✅ LOAD UPDATES (ONLY AFTER AUTHORISED)
  useEffect(() => {
    if (!authorised) return;

    const loadUpdates = async () => {
      const { data } = await supabase
        .from("family_updates")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (data) setUpdates(data);
    };

    loadUpdates();
  }, [authorised, clientId]);

  // ✅ SEND FEEDBACK
  const sendFeedback = async () => {
    await fetch("/api/family/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, feedback }),
    });

    setFeedback("");
  };

  // ✅ LOADING STATE
  if (!authorised) {
    return <p className="p-6 text-white">Checking access...</p>;
  }

  return (
    <div className="min-h-screen bg-[var(--card)] text-white p-6">
      <h1 className="text-2xl font-bold mb-6">
        Family Updates
      </h1>

      {/* 🔔 UPDATES */}
      {updates.length === 0 ? (
        <p className="text-[var(--muted)]">No updates yet</p>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <div key={u.id} className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg">
              <p className="text-sm mb-2">
                {u.summary || u.message}
              </p>

              <p className="text-xs text-[var(--muted)]">
                {new Date(u.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ✍️ FEEDBACK */}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="w-full p-3 text-base border rounded mt-6 text-black"
        placeholder="Leave feedback..."
      />

      <button
        onClick={sendFeedback}
        className="w-full mt-2 bg-blue-600 text-white p-3 rounded"
      >
        Send Feedback
      </button>
    </div>
  );
}