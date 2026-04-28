import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  "https://xgprqmtxtzukawbilkap.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncHJxbXR4dHp1a2F3Ymlsa2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjYzNDkyNywiZXhwIjoyMDg4MjEwOTI3fQ.lm6RWxAMCwp0i9xF1bnHc85DgmOJfEMNeyi7g0MzsT8"
);

export async function POST(req: Request) {
  try {
    console.log("🔥 SEND OTP API HIT"); // ✅ ADD THIS
    const { client_id, email } = await req.json();
    console.log("📩 REQUEST BODY:", { client_id, email });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("🔢 OTP GENERATED:", otp);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    const { data, error } = await supabase
  .from("family_portal_sessions")
  .insert({
    client_id,
    family_member_name: "Family",
    email,
    otp_code: otp,
    otp_expires_at: expiry,
    verified: false,
  })
  .select(); // 👈 IMPORTANT

console.log("INSERT DATA:", data);
console.log("INSERT ERROR:", error);

if (error) {
  console.error("❌ INSERT ERROR:", error);
} else {
  console.log("✅ INSERT SUCCESS");
}

if (error) {
  console.error("❌ INSERT ERROR:", error);
}
console.log("💾 INSERT RESULT:", error); // ✅ ADD THIS

if (error) {
  console.error("❌ INSERT FAILED:", error);
}

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
  from: "LoopCare <onboarding@resend.dev>",
  to: email,
  subject: "Your Care Portal Code",
  html: `<p>Your OTP is <strong>${otp}</strong></p>`,
});

console.log("EMAIL RESULT:", result);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}