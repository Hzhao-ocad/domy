import { Vector3 } from 'three';

export type MiniAttachment = {
  position: Vector3;
  normal: Vector3;
  radius: number;
};

export type MiniAttachmentOptions = {
  count: number;
  domeRadius: number;
  cutAngle: number;
  minRadius: number;
  maxRadius: number;
  random: () => number;
};

export function createMiniAttachments({
  count,
  domeRadius,
  cutAngle,
  minRadius,
  maxRadius,
  random,
}: MiniAttachmentOptions): MiniAttachment[] {
  const attachments: MiniAttachment[] = [];
  const maxTheta = Math.min(cutAngle - 0.42, 1.5);
  const baseZ = -domeRadius * Math.cos(cutAngle);

  for (let attempt = 0; attachments.length < count && attempt < count * 80; attempt += 1) {
    const radius = minRadius + (maxRadius - minRadius) * random();
    const theta = 0.35 + (maxTheta - 0.35) * Math.sqrt(random());
    const phi = random() * Math.PI * 2;
    const normal = new Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
    );
    const position = normal.clone().multiplyScalar(domeRadius - radius * 0.25);
    position.z += baseZ;

    const isClearOfGround = position.z > radius + 0.03;
    const isSeparated = attachments.every(
      (other) => position.distanceTo(other.position) > radius + other.radius + 0.04,
    );

    if (isClearOfGround && isSeparated) {
      attachments.push({ position, normal, radius });
    }
  }

  return attachments;
}
