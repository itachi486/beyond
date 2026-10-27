export const PREFIX = "beyond:v1:";
export function read<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(PREFIX + key) || "null",
    );
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((v) => typeof v === "string" && v.length < 120)
  );
}
export function remember(items: string[], id: string) {
  return [id, ...items.filter((v) => v !== id)].slice(0, 100);
}
