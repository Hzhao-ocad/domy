import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePreset } from './preset.ts';

test('uses saved numeric and toggle values while keeping new defaults', () => {
  const defaults = { radius: 1, bloom: 0.35, showPoints: false, newControl: 4 };
  const saved = { radius: 1.4, bloom: 0.7, showPoints: true };

  assert.deepEqual(mergePreset(defaults, saved), {
    radius: 1.4,
    bloom: 0.7,
    showPoints: true,
    newControl: 4,
  });
});
