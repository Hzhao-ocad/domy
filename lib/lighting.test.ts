import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateDome,
  advanceLighting,
  clearActivation,
  createLightingState,
} from './lighting.ts';

test('propagates before applying elapsed decay', () => {
  let state = createLightingState(5, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 2, 0);
  assert.deepEqual(state.brightness, [0, 0, 1, 0, 0]);

  state = advanceLighting(state, 300);
  assert.deepEqual(state.brightness, [0, 0.0105, 0.0156, 0.0105, 0]);

  state = advanceLighting(state, 600);
  assert.deepEqual(state.brightness, [0.007, 0.0105, 0.0156, 0.0105, 0.007]);
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

test('decays an active source after refreshing its trigger brightness', () => {
  let state = createLightingState(1, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 0, 0);
  state = advanceLighting(state, 50);

  assert.deepEqual(state.brightness, [0.5]);
});

test('decays an old emitter while refreshing the new emitter', () => {
  let state = createLightingState(5, {
    propagationDelay: 300,
    propagationFactor: 0.67,
    decayInterval: 50,
    decayAmount: 0.5,
  });

  state = activateDome(state, 2, 0);
  state = advanceLighting(state, 300);
  state = activateDome(state, 4, 300);

  state = advanceLighting(state, 600);
  assert.deepEqual(state.brightness, [0, 0, 0, 0.0105, 0.0156]);
});
