"use client";

import { useRouter } from "next/navigation";
import { useAccess } from "@/app/context/AccessContext";
import { canAccessFeature } from "@/lib/featureAccess";

export default function FeatureGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const access = useAccess();
  const router = useRouter();

  // ⏳ WAIT FOR ACCESS LOAD
  if (!access) return null;

  const allowed = canAccessFeature(
    feature,
    access.plan,
    access.accountType
  );

  // 🔒 LOCKED
  if (!allowed) {
    return (
      <div className="p-6 bg-[var(--card)] rounded-lg text-center">
        <p className="mb-4 text-[var(--muted)]">
          This feature is available on Pro
        </p>

        <button
          onClick={() => router.push("/upgrade")}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Upgrade
        </button>
      </div>
    );
  }

  return <>{children}</>;
}