import assert from 'node:assert/strict';
import test from 'node:test';
import { activeDomeIndexes } from './walker-simulation.ts';

test('keeps simultaneous walker triggers unique', () => {
  assert.deepEqual(activeDomeIndexes([1, 1, 3]), [1, 3]);
});
