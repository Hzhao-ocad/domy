import {
  distancePointToSegment,
  type GroundPoint,
} from './walker-geometry.ts';

export type RoamingRouteOptions = {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  domePath: readonly GroundPoint[];
  blockedCircles: readonly { center: GroundPoint; radius: number }[];
  clearance: number;
  maxAttempts: number;
  random: () => number;
};

export function randomCrowdSize(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function activeDomeIndexes(indexes: readonly (number | null)[]): number[] {
  return [...new Set(indexes.filter((index): index is number => index !== null))];
}

function segmentDistance(
  start: GroundPoint,
  end: GroundPoint,
  otherStart: GroundPoint,
  otherEnd: GroundPoint,
): number {
  const side = (from: GroundPoint, to: GroundPoint, point: GroundPoint) =>
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  const crosses = (first: number, second: number) => first === 0 || second === 0 || first > 0 !== second > 0;
  const intersects = crosses(side(start, end, otherStart), side(start, end, otherEnd))
    && crosses(side(otherStart, otherEnd, start), side(otherStart, otherEnd, end));

  if (intersects) return 0;

  return Math.min(
    distancePointToSegment(start, otherStart, otherEnd),
    distancePointToSegment(end, otherStart, otherEnd),
    distancePointToSegment(otherStart, start, end),
    distancePointToSegment(otherEnd, start, end),
  );
}

function hasClearance(route: readonly GroundPoint[], options: RoamingRouteOptions): boolean {
  const clearOfCircles = route.every((point) => options.blockedCircles.every((circle) =>
    Math.hypot(point.x - circle.center.x, point.y - circle.center.y) >= circle.radius + options.clearance,
  ));
  if (!clearOfCircles) return false;

  return route.slice(1).every((point, index) => {
    const start = route[index];
    return options.blockedCircles.every((circle) =>
      distancePointToSegment(circle.center, start, point) >= circle.radius + options.clearance,
    ) && options.domePath.slice(1).every((domePoint, domeIndex) =>
      segmentDistance(start, point, options.domePath[domeIndex], domePoint) >= options.clearance,
    );
  });
}

export function createRoamingRoute(options: RoamingRouteOptions): GroundPoint[] {
  const first = options.domePath[0];
  const last = options.domePath.at(-1)!;
  const horizontal = Math.abs(last.x - first.x) >= Math.abs(last.y - first.y);

  for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
    const start = horizontal
      ? { x: options.bounds.minX, y: options.bounds.minY + options.random() * (options.bounds.maxY - options.bounds.minY) }
      : { x: options.bounds.minX + options.random() * (options.bounds.maxX - options.bounds.minX), y: options.bounds.minY };
    const end = horizontal
      ? { x: options.bounds.maxX, y: options.bounds.minY + options.random() * (options.bounds.maxY - options.bounds.minY) }
      : { x: options.bounds.minX + options.random() * (options.bounds.maxX - options.bounds.minX), y: options.bounds.maxY };
    const routeLength = Math.hypot(end.x - start.x, end.y - start.y);
    const deviation = routeLength * .15;
    const interior = [.33, .67].map((progress) => {
      const base = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
      const offset = (options.random() * 2 - 1) * deviation;
      return horizontal
        ? { x: base.x, y: Math.max(options.bounds.minY, Math.min(options.bounds.maxY, base.y + offset)) }
        : { x: Math.max(options.bounds.minX, Math.min(options.bounds.maxX, base.x + offset)), y: base.y };
    });
    const route = [start, ...interior, end];

    if (hasClearance(route, options)) return route;
  }

  throw new Error('Could not create a clear roaming route');
}
