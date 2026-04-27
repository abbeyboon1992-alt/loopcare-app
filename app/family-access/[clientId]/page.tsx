"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FamilyAccess() {
  const { clientId } = useParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [sending, setSending] = useState(false);

  const sendOtp = async () => {
  if (sending) return; // 🛑 STOP LOOP
  setSending(true);

  try {
    const res = await fetch("/api/family/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  client_id: clientId,
  email: email,
})
    });

    const data = await res.json();
    console.log("SEND OTP RESPONSE:", data);

    setStep("otp");
  } catch (err) {
    console.error(err);
  }

  setSending(false);
};

  const verifyOtp = async () => {
  const res = await fetch("/api/family/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      email: email,
      otp,
    }),
  });

  const data = await res.json();

  console.log("VERIFY RESPONSE:", data); // 🔥 IMPORTANT

  if (data.success) {
    localStorage.setItem("family_token", data.session_token);
    router.push(`/family/${clientId}`);
  } else {
    alert("Invalid code");
  }
};

  return (
    <div className="p-6 max-w-md mx-auto">

      <h1 className="text-xl font-bold mb-4">
        Family Access
      </h1>

      {step === "mobile" && (
        <>
          <input
            placeholder="Enter email address"
            value={email}
onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 text-base border rounded mb-3"
          />

          <button
  onClick={sendOtp}
  disabled={sending}
            className="w-full bg-blue-600 text-white p-3 rounded"
          >
            Send Code
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <input
            placeholder="Enter code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full p-3 text-base border rounded mb-3"
          />

          <button
            onClick={verifyOtp}
            className="w-full bg-green-600 text-white p-3 rounded"
          >
            Verify
          </button>
        </>
      )}

    </div>
  );
}