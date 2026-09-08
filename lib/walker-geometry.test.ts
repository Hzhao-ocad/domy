import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distancePointToSegment,
  isNearPerpendicular,
  projectOutsideCircles,
} from './walker-geometry.ts';

test('projects a pointer target outside a Dome footprint', () => {
  assert.deepEqual(
    projectOutsideCircles(
      { x: 0, y: 0 },
      [{ center: { x: 0, y: 0 }, radius: 2 }],
      .25,
    ),
    { x: 2.25, y: 0 },
  );
});

test('measures clearance and rejects perpendicular route directions', () => {
  assert.equal(
    distancePointToSegment({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 }),
    3,
  );
  assert.equal(isNearPerpendicular({ x: 1, y: 0 }, { x: 0, y: 1 }, .35), true);
});
