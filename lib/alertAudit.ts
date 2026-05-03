import { supabase } from "@/lib/supabase";

export const logAlertAudit = async ({
  alert,
  action,
  previous,
  next,
  userId,
  source = "user",
}: any) => {
  try {
     const { error } = await supabase.from("alert_audit_log").insert({
      alert_id: alert.id,
      client_id: alert.client_id,
      action,
      previous_value: previous || {},
      new_value: next || {},
      performed_by: userId || null,
      source,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("🚨 AUDIT INSERT ERROR:", error);
    }
  } catch (e) {
    console.error("🚨 AUDIT LOG CRASH:", e);
  }
};