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
  useEffect(() => {
  console.log("🔁 RENDER", Date.now());
});
  const [access, setAccess] = useState<AccessType | null>(null);

  useEffect(() => {
  const loadAccess = async () => {

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

    if (!organisationId) {
  console.log("❌ No organisation linked to user");
  setAccess(null);
  return;
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

    setAccess((prev) => {
  const next: AccessType = {
    plan: (isPaid || isTrialActive ? "pro" : "free") as "free" | "pro",
    accountType: profile?.account_type || "solo",
    isTrialActive,
    trial_end: trialEnd,
    daysLeft,
  };

  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return prev;
  }

  return next;
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

export const useAccess = (): AccessType | null => {
  return useContext(AccessContext);
};