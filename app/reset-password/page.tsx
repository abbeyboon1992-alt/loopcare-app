"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (!password) {
      alert("Enter a new password");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card)] text-white p-6">
      <div className="bg-[var(--card)] p-6 rounded w-full max-w-md">
        <h1 className="text-xl mb-4">Reset Password</h1>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 rounded bg-[var(--card)]"
        />

        <button
          onClick={updatePassword}
          disabled={loading}
          className="w-full bg-green-600 py-3 rounded"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}