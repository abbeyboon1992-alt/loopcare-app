export function canAccessFeature(
  feature: string,
  plan: string,
  isTrialActive?: boolean
) {
  const config = featureAccess[feature as keyof typeof featureAccess];

  if (!config) return false;

  // ✅ treat trial as pro
  const effectivePlan = isTrialActive ? "pro" : plan;

  // ✅ check plan only
  if (!config.plans.includes(effectivePlan)) return false;

  return true;
}

export const featureAccess = {
  smartAlerts: {
    plans: ["pro"],
    accountTypes: ["solo", "team"],
  },

  aiCarePlans: {
    plans: ["pro"],
    accountTypes: ["solo", "team"],
  },

  assessments: {
    plans: ["pro"],
    accountTypes: ["solo", "team"],
  },

  mcaAssessment: {
  plans: ["pro"],
  accountTypes: ["solo", "team"],
},

bestInterestDecision: {
  plans: ["pro"],
  accountTypes: ["solo", "team"],
},

  unlimitedClients: {
    plans: ["pro"],
    accountTypes: ["solo", "team"],
  },

  // 🔒 EXAMPLE: LOCK DASHBOARD FROM SOLO USERS
  teamDashboard: {
    plans: ["free", "pro"], // plan doesn't matter
    accountTypes: ["team"], // ONLY team allowed
  },

  // 🆓 FREE FEATURES
  basicClients: {
    plans: ["free", "pro"],
    accountTypes: ["solo", "team", "family"],
  },
};

//add new features like - newFeatureName: "pro", then use it anywhere like - feature="newFeatureName"