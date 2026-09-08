import assert from 'node:assert/strict';
import test from 'node:test';
import { nearestPointIndex, nearestPointWithinDistance, offsetControlPoints } from './path.ts';

test('offsets every serialized control point along Y', () => {
  assert.deepEqual(offsetControlPoints([
    { x: -1, y: 2 },
    { x: 4, y: -3 },
  ], -3), [
    { x: -1, y: -1 },
    { x: 4, y: -6 },
  ]);
});

test('selects the closest generated pedestrian sample', () => {
  assert.equal(nearestPointIndex([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
  ], { x: 2.2, y: .1 }), 1);
});

test('returns no pedestrian position when the cursor is outside the activation distance', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ];

  assert.equal(nearestPointWithinDistance(points, { x: 1, y: 3 }, 2), null);
  assert.equal(nearestPointWithinDistance(points, { x: 1, y: 1 }, 2), 0);
});
