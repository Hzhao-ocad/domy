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
