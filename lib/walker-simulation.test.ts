import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeDomeIndexes,
  createRoamingRoute,
  randomCrowdSize,
} from './walker-simulation.ts';

test('uses an inclusive crowd range and deduplicates non-null triggers', () => {
  assert.equal(randomCrowdSize(2, 8, () => .999), 8);
  assert.deepEqual(activeDomeIndexes([2, null, 2, 4, null]), [2, 4]);
});

test('creates a horizontal route that clears a centered obstacle', () => {
  const randomValues = [.6, .95, .55, .45];
  let randomIndex = 0;
  const route = createRoamingRoute({
    bounds: { minX: -20, maxX: 20, minY: -20, maxY: 20 },
    domePath: [{ x: -15, y: 0 }, { x: 15, y: 0 }],
    blockedCircles: [{ center: { x: 0, y: 0 }, radius: 3 }],
    clearance: 1,
    maxAttempts: 20,
    random: () => randomValues[randomIndex++ % randomValues.length],
  });

  assert.ok(Math.abs(route.at(-1)!.y - route[0].y) < Math.abs(route.at(-1)!.x - route[0].x));
  assert.ok(route.every((point) => Math.hypot(point.x, point.y) >= 4));
});
