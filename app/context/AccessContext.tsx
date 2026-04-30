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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;

        if (!active) return;

        if (!user) {
          setAccess(null);
          setLoading(false);
          return;
        }

        // PROFILE
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organisation_id, account_type")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (!profile?.organisation_id) {
          setAccess(null);
          setLoading(false);
          return;
        }

        // ORG
        const { data: org } = await supabase
          .from("organisations")
          .select("subscription_status, trial_end")
          .eq("id", profile.organisation_id)
          .single();

        if (!active) return;

        const trialEnd = org?.trial_end || null;

        const isTrialActive =
          !!trialEnd && new Date(trialEnd).getTime() > Date.now();

        const isPaid = org?.subscription_status === "active";

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

        setLoading(false);
      } catch (err) {
        console.error("Access load error:", err);
        if (active) {
          setAccess(null);
          setLoading(false);
        }
      }
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔥 CRITICAL: DO NOT render children until stable
  if (loading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  return (
    <AccessContext.Provider value={access}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  return useContext(AccessContext);
};