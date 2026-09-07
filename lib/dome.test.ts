import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { createMiniAttachments } from './dome.ts';

test('creates separated mini domes above the ground plane', () => {
  const attachments = createMiniAttachments({
    count: 6,
    domeRadius: 1,
    cutAngle: (110 * Math.PI) / 180,
    minRadius: 0.14,
    maxRadius: 0.23,
    random: (() => {
      let value = 17;
      return () => {
        value = (value * 16807) % 2147483647;
        return value / 2147483647;
      };
    })(),
  });

  assert.equal(attachments.length, 6);
  attachments.forEach((attachment, index) => {
    assert.ok(attachment.position.z > attachment.radius);
    assert.ok(Math.abs(attachment.normal.length() - 1) < 0.0001);

    attachments.slice(index + 1).forEach((other) => {
      assert.ok(
        attachment.position.distanceTo(other.position) >
          attachment.radius + other.radius + 0.04,
      );
    });
  });
});

test('returns attachment positions slightly inside the bulbous dome surface', () => {
  const [attachment] = createMiniAttachments({
    count: 1,
    domeRadius: 1,
    cutAngle: (110 * Math.PI) / 180,
    minRadius: 0.2,
    maxRadius: 0.2,
    random: () => 0.5,
  });
  const sphereCenter = new Vector3(0, 0, -Math.cos((110 * Math.PI) / 180));
  assert.ok(Math.abs(attachment.position.distanceTo(sphereCenter) - 0.95) < 0.0001);
});

test('embeds mini dome centers inside the large dome surface', () => {
  const [attachment] = createMiniAttachments({
    count: 1,
    domeRadius: 1,
    cutAngle: (110 * Math.PI) / 180,
    minRadius: 0.2,
    maxRadius: 0.2,
    random: () => 0.5,
  });
  const sphereCenter = new Vector3(0, 0, -Math.cos((110 * Math.PI) / 180));

  assert.ok(attachment.position.distanceTo(sphereCenter) <= 0.95);
});
