export const assessmentVisibility = {
  solo: {
    sections: [
      "cognition",
      "nutrition",
      "mobility",
      "medication",
      "safeguarding",
      "daily",
      "review",
    ],

    fields: {
      clinical: false,
      advanced_scores: false,
      evidence: false,
      referrals: true,
      timeline: false,
      ai_summary: true,
    },
  },

  team: {
    sections: "all",
    fields: {
      clinical: true,
      advanced_scores: true,
      evidence: true,
      referrals: true,
      timeline: true,
      ai_summary: true,
    },
  },

  agency: {
    sections: "all",
    fields: {
      clinical: true,
      advanced_scores: true,
      evidence: true,
      referrals: true,
      timeline: true,
      ai_summary: true,
    },
  },
};