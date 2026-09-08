export type LightingOptions = {
  propagationDelay: number;
  propagationFactor: number;
  decayInterval: number;
  decayAmount: number;
};

export type LightingState = {
  brightness: number[];
  options: LightingOptions;
  activeIndex: number | null;
  activationTime: number;
  lastDecayTime: number;
};

const roundBrightness = (value: number) => Math.round(value * 10000) / 10000;

export function createLightingState(
  count: number,
  options: LightingOptions,
): LightingState {
  return {
    brightness: Array.from({ length: count }, () => 0),
    options,
    activeIndex: null,
    activationTime: 0,
    lastDecayTime: 0,
  };
}

export function activateDome(
  state: LightingState,
  index: number,
  time: number,
): LightingState {
  return {
    ...state,
    activeIndex: index,
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
  return {
    ...state,
    activeIndex: null,
    lastDecayTime: time,
  };
}

export function advanceLighting(
  state: LightingState,
  time: number,
): LightingState {
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
        const distance = Math.abs(index - state.activeIndex!);
        const arrivalTime = state.activationTime + distance * state.options.propagationDelay;
        const propagation = roundBrightness(state.options.propagationFactor ** distance);
        const refreshed = time >= arrivalTime ? propagation : value;
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
