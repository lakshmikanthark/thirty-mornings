export const FINAL_DAY = 30;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function coverageForDay(day) {
  const safeDay = clamp(Number(day) || 1, 1, FINAL_DAY);
  return 2 ** (safeDay - FINAL_DAY);
}

export function percentForDay(day) {
  return coverageForDay(day) * 100;
}

export function formatPercent(percent) {
  if (percent >= 99.95) return '100%';
  if (percent >= 10) return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
  if (percent >= 1) return `${percent.toFixed(percent >= 3 ? 3 : 4).replace(/0+$/, '').replace(/\.$/, '')}%`;
  if (percent >= 0.01) return `${percent.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
  return '<0.01%';
}

export const REVEAL_DAYS = [25, 26, 27, 28, 29, 30].map((day) => ({
  day,
  coverage: coverageForDay(day),
  percent: percentForDay(day),
}));

const TIMELINE = [
  { p: 0.00, day: 1 },
  { p: 0.10, day: 2 },
  { p: 0.27, day: 20 },
  { p: 0.45, day: 25 },
  { p: 0.50, day: 26 },
  { p: 0.54, day: 27 },
  { p: 0.58, day: 28 },
  { p: 0.62, day: 30 },
  { p: 0.72, day: 30 },
  { p: 0.82, day: 29 },
  { p: 0.91, day: 30 },
  { p: 1.00, day: 30 },
];

export function dayForProgress(progress) {
  const p = clamp(progress, 0, 1);
  for (let i = 0; i < TIMELINE.length - 1; i += 1) {
    const a = TIMELINE[i];
    const b = TIMELINE[i + 1];
    if (p >= a.p && p <= b.p) {
      const local = (p - a.p) / Math.max(0.0001, b.p - a.p);
      const eased = local * local * (3 - 2 * local);
      return a.day + (b.day - a.day) * eased;
    }
  }
  return FINAL_DAY;
}

export function storyStateForProgress(progress) {
  const day = dayForProgress(progress);
  const coverage = coverageForDay(day);
  return {
    progress: clamp(progress, 0, 1),
    day,
    displayDay: Math.min(FINAL_DAY, Math.max(1, Math.round(day))),
    coverage,
    percent: coverage * 100,
  };
}
