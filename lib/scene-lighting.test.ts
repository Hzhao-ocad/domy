import assert from 'node:assert/strict';
import test from 'node:test';
import { selectColorPointLights } from './scene-lighting.ts';

test('assigns the configured number of color point lights to every dome', () => {
  assert.deepEqual(selectColorPointLights([
    { brightness: 0.2, colors: [{ r: 1, g: 0, b: 0 }, { r: 1, g: 1, b: 0 }] },
    { brightness: 0.5, colors: [{ r: 0, g: 1, b: 0 }, { r: 0, g: 0, b: 1 }] },
  ], 1, 4), [
    { domeIndex: 0, pointIndex: 0, intensity: 0.8, color: { r: 1, g: 0, b: 0 } },
    { domeIndex: 1, pointIndex: 0, intensity: 2, color: { r: 0, g: 1, b: 0 } },
  ]);
});
