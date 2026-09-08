export function serializePreset(preset: object): string {
  return JSON.stringify(preset, null, 2);
}
