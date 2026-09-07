export function mergePreset<T extends object>(defaults: T, saved: Partial<T>): T {
  return { ...defaults, ...saved };
}
