export type LightingOptions = {
  propagationDelay: number;
  propagationFactor: number;
  decayInterval: number;
  decayAmount: number;
};

export type LightingBehavior =
  | 'direction'
  | 'curiosity'
  | 'ripple'
  | 'halo'
  | 'afterglow';
type PropagationDirection = -1 | 1 | null;

export type LightingState = {
  brightness: number[];
  options: LightingOptions;
  behavior: LightingBehavior;
  activeIndexes: number[];
  propagationDirections: PropagationDirection[];
  activationTime: number;
  lastDecayTime: number;
  recoveryIndexes: number[];
};

const roundBrightness = (value: number) => Math.round(value * 10000) / 10000;

export function createLightingState(
  count: number,
  options: LightingOptions,
  behavior: LightingBehavior = 'direction',
): LightingState {
  return {
    brightness: Array.from({ length: count }, () => behavior === 'curiosity' ? 1 : 0),
    options,
    behavior,
    activeIndexes: [],
    propagationDirections: [],
    activationTime: 0,
    lastDecayTime: 0,
    recoveryIndexes: [],
  };
}

function nearestIndex(indexes: readonly number[], index: number): number | null {
  return indexes.reduce<number | null>((nearest, candidate) => {
    if (nearest === null || Math.abs(candidate - index) < Math.abs(nearest - index)) return candidate;
    return nearest;
  }, null);
}

function indexesByNearestDistance(
  count: number,
  sources: readonly number[],
  farthestFirst: boolean,
  includeSources: boolean,
): number[] {
  return Array.from({ length: count }, (_, index) => index)
    .filter((index) => includeSources || !sources.includes(index))
    .sort((a, b) => {
      const distanceDifference = Math.min(...sources.map((source) => Math.abs(a - source)))
        - Math.min(...sources.map((source) => Math.abs(b - source)));
      return farthestFirst ? -distanceDifference || a - b : distanceDifference || a - b;
    });
}

export function activateDomes(
  state: LightingState,
  indexes: readonly number[],
  time: number,
): LightingState {
  if (indexes.length === 0) {
    return state.activeIndexes.length === 0 ? state : clearActivation(state, time);
  }

  const activeIndexes = [...new Set(indexes)];
  const propagationDirections = state.behavior === 'curiosity'
    ? activeIndexes.map(() => null)
    : activeIndexes.map((index) => {
      const previous = nearestIndex(state.activeIndexes, index);
      return previous === null || previous === index ? null : index > previous ? 1 : -1;
    });

  return {
    ...state,
    activeIndexes,
    propagationDirections,
    activationTime: time,
    lastDecayTime: time,
    recoveryIndexes: [],
    brightness: state.brightness.map((value, index) => activeIndexes.includes(index) ? 1 : value),
  };
}

export function activateDome(
  state: LightingState,
  index: number,
  time: number,
): LightingState {
  return activateDomes(state, [index], time);
}

export function clearActivation(
  state: LightingState,
  time: number,
): LightingState {
  return state.behavior === 'curiosity'
    ? {
      ...state,
      activeIndexes: [],
      propagationDirections: [],
      activationTime: time,
      lastDecayTime: time,
      recoveryIndexes: state.activeIndexes,
    }
    : {
      ...state,
      activeIndexes: [],
      propagationDirections: [],
      lastDecayTime: time,
    };
}

function advanceCuriosity(state: LightingState, time: number): LightingState {
  const steps = Math.floor((time - state.lastDecayTime) / state.options.decayInterval);
  if (steps <= 0) return state;

  const sources = state.activeIndexes.length > 0 ? state.activeIndexes : state.recoveryIndexes;
  if (sources.length === 0) {
    return { ...state, lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval };
  }

  const isActive = state.activeIndexes.length > 0;
  const order = indexesByNearestDistance(state.brightness.length, sources, isActive, !isActive);
  const brightness = state.brightness.map((value, index) => state.activeIndexes.includes(index) ? 1 : value);

  for (let step = 1; step <= steps; step += 1) {
    const stepTime = state.lastDecayTime + step * state.options.decayInterval;
    order.forEach((index, rank) => {
      if (stepTime < state.activationTime + rank * state.options.propagationDelay) return;
      brightness[index] = isActive
        ? roundBrightness(brightness[index] * (1 - state.options.decayAmount))
        : roundBrightness(brightness[index] + (1 - brightness[index]) * state.options.decayAmount);
    });
  }

  return {
    ...state,
    lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval,
    brightness,
  };
}

function advanceDirection(state: LightingState, time: number): LightingState {
  const steps = Math.floor((time - state.lastDecayTime) / state.options.decayInterval);

  if (state.activeIndexes.length > 0) {
    const multiplier = (1 - state.options.decayAmount) ** steps;
    return {
      ...state,
      lastDecayTime: steps > 0
        ? state.lastDecayTime + steps * state.options.decayInterval
        : state.lastDecayTime,
      brightness: state.brightness.map((value, index) => {
        const refreshed = state.activeIndexes.reduce((brightest, source, sourceIndex) => {
          const direction = state.propagationDirections[sourceIndex];
          const distance = (index - source) * (direction ?? 0);
          const arrives = state.activationTime + distance * state.options.propagationDelay;
          const canPropagate = index === source || direction !== null && distance > 0;
          const propagated = canPropagate && time >= arrives
            ? roundBrightness(state.options.propagationFactor ** distance)
            : 0;
          return Math.max(brightest, propagated);
        }, value);
        const brightness = steps > 0 ? roundBrightness(refreshed * multiplier) : refreshed;
        return brightness >= .001 ? brightness : 0;
      }),
    };
  }

  if (steps <= 0) return state;

  const multiplier = (1 - state.options.decayAmount) ** steps;
  return {
    ...state,
    lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval,
    brightness: state.brightness.map((value) =>
      value * multiplier < .001 ? 0 : roundBrightness(value * multiplier)),
  };
}

function advanceRipple(state: LightingState, time: number): LightingState {
  if (state.activeIndexes.length === 0) return advanceDirection(state, time);

  return {
    ...state,
    brightness: state.brightness.map((_, index) => {
      if (state.activeIndexes.includes(index)) return 1;
      return state.activeIndexes.reduce((brightest, source) => {
        const distance = Math.abs(index - source);
        const arrivedAt = state.activationTime + distance * state.options.propagationDelay;
        if (time < arrivedAt) return brightest;
        const age = Math.floor((time - arrivedAt) / state.options.decayInterval);
        return Math.max(
          brightest,
          roundBrightness(
            state.options.propagationFactor ** distance
              * (1 - state.options.decayAmount) ** age,
          ),
        );
      }, 0);
    }),
  };
}

function advanceHalo(state: LightingState, time: number): LightingState {
  if (state.activeIndexes.length === 0) return advanceDirection(state, time);

  return {
    ...state,
    lastDecayTime: time,
    brightness: state.brightness.map((_, index) =>
      roundBrightness(
        state.options.propagationFactor ** Math.min(
          ...state.activeIndexes.map((source) => Math.abs(index - source)),
        ),
      )),
  };
}

function advanceAfterglow(state: LightingState, time: number): LightingState {
  const steps = Math.floor((time - state.lastDecayTime) / state.options.decayInterval);
  if (steps <= 0) return state;

  const multiplier = (1 - state.options.decayAmount * .25) ** steps;
  return {
    ...state,
    lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval,
    brightness: state.brightness.map((value, index) =>
      state.activeIndexes.includes(index) ? 1 : roundBrightness(value * multiplier)),
  };
}

export function advanceLighting(state: LightingState, time: number): LightingState {
  if (state.behavior === 'curiosity') return advanceCuriosity(state, time);
  if (state.behavior === 'ripple') return advanceRipple(state, time);
  if (state.behavior === 'halo') return advanceHalo(state, time);
  if (state.behavior === 'afterglow') return advanceAfterglow(state, time);
  return advanceDirection(state, time);
}
