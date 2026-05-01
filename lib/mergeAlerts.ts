type AlertItem = {
  type: string;
  message: string;
  severity: string;
  source?: string;
  section_title?: string;
};

const severityRank: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const getHighestSeverity = (a: string, b: string) => {
  return severityRank[a] > severityRank[b] ? a : b;
};

export function mergeAlerts(alerts: AlertItem[]): AlertItem[] {
  const map = new Map<string, AlertItem & { sources: Set<string> }>();

  alerts.forEach((alert) => {
    const key = alert.type;

    if (!map.has(key)) {
      map.set(key, {
        ...alert,
        sources: new Set(alert.source ? [alert.source] : []),
      });
      return;
    }

    const existing = map.get(key)!;

    // 🔥 merge severity (take highest)
    existing.severity = getHighestSeverity(
      existing.severity,
      alert.severity
    );

    // 🔥 merge sources
    if (alert.source) {
      existing.sources.add(alert.source);
    }

    // 🔥 enhance message if multiple sources
    if (existing.sources.size > 1) {
      const label = alert.type.replace(/_/g, " ");

existing.message =
  existing.sources.size > 1
    ? `${label} risk detected from multiple sources`
    : existing.message;
    }
  });

  return Array.from(map.values()).map((a) => ({
    ...a,
    source: Array.from(a.sources).join(", "),
  }));
}