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
    await supabase.from("alert_audit_log").insert({
      alert_id: alert.id,
      client_id: alert.client_id,
      action,
      previous_value: previous,
      new_value: next,
      performed_by: userId,
      source,
    });
  } catch (e) {
    console.log("⚠ Audit log failed", e);
  }
};