"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [attempts, setAttempts] = useState(0);

  const login = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  });

  if (error) {
  const newAttempts = attempts + 1;
  setAttempts(newAttempts);

  if (newAttempts >= 2) {
    router.push("/signup");
    return;
  }

  setErrorMsg(
  newAttempts === 1
    ? "Incorrect details. Don’t have an account?"
    : "Still not working. Let’s get you set up."
);
  return;
}

  // ✅ reset attempts on success
  setAttempts(0);

  router.push("/clients");
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card)] text-white p-6">
      <div className="bg-[var(--card)] p-6 rounded w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
  <Image
    src="/logo.png"
    alt="LoopCare"
    width={100}
    height={100}
    className="mb-3 drop-shadow-lg"
    priority
  />

  <h1 className="text-2xl font-bold">
    Login
  </h1>
</div>
<p className="text-sm text-gray-400 mt-1">
  Welcome back
</p>
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          className="w-full p-3 text-base mb-3 bg-[var(--card)] rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
          className="w-full p-3 text-base mb-4 bg-[var(--card)] rounded"
        />

        {errorMsg && (
  <div className="mb-3 text-sm">
    <p className="text-red-400">{errorMsg}</p>

    {attempts >= 1 && (
      <button
        onClick={() =>
          router.push(`/signup?email=${encodeURIComponent(form.email)}`)
        }
        className="mt-2 text-blue-400 underline text-xs"
      >
        Create an account instead →
      </button>
    )}
  </div>
)}

        <button
          onClick={login}
          className="w-full bg-blue-600 py-3 rounded"
        >
          Login
        </button>

        <button
  onClick={async () => {
    if (!form.email) {
      alert("Enter your email first");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      form.email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent. Check your inbox.");
  }}
  className="w-full mt-3 text-sm text-blue-400 underline"
>
  Forgot password?
</button>
      </div>
    </div>
  );
}