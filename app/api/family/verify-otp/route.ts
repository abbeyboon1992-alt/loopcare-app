import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xgprqmtxtzukawbilkap.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncHJxbXR4dHp1a2F3Ymlsa2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjYzNDkyNywiZXhwIjoyMDg4MjEwOTI3fQ.lm6RWxAMCwp0i9xF1bnHc85DgmOJfEMNeyi7g0MzsT8"
);
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const { client_id, email, otp } = await req.json();
  console.log("🔍 VERIFY INPUT:", {
  client_id,
  email,
  otp,
});

  const { data } = await supabase
    .from("family_portal_sessions")
    .select("*")
    .eq("client_id", client_id)
.eq("email", email)
    .eq("otp_code", otp)
    .eq("verified", false)
    .maybeSingle();
    console.log("VERIFY DATA:", data);

  if (!data) {
    return NextResponse.json({ success: false });
  }

  // ⏱ check expiry
  if (new Date(data.otp_expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: "expired" });
  }

  const sessionToken = randomUUID();

  await supabase
    .from("family_portal_sessions")
    .update({
      verified: true,
      session_token: sessionToken,
      last_active: new Date(),
    })
    .eq("id", data.id);

  return NextResponse.json({
    success: true,
    session_token: sessionToken,
  });
}