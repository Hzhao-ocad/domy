export type SceneLightColor = { r: number; g: number; b: number };

export function selectColorPointLights(
  domes: { brightness: number; colors: SceneLightColor[] }[],
  lightsPerDome: number,
  intensityMultiplier: number,
) {
  return domes
    .flatMap((dome, domeIndex) => dome.colors.slice(0, lightsPerDome).map((color, pointIndex) => ({
      domeIndex,
      pointIndex,
      intensity: dome.brightness * intensityMultiplier,
      color,
    })));
}
