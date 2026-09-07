import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateDome,
  advanceLighting,
  clearActivation,
  createLightingState,
} from './lighting.ts';

test('propagates from the source in 300 ms hops with a 0.67 multiplier', () => {
  let state = createLightingState(5, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 2, 0);
  assert.deepEqual(state.brightness, [0, 0, 1, 0, 0]);

  state = advanceLighting(state, 300);
  assert.deepEqual(state.brightness, [0, 0.67, 1, 0.67, 0]);

  state = advanceLighting(state, 600);
  assert.deepEqual(state.brightness, [0.4489, 0.67, 1, 0.67, 0.4489]);
});

test('decays every dome by 50 percent every 50 ms after the cursor leaves', () => {
  let state = createLightingState(3, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 1, 0);
  state = clearActivation(state, 0);
  state = advanceLighting(state, 50);
  assert.deepEqual(state.brightness, [0, 0.5, 0]);

  state = advanceLighting(state, 100);
  assert.deepEqual(state.brightness, [0, 0.25, 0]);
});

test('keeps existing brightness when a different dome begins emitting', () => {
  let state = createLightingState(5, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 2, 0);
  state = advanceLighting(state, 300);
  state = activateDome(state, 4, 300);

  assert.deepEqual(state.brightness, [0, 0.67, 1, 0.67, 1]);

  state = advanceLighting(state, 600);
  assert.deepEqual(state.brightness, [0, 0.67, 1, 0.67, 1]);
});
