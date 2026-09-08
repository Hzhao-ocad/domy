export function mergePreset<T extends object>(defaults: T, saved: Partial<T>): T {
  return { ...defaults, ...saved };
}

export function updateBehaviorPreset<
  T extends Record<string, object>,
  K extends keyof T,
>(presets: T, behavior: K, changes: Partial<T[K]>): T {
  return {
    ...presets,
    [behavior]: { ...presets[behavior], ...changes },
  } as T;
}
