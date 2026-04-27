"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserAccess } from "@/lib/getUserAccess";
import { useRouter } from "next/navigation";

export default function PlanGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        router.push("/login");
        return;
      }

      await getUserAccess();
      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-[var(--muted)]">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}