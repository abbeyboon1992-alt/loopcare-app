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

      if (!user) return;

      // 🔹 STEP 1: GET PROFILE
      let { data: profile } = await supabase
        .from("user_profiles")
        .select("organisation_id, account_type")
        .eq("user_id", user.id)
        .maybeSingle();

      let organisationId = profile?.organisation_id;

      // 🔥 AUTO CREATE (ONLY IF MISSING)
      if (!organisationId) {
        console.log("⚠️ No profile found — creating one");

        // 1️⃣ CREATE ORG WITH TRIAL
        const { data: newOrg, error: orgError } = await supabase
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

        if (orgError || !newOrg) {
          console.error("ORG CREATE ERROR:", orgError);
          return;
        }

        // 2️⃣ CREATE PROFILE
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert([
            {
              user_id: user.id,
              organisation_id: newOrg.id,
              account_type: "solo",
            },
          ]);

        if (profileError) {
          console.error("PROFILE CREATE ERROR:", profileError);
          return;
        }

        organisationId = newOrg.id;
        profile = { organisation_id: newOrg.id, account_type: "solo" };
      }

      // 🔹 STEP 2: GET ORGANISATION
      const { data, error } = await supabase
        .from("organisations")
        .select("subscription_status, trial_end")
        .eq("id", organisationId)
        .single();

      if (error || !data) {
        console.error("ACCESS LOAD ERROR:", error);
        return;
      }

      const trialEnd = data.trial_end || null;

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

      const isPaid = data.subscription_status === "active";

      // ✅ FINAL ACCESS STATE
      setAccess({
        plan: isPaid || isTrialActive ? "pro" : "free",
        accountType: profile?.account_type || "solo",
        isTrialActive,
        trial_end: trialEnd,
        daysLeft,
      });
    };

    loadAccess();
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