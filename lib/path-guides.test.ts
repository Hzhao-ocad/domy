import assert from 'node:assert/strict';
import test from 'node:test';
import { pathGuideVisibility } from './path-guides.ts';

test('hides both path guides by default', () => {
  assert.deepEqual(pathGuideVisibility(false), {
    domePath: false,
    pedestrianPath: false,
  });
});
