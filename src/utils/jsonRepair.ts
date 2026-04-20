export const extractJson = (raw: string): string | null => {
  const firstBraceIndex = raw.indexOf("{");
  const lastBraceIndex = raw.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    return null;
  }

  if (firstBraceIndex > lastBraceIndex) {
    return null;
  }

  return raw.slice(firstBraceIndex, lastBraceIndex + 1);
};

export const repairJson = (raw: string): Record<string, unknown> | null => {
  const extracted = extractJson(raw);

  if (!extracted) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(extracted);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};
