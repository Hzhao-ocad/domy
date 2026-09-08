# Multi-walker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add smooth manual control plus concurrent path and roaming walkers that collectively control Dome lighting.

**Architecture:** Put 2D geometry, walker state, simulation routes, and multi-source lighting in focused lib modules. app/page.tsx owns Three.js scene wiring, input listeners, walker lifecycle, and the lower-left controls; each Pedestrian owns one Three.js Group and only its own motion state.

**Tech Stack:** TypeScript, Node built-in test runner, Three.js, React 19, Vinext.

**Spec:** docs/superpowers/specs/2026-09-08-multi-walker-design.md

## Global Constraints

- Every walker interpolates to terrain targets and path samples; no mode teleports.
- Arrow keys switch manual control to path snapping; pointer movement restores terrain-wide mouse control.
- A manual walker hides outside terrain and projects to a Dome exterior rather than entering the mesh.
- The manual walker has a cap; roaming walkers use random upper- and lower-body colors.
- Completed simulations are removed; manual, path, and roaming walkers coexist.
- Roaming routes must be mostly straight, follow the Dome-path direction, avoid Domes, and not closely cross the Dome path.
- Direction and Curiosity must aggregate all walker triggers without changing existing propagation and decay behavior.

---

## File structure

- lib/walker-geometry.ts / .test.ts: deterministic 2D collision projection and route clearance.
- lib/pedestrian.ts / .test.ts: reusable Three.js walker class, movement, cap, and clothes.
- lib/walker-simulation.ts / .test.ts: crowd counts, roaming routes, and trigger deduplication.
- lib/lighting.ts / .test.ts: multiple simultaneous active Dome sources.
- lib/defaults.ts / .test.ts: saved crowd limits.
- app/page.tsx and app/globals.css: scene integration, input, and HUD.

### Task 1: Add walker geometry helpers

**Files:**
- Create: lib/walker-geometry.ts
- Create: lib/walker-geometry.test.ts

**Interfaces:**
- Produces GroundPoint, projectOutsideCircles, distancePointToSegment, and isNearPerpendicular.

- [ ] **Step 1: Write the failing tests**

~~~ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { distancePointToSegment, isNearPerpendicular, projectOutsideCircles } from './walker-geometry.ts';

test('projects a pointer target outside a Dome footprint', () => {
  assert.deepEqual(
    projectOutsideCircles({ x: 0, y: 0 }, [{ center: { x: 0, y: 0 }, radius: 2 }], .25),
    { x: 2.25, y: 0 },
  );
});

test('measures clearance and rejects perpendicular route directions', () => {
  assert.equal(distancePointToSegment({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 }), 3);
  assert.equal(isNearPerpendicular({ x: 1, y: 0 }, { x: 0, y: 1 }, .35), true);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: node --experimental-strip-types --test lib/walker-geometry.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helpers**

~~~ts
export type GroundPoint = { x: number; y: number };

export function projectOutsideCircles(target: GroundPoint, circles: readonly { center: GroundPoint; radius: number }[], clearance: number): GroundPoint {
  return circles.reduce((point, circle) => {
    const dx = point.x - circle.center.x, dy = point.y - circle.center.y;
    const distance = Math.hypot(dx, dy), required = circle.radius + clearance;
    if (distance >= required) return point;
    return { x: circle.center.x + (distance === 0 ? 1 : dx / distance) * required, y: circle.center.y + (distance === 0 ? 0 : dy / distance) * required };
  }, target);
}

export function distancePointToSegment(point: GroundPoint, start: GroundPoint, end: GroundPoint): number {
  const dx = end.x - start.x, dy = end.y - start.y, lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - start.x - dx * ratio, point.y - start.y - dy * ratio);
}

export function isNearPerpendicular(a: GroundPoint, b: GroundPoint, thresholdCosine: number): boolean {
  const scale = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return scale === 0 || Math.abs((a.x * b.x + a.y * b.y) / scale) < thresholdCosine;
}
~~~

- [ ] **Step 4: Run the test and confirm it passes**

Run: node --experimental-strip-types --test lib/walker-geometry.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add lib/walker-geometry.ts lib/walker-geometry.test.ts
git commit -m "feat: add walker geometry helpers"
~~~

### Task 2: Replace the singleton mesh with Pedestrian

**Files:**
- Modify: lib/pedestrian.ts
- Modify: lib/pedestrian.test.ts

**Interfaces:**
- Produces PedestrianRole = 'manual' | 'path' | 'roaming'.
- Produces Pedestrian with group, position, visible, hasCap, complete, setTerrainTarget, setPath, stepPath, and update.

- [ ] **Step 1: Write the failing class tests**

~~~ts
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
  walker.stepPath(1); walker.update(.1);
  assert.equal(walker.complete, false);
  walker.update(.1);
  assert.equal(walker.complete, true);
});

test('retains the existing scale and distinguishes the manual cap', () => {
  assert.equal(pedestrianHeightForDomeRadius(1), 7);
  assert.equal(new Pedestrian({ role: 'manual', speed: 1 }).hasCap, true);
  assert.equal(new Pedestrian({ role: 'roaming', speed: 1, clothes: { upper: '#f00', lower: '#00f' } }).hasCap, false);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: node --experimental-strip-types --test lib/pedestrian.test.ts

Expected: FAIL because Pedestrian is not exported.

- [ ] **Step 3: Implement the class**

~~~ts
export type PedestrianRole = 'manual' | 'path' | 'roaming';
export type PedestrianOptions = { role: PedestrianRole; speed: number; clothes?: { upper: string; lower: string } };

export class Pedestrian {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly hasCap: boolean;
  complete = false;
  private target = new THREE.Vector3();
  private samples: readonly THREE.Vector3[] = [];
  private sampleIndex = 0;

  constructor(private readonly options: PedestrianOptions) { this.hasCap = options.role === 'manual'; }
  get visible() { return this.group.visible; }
  set visible(value: boolean) { this.group.visible = value; }
  setTerrainTarget(target: THREE.Vector3) { this.target.copy(target); this.complete = false; }
  setPath(samples: readonly THREE.Vector3[], index: number) { this.samples = samples; this.sampleIndex = index; this.position.copy(samples[index]); this.target.copy(samples[index]); this.complete = false; }
  stepPath(delta: -1 | 1) { this.sampleIndex = Math.max(0, Math.min(this.samples.length - 1, this.sampleIndex + delta)); this.target.copy(this.samples[this.sampleIndex]); }
  update(delta: number) {
    const distance = this.position.distanceTo(this.target), step = Math.min(this.options.speed * delta, distance);
    if (distance) this.position.add(this.target.clone().sub(this.position).normalize().multiplyScalar(step));
    if (this.samples.length > 1 && this.sampleIndex === this.samples.length - 1 && distance <= step) this.complete = true;
  }
}
~~~

Move the current torso/head/limb mesh construction into the constructor. Apply clothes.upper to torso and arms, clothes.lower to legs, and add a small brimmed cap only if hasCap. Preserve the existing shadow settings and dome-relative scale.

- [ ] **Step 4: Run the test and confirm it passes**

Run: node --experimental-strip-types --test lib/pedestrian.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add lib/pedestrian.ts lib/pedestrian.test.ts
git commit -m "feat: add reusable pedestrian class"
~~~

### Task 3: Generate simulation routes and aggregate lighting

**Files:**
- Create: lib/walker-simulation.ts
- Create: lib/walker-simulation.test.ts
- Modify: lib/lighting.ts
- Modify: lib/lighting.test.ts

**Interfaces:**
- Produces randomCrowdSize, createRoamingRoute, and activeDomeIndexes.
- Produces activateDomes(state, indexes, time); retain activateDome as its one-index wrapper.

- [ ] **Step 1: Write the failing route and lighting tests**

~~~ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { activeDomeIndexes, createRoamingRoute, randomCrowdSize } from './walker-simulation.ts';
import { activateDomes, advanceLighting, createLightingState } from './lighting.ts';

test('uses the inclusive crowd range and deduplicates triggers', () => {
  assert.equal(randomCrowdSize(2, 8, () => .999), 8);
  assert.deepEqual(activeDomeIndexes([2, null, 2, 4]), [2, 4]);
});

test('prefers a horizontal clear route for a horizontal Dome path', () => {
  const route = createRoamingRoute({
    bounds: { minX: -20, maxX: 20, minY: -20, maxY: 20 },
    domePath: [{ x: -15, y: 0 }, { x: 15, y: 0 }],
    blockedCircles: [{ center: { x: 0, y: 0 }, radius: 3 }],
    clearance: 1, maxAttempts: 20, random: () => .2,
  });
  assert.ok(Math.abs(route.at(-1)!.y - route[0].y) < Math.abs(route.at(-1)!.x - route[0].x));
  assert.ok(route.every((point) => Math.hypot(point.x, point.y) >= 4));
});

test('refreshes two Direction sources at once', () => {
  let state = createLightingState(4, { propagationDelay: 20, propagationFactor: .5, decayInterval: 10, decayAmount: .5 });
  state = activateDomes(state, [1, 3], 0); state = advanceLighting(state, 10);
  assert.deepEqual(state.brightness, [0, .5, 0, .5]);
});
~~~

- [ ] **Step 2: Run the tests and confirm they fail**

Run: node --experimental-strip-types --test lib/walker-simulation.test.ts lib/lighting.test.ts

Expected: FAIL because the route module and activateDomes do not exist.

- [ ] **Step 3: Implement route and lighting APIs**

~~~ts
export function randomCrowdSize(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}
export function activeDomeIndexes(indexes: readonly (number | null)[]): number[] {
  return [...new Set(indexes.filter((index): index is number => index !== null))];
}
export function activateDomes(state: LightingState, indexes: readonly number[], time: number): LightingState {
  const activeIndexes = new Set(indexes);
  return { ...state, activeIndexes, activationTime: time, lastDecayTime: time, brightness: state.brightness.map((value, index) => activeIndexes.has(index) ? 1 : value) };
}
export function activateDome(state: LightingState, index: number, time: number): LightingState {
  return activateDomes(state, [index], time);
}
~~~

Implement createRoamingRoute as an attempt loop: derive its primary axis from the first and final domePath point; select endpoints on matching opposing map edges; add two interior points with perpendicular deviation no greater than 15% of route length; reject any candidate point inside a blocked radius plus clearance, or any candidate segment closer than clearance to a Dome-path segment. Reuse Task 1 geometry and throw Error('Could not create a clear roaming route') after maxAttempts.

Replace LightingState.activeIndex with activeIndexes and per-source metadata required to retain existing behavior. Direction refreshes every active source before propagation and decay. Curiosity keeps every source at 1 and selects each non-source fade rank from its nearest source. Keep every existing single-source lighting test unchanged.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: node --experimental-strip-types --test lib/walker-simulation.test.ts lib/lighting.test.ts

Expected: PASS for old and new tests.

- [ ] **Step 5: Commit**

~~~bash
git add lib/walker-simulation.ts lib/walker-simulation.test.ts lib/lighting.ts lib/lighting.test.ts
git commit -m "feat: support simulated walkers and multi-source lighting"
~~~

### Task 4: Persist crowd limits and integrate the Three.js scene

**Files:**
- Modify: lib/defaults.ts
- Modify: lib/defaults.test.ts
- Create: lib/walker-integration.test.ts
- Modify: app/page.tsx
- Modify: app/globals.css

**Interfaces:**
- Adds defaults.crowdMin = 2 and defaults.crowdMax = 8.
- Adds api.current.spawnPathWalkers(count) and api.current.spawnRoamingWalkers(count).

- [ ] **Step 1: Write the failing persistence and integration tests**

Add this to the exact defaults expectation after pedestrianPointCount:

~~~ts
crowdMin: 2,
crowdMax: 8,
~~~

Create lib/walker-integration.test.ts:

~~~ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { activeDomeIndexes } from './walker-simulation.ts';
test('keeps simultaneous walker triggers unique', () => assert.deepEqual(activeDomeIndexes([1, 1, 3]), [1, 3]));
~~~

- [ ] **Step 2: Run the tests and confirm the default fails**

Run: node --experimental-strip-types --test lib/defaults.test.ts lib/walker-integration.test.ts

Expected: defaults FAILS because crowd values are missing; integration test PASSES from Task 3.

- [ ] **Step 3: Implement persisted values, input, spawning, and render-loop lifecycle**

Add crowdMin: 2 and crowdMax: 8 after pedestrianPointCount in defaults.ts. In page.tsx import Tasks 1-3 APIs and replace inline pedestrian Group, pedestrianIndex, positionPedestrian, and scalar active with:

~~~ts
const manualWalker = new Pedestrian({ role: 'manual', speed: 7 });
const simulatedWalkers = new Set<Pedestrian>();
scene.add(manualWalker.group);
const visibleWalkers = () => [manualWalker, ...simulatedWalkers].filter((walker) => walker.visible);
~~~

Update every walker in the render loop, remove completed simulations from both scene and set, derive each visible walker's nearest eligible Dome using activationDistance, deduplicate with activeDomeIndexes, then call activateDomes(lighting, indexes, now). A path walker must map normalized sample progress onto the Dome path before selecting a Dome.

Pointer move must use projectOutsideCircles against all Dome centers and radius + .18, set the manual terrain target, and show it. Pointer leave hides only the manual walker. Add a keydown listener: ArrowLeft and ArrowRight set pedestrianSamples(), call stepPath(-1 or 1), and show the manual walker. A pointer movement restores mouse mode. Remove the key listener during cleanup.

spawnPathWalkers(count) creates each Pedestrian({ role: 'path', speed: 5.5 }), assigns current pedestrian samples, adds it to scene and set, and calls stepPath(1) whenever it arrives at a nonfinal sample. spawnRoamingWalkers(count) uses createRoamingRoute with -29 to 29 terrain bounds, current dome curve samples, current Dome centers/radii, and Math.random; convert generated samples to THREE.Vector3 and give each walker randomized upper and lower colors.

Extend the api ref for both spawn methods. Add the lower-left controls:

~~~tsx
<div className="walker-switcher" role="group" aria-label="Walker simulation">
  <button onClick={() => api.current?.spawnPathWalkers(1)}>Path walker</button>
  <button onClick={() => api.current?.spawnPathWalkers(randomCrowdSize(params.crowdMin, params.crowdMax, Math.random))}>Generate path crowd</button>
  <button onClick={() => api.current?.spawnRoamingWalkers(1)}>Roaming walker</button>
  <button onClick={() => api.current?.spawnRoamingWalkers(randomCrowdSize(params.crowdMin, params.crowdMax, Math.random))}>Generate roaming crowd</button>
</div>
~~~

Add a Walkers section to the right panel with number inputs for Crowd min and Crowd max. Clamp a new minimum to crowdMax and a new maximum to crowdMin. Style walker-switcher like behavior-switcher at left:32px and bottom:122px, shifting to left:18px below 700px.

- [ ] **Step 4: Run static and unit verification**

Run: node --experimental-strip-types --test lib/*.test.ts && pnpm lint && pnpm build

Expected: PASS.

- [ ] **Step 5: Run a browser smoke test**

Run: pnpm dev

Verify:
1. The capped manual walker smoothly follows grass and stops at a Dome edge.
2. Arrow keys move it smoothly between path samples and pointer motion restores mouse control.
3. Single and crowd buttons create walkers; roaming routes broadly follow the Dome path.
4. Completed walkers disappear and multiple walkers illuminate concurrent Domes under both Behavior buttons.

- [ ] **Step 6: Commit**

~~~bash
git add lib/defaults.ts lib/defaults.test.ts lib/walker-integration.test.ts app/page.tsx app/globals.css
git commit -m "feat: add manual and simulation walker controls"
~~~

### Task 5: Final verification

**Files:**
- Verify all files modified in Tasks 1-4.

**Interfaces:**
- Consumes the completed multi-walker system.
- Produces test, lint, build, and browser verification evidence.

- [ ] **Step 1: Run the complete automated suite**

Run: node --experimental-strip-types --test lib/*.test.ts && pnpm lint && pnpm build

Expected: PASS without diagnostics.

- [ ] **Step 2: Inspect the final tree**

Run: git diff --check && git status --short

Expected: no whitespace errors and only planned files plus the user's pre-existing changes.

- [ ] **Step 3: Commit verification-only corrections if any**

~~~bash
git add lib/walker-geometry.ts lib/walker-geometry.test.ts lib/pedestrian.ts lib/pedestrian.test.ts lib/walker-simulation.ts lib/walker-simulation.test.ts lib/walker-integration.test.ts lib/lighting.ts lib/lighting.test.ts lib/defaults.ts lib/defaults.test.ts app/page.tsx app/globals.css
git commit -m "test: verify multi-walker controls"
~~~

