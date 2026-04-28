"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
   <div className="min-h-screen bg-gradient-to-br bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#16a34a] flex flex-col items-center justify-center px-4">

    <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-3 z-10">
  The Care Operating System for Private Carers
</h1>

    {/* 🔥 BACKGROUND */}
    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
      <div className="w-[500px] h-[500px] bg-gradient-to-r from-blue-500/20 to-green-400/20 blur-3xl rounded-full" />
    </div>

    {/* 🧠 BRAND */}
    <div className="z-10 flex flex-col items-center mb-2">

  <img
    src="/icon-192.png"
    alt="LoopCare Logo"
    className="w-40 h-40 object-contain"
  />

</div>

    <p className="text-gray-300 mb-6 text-center max-w-md z-10">
  Run your care business, log visits in seconds, and automatically detect clinical risks, safeguarding concerns, and deterioration — all in one place.
</p>

    {/* 🔑 AUTH BUTTONS */}
    <div className="flex flex-col gap-3 w-full max-w-sm z-10">

      <button
        onClick={() => router.push("/signup")}
        className="py-4 rounded-xl bg-gradient-to-r from-[#2F5FAF] to-[#6BCB3D] hover:opacity-90 transition"
      >
        Create Free Account
      </button>

      <p className="text-xs text-white/90 text-center mt-2">
  Free plan available • Upgrade for AI alerts & care planning
</p>

      <button
        onClick={() => router.push("/login")}
        className="py-3 rounded-xl border border-white/30 text-white hover:bg-white/10"
      >
        Login
      </button>

      <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded text-xs text-yellow-300 text-center mt-4">
  🔒 Pro unlocks real-time risk alerts, automatic care plans, and compliance tracking
</div>

    </div>

    {/* 🧭 FEATURES */}
    <div className="mt-16 grid gap-4 max-w-md w-full z-10">

  <div className="bg-black/40 backdrop-blur-md border border-white/10">
    <h3 className="font-semibold mb-1">⚡ Log Visits Fast</h3>
    <p className="text-sm text-white/90">
      Record care in seconds with structured inputs, voice notes, and smart tracking.
    </p>
  </div>

  <div className="bg-black/40 backdrop-blur-md border border-white/10">
    <h3 className="font-semibold mb-1">🚨 Detect Risks Automatically</h3>
    <p className="text-sm text-white/90">
      Instantly flag dehydration, falls, safeguarding issues, and deterioration.
    </p>
  </div>

  <div className="bg-black/40 backdrop-blur-md border border-white/10">
    <h3 className="font-semibold mb-1">📋 Stay Compliant Without Thinking</h3>
    <p className="text-sm text-white/90">
      Assessments, care plans, and alerts stay aligned with care standards automatically.
    </p>

  </div>
<div className="mt-10 text-center text-xs text-gray-500 z-10">
  Built for solo carers, private carers, and small care teams
</div>
</div>

    </div>
);
}