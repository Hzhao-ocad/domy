import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePreset } from './preset.ts';

test('uses saved path control points while keeping new defaults', () => {
  const defaults = { radius: 1, bloom: 0.35, showPoints: false, controlPoints: [{ x: 0, y: 0 }], newControl: 4 };
  const saved = { radius: 1.4, bloom: 0.7, showPoints: true, controlPoints: [{ x: -2, y: 3 }] };

  assert.deepEqual(mergePreset(defaults, saved), {
    radius: 1.4,
    bloom: 0.7,
    showPoints: true,
    controlPoints: [{ x: -2, y: 3 }],
    newControl: 4,
  });
});
