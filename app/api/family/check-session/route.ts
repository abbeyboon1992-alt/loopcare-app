import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 server only
);

export async function GET(req: Request) {
  try {
    // 🔑 GET TOKEN FROM HEADERS
    const token = req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    // 🔍 FIND SESSION
    const { data: session } = await supabase
      .from("family_portal_sessions")
      .select("*")
      .eq("session_token", token)
      .single();

    if (!session) {
      return NextResponse.json({ valid: false });
    }

    // ⏱️ CHECK EXPIRY
    if (new Date(session.otp_expires_at) < new Date()) {
      return NextResponse.json({ valid: false });
    }

    // 👤 GET CLIENT → ORGANISATION → PLAN
    const { data: client } = await supabase
      .from("clients")
      .select("organisation_id")
      .eq("id", session.client_id)
      .single();

    const { data: org } = await supabase
      .from("organisations")
      .select("subscription_status")
      .eq("id", client?.organisation_id)
      .single();

    return NextResponse.json({
      valid: true,
      clientId: session.client_id,
      plan: org?.subscription_status || "free",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ valid: false });
  }
}