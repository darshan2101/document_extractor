export const parseDateToUtc = (value: string | null): Date | null => {
  if (!value || value === "No Expiry" || value === "Lifetime") {
    return null;
  }

  const ddMmYyyyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (ddMmYyyyMatch) {
    const [, day, month, year] = ddMmYyyyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
};

export const getTodayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const daysUntilExpiry = (expiryDate: Date, today: Date): number =>
  Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
