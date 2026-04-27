import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: clients } = await supabase
    .from("clients")
    .select("id");

  for (const c of clients || []) {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai-family-summary`, {
      method: "POST",
      body: JSON.stringify({ client_id: c.id }),
    });
  }

  return NextResponse.json({ success: true });
}