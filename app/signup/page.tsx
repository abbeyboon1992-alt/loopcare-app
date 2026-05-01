"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

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

  const res = await fetch("/api/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });

  const data = await res.json();

  if (!res.ok) {
    setLoading(false);
    alert(data.error || "Signup failed");
    return;
  }

  // 🔐 NOW LOG USER IN (normal supabase client)
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: form.email.toLowerCase(),
    password: form.password,
  });

  if (loginError) {
    setLoading(false);
    alert("Account created, please login");
    router.push("/login");
    return;
  }

  setLoading(false);
  router.push("/clients");
};

useEffect(() => {
  if (emailFromQuery) {
    setForm((prev: any) => ({
      ...prev,
      email: emailFromQuery,
    }));
  }
}, [emailFromQuery]);

  return (
    <div className="relative z-[10000] min-h-screen flex items-center justify-center bg-[var(--card)] p-6 text-white">

      <div className="w-full max-w-md bg-[var(--card)] p-6 rounded-xl">

        <div className="flex flex-col items-center mb-4">
  <Image
    src="/icon-192.png"
    alt="LoopCare"
    width={120}
    height={120}
    className="mb-3 drop-shadow-lg"
    priority
  />

  <h1 className="text-2xl font-bold">
    Create Account
  </h1>
</div>

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