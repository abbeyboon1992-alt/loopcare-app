export const normalise = (str: string) =>
  (str || "").toLowerCase().replace(/[^a-z]/g, "");