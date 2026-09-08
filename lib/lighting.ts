export type LightingOptions = {
  propagationDelay: number;
  propagationFactor: number;
  decayInterval: number;
  decayAmount: number;
};

export type LightingBehavior = 'direction' | 'curiosity';

export type LightingState = {
  brightness: number[];
  options: LightingOptions;
  behavior: LightingBehavior;
  activeIndex: number | null;
  propagationDirection: -1 | 1 | null;
  activationTime: number;
  lastDecayTime: number;
  recoveryIndex: number | null;
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
    activeIndex: null,
    propagationDirection: null,
    activationTime: 0,
    lastDecayTime: 0,
    recoveryIndex: null,
  };
}

function indexesByDistance(
  count: number,
  origin: number,
  farthestFirst: boolean,
): number[] {
  return Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const distanceDifference = Math.abs(a - origin) - Math.abs(b - origin);
    return farthestFirst ? -distanceDifference || a - b : distanceDifference || a - b;
  });
}

export function activateDome(
  state: LightingState,
  index: number,
  time: number,
): LightingState {
  if (state.behavior === 'curiosity') {
    return {
      ...state,
      activeIndex: index,
      propagationDirection: null,
      activationTime: time,
      lastDecayTime: time,
      recoveryIndex: null,
      brightness: state.brightness.map((value, domeIndex) => domeIndex === index ? 1 : value),
    };
  }

  return {
    ...state,
    activeIndex: index,
    propagationDirection: state.activeIndex === null || state.activeIndex === index
      ? null
      : index > state.activeIndex ? 1 : -1,
    activationTime: time,
    lastDecayTime: time,
    brightness: state.brightness.map((value, domeIndex) =>
      domeIndex === index ? 1 : value,
    ),
  };
}

export function clearActivation(
  state: LightingState,
  time: number,
): LightingState {
  if (state.behavior === 'curiosity') {
    return {
      ...state,
      activeIndex: null,
      propagationDirection: null,
      activationTime: time,
      lastDecayTime: time,
      recoveryIndex: state.activeIndex,
    };
  }

  return {
    ...state,
    activeIndex: null,
    propagationDirection: null,
    lastDecayTime: time,
  };
}

export function advanceLighting(
  state: LightingState,
  time: number,
): LightingState {
  if (state.behavior === 'curiosity') {
    const elapsed = time - state.lastDecayTime;
    const steps = Math.floor(elapsed / state.options.decayInterval);

    if (steps <= 0) return state;

    const brightness = [...state.brightness];
    const source = state.activeIndex ?? state.recoveryIndex;
    const order = source === null
      ? []
      : indexesByDistance(brightness.length, source, state.activeIndex !== null);

    for (let step = 1; step <= steps; step += 1) {
      const stepTime = state.lastDecayTime + step * state.options.decayInterval;
      order.forEach((index, rank) => {
        if (stepTime < state.activationTime + rank * state.options.propagationDelay) return;

        if (state.activeIndex !== null) {
          brightness[index] = index === state.activeIndex
            ? 1
            : roundBrightness(brightness[index] * (1 - state.options.decayAmount));
        } else {
          brightness[index] = roundBrightness(
            brightness[index] + (1 - brightness[index]) * state.options.decayAmount,
          );
        }
      });
    }

    return {
      ...state,
      lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval,
      brightness,
    };
  }

  if (state.activeIndex !== null) {
    const elapsed = time - state.lastDecayTime;
    const steps = Math.floor(elapsed / state.options.decayInterval);
    const multiplier = (1 - state.options.decayAmount) ** steps;
    return {
      ...state,
      lastDecayTime: steps > 0
        ? state.lastDecayTime + steps * state.options.decayInterval
        : state.lastDecayTime,
      brightness: state.brightness.map((value, index) => {
        const distance = (index - state.activeIndex!) * (state.propagationDirection ?? 0);
        const arrivalTime = state.activationTime + distance * state.options.propagationDelay;
        const propagation = roundBrightness(state.options.propagationFactor ** distance);
        const isSource = index === state.activeIndex;
        const movesForward = state.propagationDirection !== null && distance > 0;
        const refreshed = (isSource || movesForward) && time >= arrivalTime ? propagation : value;
        const brightness = steps > 0
          ? roundBrightness(refreshed * multiplier)
          : refreshed;

        return brightness >= 0.001 ? brightness : 0;
      }),
    };
  }

  const elapsed = time - state.lastDecayTime;
  const steps = Math.floor(elapsed / state.options.decayInterval);

  if (steps <= 0) return state;

  const multiplier = (1 - state.options.decayAmount) ** steps;
  return {
    ...state,
    lastDecayTime: state.lastDecayTime + steps * state.options.decayInterval,
    brightness: state.brightness.map((value) =>
      value * multiplier < 0.001 ? 0 : roundBrightness(value * multiplier),
    ),
  };
}
