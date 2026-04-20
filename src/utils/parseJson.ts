/**
 * Safely parse a JSON string into type T.
 * Returns null if the input is null/empty or parsing fails.
 */
export const parseJsonValue = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }
  return JSON.parse(value) as T;
};
