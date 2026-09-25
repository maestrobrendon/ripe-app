// Progress model for the Basket coach. Pure and client-safe (no DB imports),
// like the rest of the trained assistant's rule set. Never described as AI in
// customer copy.
//
// Points are derived from activity that already exists in the database rather
// than stored on the user, so a score can never drift from what the account has
// actually done, and there is nothing to award, migrate or reconcile.

export const POINTS_PER_ORDER = 50;
export const POINTS_PER_STREAK_WEEK = 25;
/** Per distinct kind of produce currently saved in the standing basket. */
export const POINTS_PER_BASKET_KIND = 5;

export type Level = {
  index: number;
  title: string;
  minPoints: number;
};

export const LEVELS: Level[] = [
  { index: 1, title: "Sprout", minPoints: 0 },
  { index: 2, title: "Grower", minPoints: 150 },
  { index: 3, title: "Cultivator", minPoints: 400 },
  { index: 4, title: "Harvester", minPoints: 800 },
  { index: 5, title: "Market gardener", minPoints: 1500 },
];

export type CoachInputs = {
  orders: number;
  streakWeeks: number;
  basketKinds: number;
};

export type CoachProgress = {
  points: number;
  level: Level;
  nextLevel: Level | null;
  pointsToNext: number;
  /** 0-100 through the current level, or 100 at the top level. */
  progressPct: number;
};

export function computeCoachPoints({ orders, streakWeeks, basketKinds }: CoachInputs): number {
  return (
    orders * POINTS_PER_ORDER +
    streakWeeks * POINTS_PER_STREAK_WEEK +
    basketKinds * POINTS_PER_BASKET_KIND
  );
}

export function levelForPoints(points: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) current = level;
  }
  return current;
}

export function computeCoachProgress(inputs: CoachInputs): CoachProgress {
  const points = computeCoachPoints(inputs);
  const level = levelForPoints(points);
  const nextLevel = LEVELS.find((l) => l.minPoints > points) ?? null;

  if (!nextLevel) {
    return { points, level, nextLevel: null, pointsToNext: 0, progressPct: 100 };
  }

  const span = nextLevel.minPoints - level.minPoints;
  const into = points - level.minPoints;
  return {
    points,
    level,
    nextLevel,
    pointsToNext: nextLevel.minPoints - points,
    progressPct: Math.min(100, Math.max(0, Math.round((into / span) * 100))),
  };
}
