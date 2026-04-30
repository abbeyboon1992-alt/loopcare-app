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
  let mounted = true;

  const loadAccess = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession(); // ✅ SAFE

    const user = session?.user;

    if (!mounted) return;

    if (!user) {
      setAccess(null);
      return;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organisation_id, account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organisation_id) {
      setAccess(null);
      return;
    }

    const { data } = await supabase
      .from("organisations")
      .select("subscription_status, trial_end")
      .eq("id", profile.organisation_id)
      .single();

    const trialEnd = data?.trial_end || null;

    const isTrialActive =
      !!trialEnd && new Date(trialEnd).getTime() > Date.now();

    const isPaid = data?.subscription_status === "active";

    if (!mounted) return;

    setAccess({
      plan: isPaid || isTrialActive ? "pro" : "free",
      accountType: profile.account_type || "solo",
      isTrialActive,
      trial_end: trialEnd,
      daysLeft: trialEnd
        ? Math.max(
            0,
            Math.ceil(
              (new Date(trialEnd).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0,
    });
  };

  loadAccess();

  const { data: listener } = supabase.auth.onAuthStateChange(() => {
    loadAccess();
  });

  return () => {
    mounted = false;
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