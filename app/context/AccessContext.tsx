"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccessType = {
  plan: "free" | "pro";
  accountType: string;
  isTrialActive: boolean;
  trial_end: string | null;
  daysLeft: number;
};

const AccessContext = createContext<AccessType | null>(null);

export const AccessProvider = ({ children }: { children: React.ReactNode }) => {
  const [access, setAccess] = useState<AccessType | null>(null);

  useEffect(() => {
  const loadAccess = async () => {
    await supabase.auth.refreshSession();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAccess(null);
      return;
    }

    // 🔹 PROFILE
    let { data: profile } = await supabase
      .from("user_profiles")
      .select("organisation_id, account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    let organisationId = profile?.organisation_id;

    // 🔥 AUTO CREATE IF MISSING
    if (!organisationId) {
      const { data: newOrg } = await supabase
        .from("organisations")
        .insert([
          {
            subscription_status: "free",
            trial_end: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ])
        .select()
        .single();

      await supabase.from("user_profiles").insert([
        {
          user_id: user.id,
          organisation_id: newOrg.id,
          account_type: "solo",
        },
      ]);

      organisationId = newOrg.id;
      profile = { organisation_id: newOrg.id, account_type: "solo" };
    }

    // 🔹 ORG
    const { data } = await supabase
      .from("organisations")
      .select("subscription_status, trial_end")
      .eq("id", organisationId)
      .single();

    const trialEnd = data?.trial_end || null;

    const isTrialActive =
      !!trialEnd && new Date(trialEnd).getTime() > Date.now();

    const daysLeft = trialEnd
      ? Math.max(
          0,
          Math.ceil(
            (new Date(trialEnd).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    const isPaid = data?.subscription_status === "active";

    setAccess({
      plan: isPaid || isTrialActive ? "pro" : "free",
      accountType: profile?.account_type || "solo",
      isTrialActive,
      trial_end: trialEnd,
      daysLeft,
    });
  };

  loadAccess();

  // ✅ 🔥 THIS IS THE IMPORTANT BIT YOU WERE MISSING
  const { data: listener } = supabase.auth.onAuthStateChange(() => {
    loadAccess();
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

  return (
    <AccessContext.Provider value={access}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = (): AccessType => {
  const context = useContext(AccessContext);

  // ✅ SAFE fallback with FULL shape
  if (!context) {
    return {
      plan: "free",
      accountType: "solo", // ✅ ADD THIS
      isTrialActive: false,
      trial_end: null,
      daysLeft: 0, // ✅ ADD THIS
    };
  }

  return context;
};