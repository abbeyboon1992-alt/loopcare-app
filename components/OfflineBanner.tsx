"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-red-600 text-white text-center py-2 text-sm fixed top-0 left-0 right-0 z-50">
      ⚠️ No signal — data will sync when reconnected
    </div>
  );
}