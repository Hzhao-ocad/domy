import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distancePointToSegment,
  isNearPerpendicular,
  isPointerClick,
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

test('recognizes a short pointer press without treating a drag as a destination', () => {
  assert.equal(isPointerClick({ x: 12, y: 18 }, { x: 15, y: 21 }), true);
  assert.equal(isPointerClick({ x: 12, y: 18 }, { x: 20, y: 18 }), false);
});
