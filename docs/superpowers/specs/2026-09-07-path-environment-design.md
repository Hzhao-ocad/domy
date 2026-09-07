# Dome path environment design

## Goal

Persist editable dome-path control points in presets and turn the scene into a grass environment with a parallel pedestrian path. A low-poly pedestrian, positioned from the pointer, becomes the dome-light trigger.

## Path data

`Params` will store dome control points as serializable `{ x, y }[]` values. Dragging a dome control handle updates this state, so the existing preset save/load flow persists it automatically.

The pedestrian path is derived from the dome controls by applying a configurable Y-axis offset. It is therefore always an identically shaped parallel curve, including after editing or loading a preset. Its sample-point count, offset, and gravel width are configurable and persisted.

## Scene presentation

The existing gray plane becomes a procedural grass ground. The dome path remains a translucent collision/debug strip over the grass. The pedestrian path has a distinct gravel ribbon plus small scattered pebble meshes, with its own visible sample points available for interaction.

## Pedestrian interaction

The pointer selects the nearest generated pedestrian-path sample. The low-poly pedestrian snaps immediately to that point and faces the path tangent. The sample's normalized curve position maps to the equivalent dome-path position, which selects the nearest dome as the active source. Direct cursor collision with the dome path is removed.

## Lighting behavior

While a dome is active, every lighting update applies two ordered operations: trigger/propagation raises each reachable dome to its propagation level, then the same update's elapsed decay reduces that value. This produces a continuously refreshed but decaying light level. When no dome is active, only decay runs.

## Verification

Unit tests will cover preset merging for serialized control points, pedestrian sample snapping and normalized path mapping, and active lighting's raise-then-decay order. The production build and lint check will run after implementation.
