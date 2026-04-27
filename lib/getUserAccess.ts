import { supabase } from "@/lib/supabase";

export async function getUserAccess() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organisation_id, account_type")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile) return null;

  // ✅ FIX: guard against missing org
  if (!profile.organisation_id) {
    console.log("❌ No organisation_id yet");
    return null;
  }

  // ✅ SINGLE org query (correct)
  const { data: org } = await supabase
    .from("organisations")
    .select("subscription_status, trial_end")
    .eq("id", profile.organisation_id)
    .maybeSingle();

  if (!org) return null;

  // ✅ trial logic
  const trialEnd = org.trial_end
    ? new Date(org.trial_end).getTime()
    : null;

  const isTrialActive =
    trialEnd !== null && trialEnd > Date.now();

  // ✅ plan logic (trial counts as pro)
  const plan =
    org.subscription_status === "active" || isTrialActive
      ? "pro"
      : "free";

  return {
    plan,
    accountType: profile.account_type,
    organisation_id: profile.organisation_id,
    trial_end: org.trial_end,
    isTrialActive,
  };
}