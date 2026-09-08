import assert from 'node:assert/strict';
import test from 'node:test';
import { serializePreset } from './preset-export.ts';

test('serializes the complete current preset for sharing as a global default', () => {
  const preset = {
    radius: 1.25,
    palette: ['#f6b8c8', '#bce3cf'],
    controlPoints: [{ x: -2, y: 3 }],
    showPedestrianPath: false,
  };

  assert.equal(serializePreset(preset), `{
  "radius": 1.25,
  "palette": [
    "#f6b8c8",
    "#bce3cf"
  ],
  "controlPoints": [
    {
      "x": -2,
      "y": 3
    }
  ],
  "showPedestrianPath": false
}`);
});
