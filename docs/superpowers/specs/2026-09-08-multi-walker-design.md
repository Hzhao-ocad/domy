# Multi-walker control and simulation design

## Goal

Replace the single, snapping pedestrian with an extensible multi-walker system. A manually controlled walker moves smoothly across the terrain or along the pedestrian path, while simulated walkers can follow that path or traverse generated roaming paths. Every visible walker can concurrently trigger the existing dome-lighting behaviors.

## Scope

- A reusable pedestrian class supports the existing manual walker and any number of simulated walkers.
- Manual input has mouse and keyboard modes. Keyboard input takes priority when an arrow key is pressed; the next mouse movement restores mouse mode.
- Mouse navigation reaches any point on the terrain, while the manual walker remains outside dome geometry.
- Keyboard navigation moves between discrete pedestrian-path samples without teleporting.
- Simulation creates path-following or roaming walkers, singly or as a randomly sized crowd.
- Both existing lighting behaviors support simultaneous walkers.

## Walker architecture

`Pedestrian` will own one Three.js `Group` and the state required to animate one character:

- `position` and `targetPosition` for terrain movement;
- path samples and a target sample index for path-based movement;
- movement speed, visibility, and facing direction;
- role metadata (`manual`, `path`, or `roaming`);
- a completion flag for simulation cleanup.

The class will expose a small API to set a terrain target, choose a path sample, update once per animation frame, and report the walker’s current ground position. It will build the existing low-poly body once per instance. The manual walker additionally receives a baseball cap. Roaming walkers receive randomized upper-body (torso plus arms) and lower-body colors when created.

The scene owns one manual `Pedestrian` and a collection of simulated `Pedestrian` instances. It updates every walker independently during the render loop and removes a simulated walker after it completes its assigned path. This keeps movement and visual identity isolated per walker, while leaving scene-level input, geometry, and lighting in `page.tsx`.

## Manual controls

### Mouse mode

Pointer projection uses the existing ground plane and reaches every valid point on the terrain, not only pedestrian-path samples. The manual walker smoothly travels toward that ground target.

When the pointer leaves the renderer or can no longer project to the terrain, the manual walker is hidden. If the pointer lands within any dome’s blocked footprint, the terrain target is projected to the closest valid point on that dome’s exterior boundary. The walker therefore remains visible when the cursor is over a dome but stops at its edge instead of entering its mesh.

### Keyboard mode

Pressing `ArrowLeft` or `ArrowRight` switches manual control to keyboard mode and makes the manual walker visible on the pedestrian path. Each key press chooses the previous or next discrete pedestrian-path sample, clamped at the two endpoints. The walker interpolates to the selected sample and faces the path direction; it never teleports.

Any pointer movement after keyboard operation returns control to mouse mode. The next valid projected point becomes the mouse target.

## Simulation

The left-bottom HUD gains a `Walkers` control group beside the existing lighting Behavior selector:

- `Path walker` creates one simulated walker.
- `Roaming walker` creates one simulated walker.
- Each type has a `Generate crowd` action that creates a random count in the configured range.

The right control panel supplies integer `Crowd min` and `Crowd max` inputs, defaulting to 2 and 8. They determine the inclusive randomized count for each crowd action.

### Path walkers

Each path walker starts at the first sample of the current pedestrian path, advances through its discrete samples with smooth interpolation, then is removed at the final sample. The rider’s current normalized path progress selects the equivalent dome-path point for lighting activation.

### Roaming walkers

A roaming walker starts near one map edge and finishes near a different edge. At creation, it receives its own Catmull-Rom path:

1. Select start and end points from opposing or nearby-parallel terrain edges.
2. Determine the dominant direction of the dome path from its endpoints.
3. Prefer start-to-end directions that are parallel or diagonal to that direction; reject near-perpendicular candidates.
4. Add a small number of intermediate points with limited perpendicular deviation, yielding a mostly straight path.
5. Reject and regenerate a candidate if its points or segments overlap a dome blocked footprint, or if it crosses the dome path too closely.

The completed roaming path is sampled into discrete walking targets. The walker advances smoothly through them and removes itself on arrival. Its current terrain position determines dome proximity for lighting.

## Lighting aggregation

The former single `active` dome is replaced by the set of dome indices triggered by all visible walkers each frame. For each walker:

- path walkers map their normalized pedestrian-path progress to the dome path;
- roaming walkers and the manual mouse walker use their current terrain position;
- the nearest eligible dome is selected using the existing activation-distance rule.

The set is then supplied to the lighting update, so a dome can be activated once even if multiple walkers overlap it, and several domes can remain active simultaneously. The two existing lighting behaviors keep their present propagation and decay semantics; aggregation only changes how their trigger sources are determined.

## Verification

Unit tests will cover:

- `Pedestrian` target interpolation and path-sample advancement;
- dome-boundary projection for mouse targets;
- keyboard sample selection and clamping;
- random clothing assignment and manual-cap configuration;
- roaming-path direction, straightness, and obstacle rejection with deterministic randomness;
- aggregation of multiple walkers into active dome indices;
- path and roaming walker completion/removal eligibility.

The relevant test files, lint, and a production build will run before completion.
