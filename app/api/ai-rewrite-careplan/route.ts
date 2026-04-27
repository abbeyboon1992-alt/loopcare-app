import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const prompt = `
You are a professional care planner.

Rewrite the following care plan section clearly and professionally.

Rules:
- Keep all meaning
- Do NOT remove risks
- Do NOT invent new facts
- Improve clarity and structure
- Keep it person-centred

Return JSON ONLY:
{
  "care_need": "...",
  "outcome": "...",
  "actions": "..."
}

DATA:
Section: ${body.section}

Care Need:
${body.care_need}

Outcome:
${body.outcome}

Actions:
${body.actions}

assessments:
${JSON.stringify(body.assessments)}

Diagnosis:
${JSON.stringify(body.diagnosis)}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You write professional care plans." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    const json = await response.json();

    const content = json.choices?.[0]?.message?.content;

    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("AI ERROR:", err);
    return NextResponse.json({ error: "AI failed" }, { status: 500 });
  }
}