import assert from 'node:assert/strict';
import test from 'node:test';
import { setPaletteColor } from './palette.ts';

test('updates only the selected palette color', () => {
  const palette = ['#f6b8c8', '#f7cfa8', '#f5e6aa'];

  assert.deepEqual(setPaletteColor(palette, 1, '#ff0000'), [
    '#f6b8c8',
    '#ff0000',
    '#f5e6aa',
  ]);
});
