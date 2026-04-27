export function generateInsights(notes: string) {
  const insights = [];

  if (notes.toLowerCase().includes("tired")) {
    insights.push("Client showing fatigue patterns");
  }

  if (notes.toLowerCase().includes("refused")) {
    insights.push("Possible care resistance detected");
  }

  if (notes.toLowerCase().includes("confused")) {
    insights.push("Cognitive concern observed");
  }

  return insights;
}