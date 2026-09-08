import assert from 'node:assert/strict';
import test from 'node:test';
import { pedestrianHeightForDomeRadius } from './pedestrian.ts';

test('scales a 1.75 m pedestrian to 3.5 dome diameters', () => {
  assert.equal(pedestrianHeightForDomeRadius(1), 7);
  assert.equal(pedestrianHeightForDomeRadius(.5), 3.5);
});
