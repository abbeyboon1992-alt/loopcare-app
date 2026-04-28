"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

function SignupPageContent() {

  const searchParams = useSearchParams();
const emailFromQuery = searchParams.get("email");
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
  full_name: "",
  email: emailFromQuery || "",
  password: "",
  type: "", // solo | team | family
});


 const handleSignup = async () => {
  if (!form.email || !form.password || !form.type || !form.full_name) {
    return alert("Complete all fields");
  }

  setLoading(true);
  // 🔒 CHECK IF EMAIL ALREADY USED A TRIAL
const { data: existingTrial } = await supabase
  .from("trial_history")
  .select("id")
  .eq("email", form.email.toLowerCase())
  .maybeSingle();
  

const hasUsedTrial = !!existingTrial;

 // 🔐 1. CREATE AUTH USER
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: form.email.toLowerCase(),
  password: form.password,
});

if (authError) {
  setLoading(false);
  alert(authError.message);
  return;
}

const user = authData?.user;

if (!user) {
  setLoading(false);
  alert("Signup failed - no user returned");
  return;
} 

// 🧠 FIX: wait for Supabase session to be ready
await new Promise((resolve) => setTimeout(resolve, 500));

  // 🏢 2. CREATE ORGANISATION (NO user_id HERE)
  const { data: org, error: orgError } = await supabase
  .from("organisations")
  .insert([
    {
      name: `${form.full_name}'s Organisation`,
      subscription_status: "free", 
trial_end: hasUsedTrial
  ? null
  : new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
    },
  ])
  .select()
  .single();

  if (orgError) {
    setLoading(false);
    console.error("ORG ERROR:", orgError);
    alert("Failed to create organisation");
    return;
  }

  // 🧠 RECORD TRIAL USAGE
if (!hasUsedTrial) {
  await supabase.from("trial_history").insert([
    {
      email: form.email.toLowerCase(),
    },
  ]);
}

  // 👤 3. CREATE USER PROFILE (LINK USER → ORG)
  const { data: profileData, error: profileError } = await supabase
  .from("user_profiles")
  .insert([
    {
      user_id: user.id,
      email: form.email.toLowerCase(),
      full_name: form.full_name,
      organisation_id: org.id,
      role: form.type === "solo" ? "carer" : "manager",
      account_type: form.type,
    },
  ])
  .select();

console.log("PROFILE INSERT RESULT:", profileData);
console.log("PROFILE INSERT ERROR:", profileError);

  if (profileError) {
    setLoading(false);
    console.error("PROFILE ERROR:", profileError);
    alert(profileError.message);
    return;
  }

  setLoading(false);

  router.push("/clients");
};

useEffect(() => {
  if (emailFromQuery) {
    setForm((prev) => ({
      ...prev,
      email: emailFromQuery,
    }));
  }
}, [emailFromQuery]);

  return (
    <div className="relative z-[10000] min-h-screen flex items-center justify-center bg-[var(--card)] p-6 text-white">

      <div className="w-full max-w-md bg-[var(--card)] p-6 rounded-xl">

        <h1 className="text-2xl font-bold mb-4">
          Create Account
        </h1>

        <input
          placeholder="Full name"
          value={form.full_name}
          onChange={(e) =>
            setForm({ ...form, full_name: e.target.value })
          }
          className="w-full p-3 text-base mb-3 rounded bg-[var(--card)] text-white"
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          className="w-full p-3 text-base mb-3 rounded bg-[var(--card)] text-white"
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
          className="w-full p-3 text-base mb-3 rounded bg-[var(--card)] text-white"
        />

        <p className="text-sm text-[var(--muted)] mb-2">
          How will you use LoopCare?
        </p>

        <div className="flex flex-col gap-2 mb-4">

          {[
            { label: "Solo private carer", value: "solo" },
            { label: "Care team / agency", value: "team" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setForm({ ...form, type: opt.value })
              }
              className={`p-3 rounded text-left ${
                form.type === opt.value
                  ? "bg-blue-600"
                  : "bg-[var(--card)]"
              }`}
            >
              {opt.label}
            </button>
          ))}

        </div>

        <button
          onClick={handleSignup}
          className="w-full bg-green-600 py-3 rounded"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

      </div>
    </div>
  );
    }
    export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SignupPageContent />
    </Suspense>
  );
}