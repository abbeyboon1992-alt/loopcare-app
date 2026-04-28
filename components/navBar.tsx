"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAccess } from "@/app/context/AccessContext";
import { canAccessFeature } from "@/lib/featureAccess";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
type NavBarProps = {
  toggleTheme: () => void;
  theme: "light" | "dark";
};

export default function NavBar({ toggleTheme, theme }: NavBarProps) {
  const pathname = usePathname();

if (pathname === "/signup" || pathname === "/login") return null;
  const router = useRouter();
  const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = "/login";
};
  const [open, setOpen] = useState(false);
  const [clientCount, setClientCount] = useState(0);
const [alertCount, setAlertCount] = useState(0);
const [showAlerts, setShowAlerts] = useState(false);
const [alerts, setAlerts] = useState<any[]>([]);
const access = useAccess();
if (!access) return null;

if (access.accountType === "solo") {
  router.replace("/clients"); // smoother than push
  return null;
}

const [feedbackCount, setFeedbackCount] = useState(0);

const safeAccess = access ?? {
  plan: "free",
  accountType: "solo",
  isTrialActive: false,
  trial_end: null,
};

const loadCounts = async (orgId: string) => {
  // 👥 CLIENT COUNT
  const { count: clients } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId);

  // 🔔 ALERT LIST
  const { data: alertList } = await supabase
    .from("alerts")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (alertList) setAlerts(alertList);


  // 🔔 ALERT COUNT
  const { count: alertsCount } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .eq("status", "active");

  setClientCount(clients || 0);
  setAlertCount(alertsCount || 0);
};

  useEffect(() => {
  let channel: any;

  const init = async () => {
    // 👤 GET USER
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    // 🏢 GET ORGANISATION
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organisation_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!profile) return;

    const orgId = profile.organisation_id;

    // 🔥 INITIAL LOAD
    await loadCounts(orgId);
    const { count: feedbacks } = await supabase
  .from("family_feedback")
  .select("*", { count: "exact", head: true })
  .eq("is_read", false);

setFeedbackCount(feedbacks || 0);

    // 🛑 REMOVE EXISTING CHANNEL FIRST (CRITICAL FIX)
    supabase.getChannels().forEach((ch) => {
      if (ch.topic === "realtime:navbar-live") {
        supabase.removeChannel(ch);
      }
    });

    // ⚡ CREATE NEW CHANNEL CLEANLY
    channel = supabase.channel("navbar-live");

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "clients",
        filter: `organisation_id=eq.${orgId}`,
      },
      () => loadCounts(orgId)
    );

    channel.on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "family_feedback",
  },
  () => loadCounts(orgId)
);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "alerts",
        filter: `organisation_id=eq.${orgId}`,
      },
      () => loadCounts(orgId)
    );

    // ✅ SUBSCRIBE LAST (IMPORTANT)
    channel.subscribe();
  };

  init();

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}, []);

  return (
  <>
    {/* TOP BAR */}

    {safeAccess.isTrialActive && safeAccess.trial_end && (
  <div className="bg-yellow-600 text-black text-center py-1 text-sm">
    ⏳ {Math.ceil(
  (new Date(safeAccess.trial_end ?? "").getTime() - Date.now()) /
  (1000 * 60 * 60 * 24)
)} days left in trial
  </div>
)}
    <div className="fixed top-0 left-0 w-full bg-[var(--card)] backdrop-blur-md shadow-sm text-[var(--text)] px-3 sm:px-4 py-2 flex items-center border-b border-[var(--border)] z-[9999]">
      

      {/* LOGO */}
      <div
        onClick={() => router.push("/clients")}
        className="absolute left-1/2 transform -translate-x-1/2 cursor-pointer"
      >
        <img
          src="/icon-192.png"
          alt="LoopCare"
          className="h-12 md:h-16 object-contain"
        />
      </div>

      {/* RIGHT SIDE BUTTONS */}
      <div className="ml-auto flex items-center gap-3">
<button
  onClick={toggleTheme}
  className="bg-[var(--card)] border border-[var(--border)] px-3 py-2 rounded"
>
  {theme === "dark" ? "🌙" : "☀️"}
</button>
        {/* ALERT BUTTON */}
        <button
          onClick={() => {
            setShowAlerts(true);
            setOpen(false);
          }}
          className="relative bg-[var(--card)] border border-[var(--border)] px-3 py-2 rounded"
        >
          🔔
          {(alertCount + feedbackCount) > 0 && (
  <span className="bg-[var(--card)] border border-[var(--border)] px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
    {alertCount + feedbackCount}
  </span>
)}
        </button>

        {/* MENU BUTTON */}
        <button
          onClick={() => {
            setOpen(!open);
            setShowAlerts(false);
          }}
          className="bg-[var(--card)] border border-[var(--border)] px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base"
        >
          ☰
        </button>

      </div>
    </div>

      {/* OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 z-[9998]"
        />
      )}
{showAlerts && (
  <>
    {/* OVERLAY */}
    <div
      onClick={() => setShowAlerts(false)}
      className="fixed inset-0 bg-black/50 z-[9998]"
    />

    {/* ALERT PANEL */}
    <div className="fixed right-0 top-0 h-full w-80 bg-[var(--card)] z-[9999] p-4 overflow-y-auto">

      <h2 className="text-lg font-bold mb-4">
        🔔 Alerts
      </h2>

      {alerts.length === 0 && (
        <p className="text-[var(--muted)]">
          No active alerts
        </p>
      )}

      {alerts.map((alert) => {
        const isInsight = alert.type === "insight";

        return (
          <div
  key={alert.id}
  onClick={() => {
  router.push(`/clients/${alert.client_id}#alerts`);
  setShowAlerts(false);
}}
  className={`p-3 mb-2 rounded cursor-pointer hover:opacity-90 ${
    alert.severity === "high"
      ? "bg-red-600"
      : alert.severity === "medium"
      ? "bg-yellow-500"
      : "bg-blue-600"
  }`}
>
            <div>
  <p className="font-semibold">
  {alert.message}
</p>
  <p className="text-xs opacity-70 mt-1">
    Tap to view client →
  </p>
</div>
          </div>
        );
      })}

      {/* FREE USER CTA */}
      {!canAccessFeature(
  "smartAlerts",
  access.plan,
  access.accountType,
  access.isTrialActive
) &&
 alerts.some(a => a.type === "insight") && (
        <button
          onClick={() => router.push("/upgrade")}
          className="w-full mt-4 bg-yellow-500 text-black py-2 rounded"
        >
          Unlock Full Insights
        </button>
      )}

    </div>
  </>
)}
      {/* SIDE PANEL */}
      <div
  onClick={(e) => e.stopPropagation()}
  className={`fixed top-0 left-0 h-full w-[80%] max-w-xs bg-[var(--card)] z-[9999] transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-[var(--border)]">
  <p className="font-bold">LoopCare</p>
  <p className="text-sm text-[var(--muted)]">Solo Carer</p>
</div>

        <div className="flex flex-col p-4 gap-3">

          <div className="flex justify-between items-center w-full">
  <button
  onClick={() => {
    router.push("/clients");
    setOpen(false);
  }}
  className={`text-left p-3 rounded flex justify-between items-center ${
    pathname === "/clients"
      ? "bg-blue-600"
      : "bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] hover:bg-[var(--border)]"
  }`}
>
  <span>Clients</span>

  <span className="text-xs bg-blue-600 px-2 py-1 rounded">
    {clientCount}
  </span>
</button>
</div>

          {safeAccess.accountType !== "solo" && (
  <button
    onClick={() => {
      router.push("/dashboard");
      setOpen(false);
    }}
    className={`text-left p-3 rounded flex justify-between items-center ${
      pathname === "/dashboard"
        ? "bg-blue-600"
        : "bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)]"
    }`}
  >
    <span>Risk Dashboard</span>
  </button>
)}

          <button
            onClick={() => {
              router.push("/invoices");
              setOpen(false);
            }}
            className={`text-left p-3 rounded ${
  pathname === "/invoices"
    ? "bg-blue-600"
    : "bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] hover:bg-[var(--border)]"
}`}
          >
            Invoices
          </button>
<button
  onClick={() => router.push("/upgrade")}
  className="text-left bg-yellow-500 text-black p-3 rounded mt-4"
>
  🔓 Upgrade to Pro
</button>

{/* 🚪 LOGOUT */}
{safeAccess.accountType !== "solo" && (
  <button
    onClick={handleLogout}
    className="text-left bg-red-600 text-white p-3 rounded mt-2"
  >
    Logout
  </button>
)}
        </div>
      </div>
    </>
  );
}