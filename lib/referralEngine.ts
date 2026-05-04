import { supabase } from "@/lib/supabase";

export const createReferral = async (payload: {
  client_id: string;
  referral_type: string;
  details: string;
  organisation_id?: string;
  status?: string;
}) => {
  const { error } = await supabase.from("referrals").insert([
    {
      ...payload,
      status: payload.status || "pending",
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Referral error:", error);
    throw error;
  }

  return true;
};