/**
 * Mirrors the `--chart-*` custom properties in `styles/tokens.css`.
 * Recharts needs literal color strings at render time (including on the
 * server, where `getComputedStyle` doesn't exist) — this is intentional,
 * documented duplication, not a second source of truth. If you change one,
 * change both.
 */
export const CHART_COLORS_LIGHT = [
  '#0f8a54', // green
  '#c1552e', // terracotta
  '#00897b', // teal
  '#c99a3a', // gold
  '#8b4a78', // plum
  '#3e5fa0', // slate blue
] as const;

export const CHART_COLORS_DARK = [
  '#2ba36c',
  '#d06b44',
  '#1e9c8e',
  '#a8842f',
  '#a05e90',
  '#5776b8',
] as const;

/** Categorical hue order is the CVD-safety mechanism — always assign by
 * fixed index, never cycle/reassign when the series count changes. */
export function getChartColor(index: number, mode: 'light' | 'dark' = 'light'): string {
  const palette = mode === 'dark' ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  return palette[index % palette.length]!;
}
