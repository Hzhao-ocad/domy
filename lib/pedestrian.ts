import * as THREE from 'three';

export type PedestrianRole = 'manual' | 'path' | 'roaming';
export type PedestrianOptions = { role: PedestrianRole; speed: number; clothes?: { upper: string; lower: string } };

export function pedestrianHeightForDomeRadius(domeRadius: number): number {
  return domeRadius * 7;
}

export class Pedestrian {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly hasCap: boolean;
  complete = false;
  private readonly options: PedestrianOptions;
  private target = new THREE.Vector3();
  private samples: readonly THREE.Vector3[] = [];
  private sampleIndex = 0;

  constructor(options: PedestrianOptions) {
    this.options = options;
    this.hasCap = options.role === 'manual';

    const shirt = new THREE.MeshStandardMaterial({ color: options.clothes?.upper ?? '#3f6470', roughness: .8 });
    const trousers = new THREE.MeshStandardMaterial({ color: options.clothes?.lower ?? '#263943', roughness: .9 });
    const skin = new THREE.MeshStandardMaterial({ color: '#d9a07b', roughness: .9 });
    const verticalCapsule = new THREE.CapsuleGeometry(.14, .36, 4, 8), verticalCylinder = new THREE.CylinderGeometry(.055, .065, .4, 8), armCylinder = new THREE.CylinderGeometry(.045, .055, .48, 8);
    verticalCapsule.rotateX(Math.PI / 2);
    verticalCylinder.rotateX(Math.PI / 2);
    armCylinder.rotateX(Math.PI / 2);
    const torso = new THREE.Mesh(verticalCapsule, shirt), head = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), skin), neck = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .1, 8), skin), leftLeg = new THREE.Mesh(verticalCylinder, trousers), rightLeg = leftLeg.clone(), leftArm = new THREE.Mesh(armCylinder, shirt), rightArm = leftArm.clone();
    torso.position.z = .68;
    head.position.z = 1.18;
    neck.position.z = 1.01;
    neck.rotation.x = Math.PI / 2;
    leftLeg.position.set(-.09, 0, .2);
    rightLeg.position.set(.09, 0, .2);
    leftArm.position.set(-.23, 0, .69);
    rightArm.position.set(.23, 0, .69);
    leftArm.rotation.y = .35;
    rightArm.rotation.y = -.35;
    this.group.add(torso, head, neck, leftLeg, rightLeg, leftArm, rightArm);

    if (this.hasCap) {
      const cap = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .08, 12), shirt);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .025, 12), shirt);
      crown.position.z = 1.31;
      brim.position.set(0, -.1, 1.28);
      cap.add(crown, brim);
      this.group.add(cap);
    }

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  get visible() { return this.group.visible; }
  set visible(value: boolean) { this.group.visible = value; }

  setTerrainTarget(target: THREE.Vector3) {
    this.target.copy(target);
    this.complete = false;
  }

  setPath(samples: readonly THREE.Vector3[], index: number) {
    this.samples = samples;
    this.sampleIndex = index;
    this.position.copy(samples[index]);
    this.target.copy(samples[index]);
    this.complete = false;
  }

  stepPath(delta: -1 | 1) {
    this.sampleIndex = Math.max(0, Math.min(this.samples.length - 1, this.sampleIndex + delta));
    this.target.copy(this.samples[this.sampleIndex]);
  }

  update(delta: number): boolean {
    const distance = this.position.distanceTo(this.target), step = Math.min(this.options.speed * delta, distance);
    if (distance) this.position.add(this.target.clone().sub(this.position).normalize().multiplyScalar(step));
    const arrived = distance <= step;
    if (this.samples.length > 1 && this.sampleIndex === this.samples.length - 1 && arrived) this.complete = true;
    return arrived;
  }
}
