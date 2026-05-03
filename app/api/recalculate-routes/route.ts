import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { client_id } = await req.json();

  if (!client_id) {
    return NextResponse.json({ error: "Missing client_id" });
  }

  // 🔥 simple trigger — you can expand later
  // for now just log or mark routes stale

  console.log("🔄 Recalculate routes for:", client_id);

  return NextResponse.json({ success: true });
}