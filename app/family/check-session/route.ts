import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { token } = await req.json();

  const { data } = await supabase
    .from("family_portal_sessions")
    .select("*")
    .eq("session_token", token)
    .eq("verified", true)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ valid: false });
  }

  // ⏱️ SESSION TIMEOUT (2 hours)
  const lastActive = new Date(data.last_active);
  const now = new Date();

  const diff = (now.getTime() - lastActive.getTime()) / 1000 / 60;

  if (diff > 120) {
    return NextResponse.json({ valid: false });
  }

  // 🔄 update activity
  await supabase
    .from("family_portal_sessions")
    .update({ last_active: new Date() })
    .eq("id", data.id);

  return NextResponse.json({ valid: true });
}