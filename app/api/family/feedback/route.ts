import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 🔥 KEYWORD RULES
const concernKeywords = [
  "pain",
  "worse",
  "decline",
  "not eating",
  "not drinking",
  "refusing",
  "agitated",
  "confused",
  "fall",
  "fell",
  "bruise",
  "injury",
  "bleeding",
  "infection",
  "temperature",
  "unwell",
  "breathing",
  "shortness of breath",
  "chest pain",
  "safeguarding",
  "neglect",
  "concern",
];

export async function POST(req: Request) {
  try {
    const { client_id, message } = await req.json();
    const lower = message.toLowerCase();

const isConcern = concernKeywords.some((k) =>
  lower.includes(k)
);

    if (!client_id || !message) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("family_feedback")
      .insert({
  client_id,
  message,
  is_read: false,
  is_concern: isConcern, // 🔥 NEW
});

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Insert failed" },
        { status: 500 }
      );
    }

    // 🚨 CREATE ALERT IF CONCERN
if (isConcern) {
  await supabase.from("alerts").insert({
    client_id,
    type: "family_feedback",
    severity: "medium",
    message: `Family concern: ${message}`,
    source: "family",
    status: "active",
  });

  // 🔥 TRIGGER CARE PLAN UPDATE
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/update-careplan-from-visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id,
      data: {
        tasks: ["Review family concern"],
      },
    }),
  });
}

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}