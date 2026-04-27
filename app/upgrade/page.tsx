"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { supabase } from "@/lib/supabase";

export default function UpgradePage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // ✅ prevent duplicate script
    if (document.getElementById("stripe-pricing-script")) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "stripe-pricing-script";
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.async = true;

    script.onload = () => setLoaded(true);

    document.body.appendChild(script);

    return () => {
      // optional cleanup (safe)
      script.remove();
    };
  }, []);

  const handleUpgrade = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return;

  // 🔗 get organisation
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.organisation_id) {
    console.log("❌ No organisation_id yet");
    return;
  }

  // ✅ THIS IS THE ACTUAL UPGRADE
  const { error } = await supabase
    .from("organisations")
    .update({
      subscription_status: "active", // ✅ must match your DB constraint
      trial_end: null,               // optional: clear trial
    })
    .eq("id", profile.organisation_id);

  if (error) {
    console.error("Upgrade error:", error);
    alert("Upgrade failed");
    return;
  }

  alert("Upgraded to Pro 🎉");

  // 🔄 refresh app state
  window.location.reload();
};
  
  const router = useRouter();


  if (!FEATURE_FLAGS.ENABLE_BILLING) {
  return (
    <div className="min-h-screen bg-[var(--card)] text-white flex items-center justify-center">
      <div className="text-center">

        <h1 className="text-2xl font-bold mb-2">
          🚧 Billing Disabled (Dev Mode)
        </h1>

        <p className="text-[var(--muted)] mb-6">
          Click below to simulate upgrade
        </p>

        <button
          onClick={handleUpgrade}
          className="bg-green-600 px-6 py-3 rounded"
        >
          Upgrade to Pro (Dev)
        </button>

      </div>
    </div>
  );
}
  //return (
 //
 //     <div className="w-full max-w-4xl text-center">
//<div className="flex justify-start mb-4">
//  <button
 //   onClick={() => {
 // if (window.history.length > 1) {
 //   router.back();
 // } else {
 //   router.push("/clients"); // fallback
 // }
//}}
 //   className="mb-6 text-sm text-blue-400"
//  >
//    ← Back
//  </button>
//</div>
 //       <h1 className="text-3xl font-bold mb-6">
//          Upgrade Your Plan
//        </h1>

 //       {!loaded && (
 //         <p className="text-[var(--muted)] mb-4">
 //           Loading pricing...
 //         </p>
 //       )}

//        {/* ✅ STRIPE TABLE */}
 //       {loaded && (
 //         <stripe-pricing-table
 //           pricing-table-id="prctbl_1TNGmURrwHpnzuVkjsHzLNN4"
 //           publishable-key="pk_live_51TIV3iRrwHpnzuVkuAPuosfebNw3Azzx7g6hxr8PsfOkZxwHufBRKADW6k7rvVliLameT6wUoExqXRmybR4jUPmH005CyDuTl2"
 //         ></stripe-pricing-table>
 //       )}

 //     </div>
 //   </div>
//  );
}