// Riot's all-zero uuid is its own "none": a border never picked, an agent never chosen.
export function uuidOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return /^0+(-0+)*$/.test(value) ? null : value;
}
