export type PathControlPoint = { x: number; y: number };

export function offsetControlPoints(
  points: PathControlPoint[],
  offsetY: number,
): PathControlPoint[] {
  return points.map((point) => ({ x: point.x, y: point.y + offsetY }));
}

export function nearestPointIndex(
  points: PathControlPoint[],
  target: PathControlPoint,
): number {
  return points.reduce((closest, point, index) => {
    const distance = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
    const closestDistance = (points[closest].x - target.x) ** 2
      + (points[closest].y - target.y) ** 2;
    return distance < closestDistance ? index : closest;
  }, 0);
}

export function nearestPointWithinDistance(
  points: PathControlPoint[],
  target: PathControlPoint,
  maxDistance: number,
): number | null {
  const index = nearestPointIndex(points, target);
  const point = points[index];
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  return distance <= maxDistance ? index : null;
}
