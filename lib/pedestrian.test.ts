import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Pedestrian, pedestrianHeightForDomeRadius } from './pedestrian.ts';

test('moves toward a target without teleporting', () => {
  const walker = new Pedestrian({ role: 'manual', speed: 2 });

  walker.setTerrainTarget(new THREE.Vector3(4, 0, 0));
  walker.update(.5);

  assert.equal(walker.position.x, 1);
});

test('completes only after arriving at the final path point', () => {
  const walker = new Pedestrian({ role: 'path', speed: 10 });

  walker.setPath([new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0)], 0);
  walker.stepPath(1);

  assert.equal(walker.update(.1), false);
  assert.equal(walker.complete, false);
  assert.equal(walker.update(.1), true);
  assert.equal(walker.complete, true);
});

test('clears completion when leaving the final path point or targeting terrain', () => {
  const walker = new Pedestrian({ role: 'path', speed: 10 });

  walker.setPath([new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0)], 0);
  walker.stepPath(1);
  walker.update(.2);
  assert.equal(walker.complete, true);

  walker.stepPath(-1);
  assert.equal(walker.complete, false);

  walker.stepPath(1);
  walker.update(.2);
  walker.setTerrainTarget(new THREE.Vector3(4, 0, 0));
  walker.update(.2);
  assert.equal(walker.complete, false);
});

test('retains the existing scale and distinguishes the manual cap', () => {
  assert.equal(pedestrianHeightForDomeRadius(1), 7);
  assert.equal(pedestrianHeightForDomeRadius(.5), 3.5);
  assert.equal(new Pedestrian({ role: 'manual', speed: 1 }).hasCap, true);
  assert.equal(new Pedestrian({ role: 'roaming', speed: 1, clothes: { upper: '#f00', lower: '#00f' } }).hasCap, false);
});

test('orients the manual cap for the z-up scene', () => {
  const walker = new Pedestrian({ role: 'manual', speed: 1 });
  const cap = walker.group.children.at(-1)!;
  const [crown, brim] = cap.children;

  assert.equal(crown.rotation.x, Math.PI / 2);
  assert.equal(brim.rotation.x, Math.PI / 2);
});
