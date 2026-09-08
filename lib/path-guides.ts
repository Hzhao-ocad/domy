export function pathGuideVisibility(showDomePath: boolean, showPedestrianPath = false) {
  return {
    domePath: showDomePath,
    pedestrianPath: showPedestrianPath,
  };
}
