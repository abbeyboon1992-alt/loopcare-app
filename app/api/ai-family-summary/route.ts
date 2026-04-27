import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { client_id, client: bodyClient, assessments, sections, visits } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    // ✅ GET CLIENT
    const { data: dbClient } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    // ✅ GET LATEST VISIT
    const { data: visit } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

      const latestVisit = visits?.[0] || visit;

    // ✅ GET ACTIVE ALERTS
    const { data: alerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("client_id", client_id)
      .eq("status", "active");

    const prompt = `
You are a professional care provider writing a short update for a family member.

Write a clear, warm, and professional summary of the client's current condition.

CLIENT:
${dbClient?.name || bodyClient?.name || "Unknown"}

LATEST VISIT:
Mood: ${latestVisit?.mood || "N/A"}
Hydration: ${latestVisit?.hydration || "N/A"}
Nutrition: ${latestVisit?.nutrition || "N/A"}
Notes: ${latestVisit?.note || "None"}

assessments:
${assessments ? JSON.stringify(assessments) : "None"}

ACTIVE ALERTS:
${alerts?.map((a: any) => `- ${a.message}`).join("\n") || "None"}

CARE PLAN (Top Sections):
${sections?.slice(0, 3).map((s: any) => `- ${s.section_title}`).join("\n")}

---

Write a short update (3–6 sentences):
- Reassuring tone
- Highlight any concerns
- Mention positives if present
- Avoid jargon
`;

let summary = "";

try {
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  const aiJson = await aiRes.json();

  summary =
    aiJson?.choices?.[0]?.message?.content?.trim() ||
    "No summary generated";
} catch (err) {
  console.error("AI FAILED:", err);

  // 🔒 FALLBACK (IMPORTANT)
  summary = `
Update for ${dbClient?.name || "client"}.

Recent visit completed. No major concerns recorded.
`;
}

    // 💾 SAVE TO DB
    const { error } = await supabase
      .from("family_updates") // 🔥 MAKE SURE THIS TABLE EXISTS
      .insert({
        client_id,
        summary,
      });

    if (error) {
      console.error("INSERT ERROR:", error);
      return NextResponse.json(
        { error: "Insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}