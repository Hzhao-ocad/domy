export type GroundPoint = { x: number; y: number };

export function projectOutsideCircles(
  target: GroundPoint,
  circles: readonly { center: GroundPoint; radius: number }[],
  clearance: number,
): GroundPoint {
  return circles.reduce((point, circle) => {
    const dx = point.x - circle.center.x;
    const dy = point.y - circle.center.y;
    const distance = Math.hypot(dx, dy);
    const required = circle.radius + clearance;

    if (distance >= required) return point;

    return {
      x: circle.center.x + (distance === 0 ? 1 : dx / distance) * required,
      y: circle.center.y + (distance === 0 ? 0 : dy / distance) * required,
    };
  }, target);
}

export function distancePointToSegment(
  point: GroundPoint,
  start: GroundPoint,
  end: GroundPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));

  return Math.hypot(point.x - start.x - dx * ratio, point.y - start.y - dy * ratio);
}

export function isNearPerpendicular(
  a: GroundPoint,
  b: GroundPoint,
  thresholdCosine: number,
): boolean {
  const scale = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return scale === 0 || Math.abs((a.x * b.x + a.y * b.y) / scale) < thresholdCosine;
}

export function isPointerClick(
  start: GroundPoint,
  end: GroundPoint,
  maximumDistance = 5,
): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= maximumDistance;
}
