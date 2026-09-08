import type { LightingBehavior } from './lighting';

export type BehaviorPreset = {
  factor: number;
  delay: number;
  decayStep: number;
  decay: number;
};

const behaviorPreset = (overrides: Partial<BehaviorPreset> = {}): BehaviorPreset => ({
  factor: 0.25,
  delay: 20,
  decayStep: 10,
  decay: 0.2,
  ...overrides,
});

export const defaults = {
  count: 10,
  radius: 1.15,
  cut: 130,
  miniMin: 1,
  miniMax: 6,
  miniScaleMin: 0.5,
  miniScaleMax: 0.5,
  pathWidth: 5,
  pedestrianPathWidth: 3.9,
  pedestrianOffset: -5,
  pedestrianPointCount: 37,
  walkerSpeed: 12,
  controlPoints: [
    { x: -27.558583439162877, y: -22.35792423128448 },
    { x: -17.46775840959009, y: -8.746485078031245 },
    { x: -1.6096639142922164, y: 3.3009052551511573 },
    { x: 9.667861611928554, y: 20.762411627969804 },
    { x: 28.331902237785368, y: 17.798411815445156 },
  ],
  palette: ['#f986a3', '#f7b878', '#f3de8c', '#80eab3', '#76c2f4', '#9968f3'],
  points: 7,
  influence: 0.7,
  blend: 3.9,
  roam: 0.96,
  colorSpeed: 2.5,
  saturation: 1.5,
  emission: 3,
  bloom: 0.2,
  moonlight: 0.14,
  skyLight: 0,
  pointLightsPerDome: 4,
  pointLightIntensity: 15.4,
  pointLightRange: 22,
  behavior: 'ripple' as LightingBehavior,
  behaviorPresets: {
    direction: behaviorPreset(),
    curiosity: behaviorPreset(),
    ripple: behaviorPreset({ factor: 0.51, decay: 0.01 }),
    halo: behaviorPreset({ factor: 0.31, delay: 30, decayStep: 40, decay: 0.09 }),
    afterglow: behaviorPreset({ decay: 0.04 }),
  } satisfies Record<LightingBehavior, BehaviorPreset>,
  activationDistance: 20,
  showPoints: false,
  showHandles: false,
  showCollisionStrip: false,
  showPedestrianPath: false,
  paused: false,
};
