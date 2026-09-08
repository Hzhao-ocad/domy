export const defaultPalette = [
  '#f6b8c8',
  '#f7cfa8',
  '#f5e6aa',
  '#bce3cf',
  '#bbdcf2',
  '#d2c2ef',
];

export function setPaletteColor(palette: string[], index: number, color: string): string[] {
  return palette.map((current, currentIndex) =>
    currentIndex === index ? color : current,
  );
}
