import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 bypass RLS
);

export async function POST(req: Request) {
  try {
    const { full_name, email, password, type } = await req.json();

    if (!email || !password || !type || !full_name) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase();

    // 🔒 CHECK TRIAL HISTORY
    const { data: existingTrial } = await supabaseAdmin
      .from("trial_history")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    const hasUsedTrial = !!existingTrial;

    // 🔐 CREATE AUTH USER
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true, // 🔥 skip email confirm for now
      });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message || "Auth failed" },
        { status: 400 }
      );
    }

    const user = authData.user;

    // 🏢 CREATE ORG
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organisations")
      .insert([
        {
          name: `${full_name}'s Organisation`,
          subscription_status: "free",
          trial_end: hasUsedTrial
            ? null
            : new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
        },
      ])
      .select()
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Failed to create organisation" },
        { status: 500 }
      );
    }

    // 👤 CREATE PROFILE
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert([
        {
          user_id: user.id,
          email: cleanEmail,
          full_name,
          organisation_id: org.id,
          role: type === "solo" ? "carer" : "manager",
          account_type: type,
        },
      ]);

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    // 🧠 RECORD TRIAL
    if (!hasUsedTrial) {
      await supabaseAdmin.from("trial_history").insert([
        { email: cleanEmail },
      ]);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}