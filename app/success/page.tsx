"use client";

import { useState, useEffect } from "react"; // ✅ FIXED
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const activatePro = async () => {
    setLoading(true);

    // 🔐 get session user
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    // 👤 get organisation
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("organisation_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.organisation_id) {
      console.error(profileError);
      setLoading(false);
      return;
    }

    // ✅ ACTIVATE PRO
    const { error } = await supabase
      .from("organisations")
      .update({
        subscription_status: "active",
        trial_end: null,
      })
      .eq("id", profile.organisation_id);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // ✅ redirect after success
    router.push("/clients");
  };

  // 🔥 AUTO RUN ON LOAD
  useEffect(() => {
    activatePro();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--card)] text-white flex items-center justify-center p-6">
      <div className="bg-[var(--card)] p-8 rounded-xl text-center max-w-md w-full">

        <h1 className="text-2xl font-bold mb-4">
          🎉 Payment Successful
        </h1>

        <p className="text-[var(--muted)] mb-6">
          {loading
            ? "Activating your account..."
            : "Done! Redirecting..."}
        </p>

      </div>
    </div>
  );
}