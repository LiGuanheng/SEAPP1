import { WORLD } from "./data";
import type { Point } from "./navigation";
export const PRIORITIES = {
  auto: "兵种特性",
  troops: "敌方守军",
  defenses: "城防设施",
  resources: "资源建筑",
  ranged: "弓手 / 法师",
  armor: "骑士 / 重甲",
} as const;
export type Priority = keyof typeof PRIORITIES;
export interface RoutePlan {
  id: number;
  points: Point[];
  index: number;
  origin: Point;
  offset: Point;
}
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
/** Preserve the drawn bends and last destination, without one path field per mouse pixel. */
export function routePoints(input: Point[]): Point[] {
  const valid = input
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({
      x: Math.max(40, Math.min(WORLD.width - 40, p.x)),
      y: Math.max(40, Math.min(WORLD.height - 40, p.y)),
    }));
  const simplify = (a: Point[]): Point[] => {
    if (a.length < 3) return a;
    let best = 28,
      index = 0;
    for (let i = 1; i < a.length - 1; i++) {
      const d = segmentDistance(a[i], a[0], a[a.length - 1]);
      if (d > best) {
        best = d;
        index = i;
      }
    }
    return index
      ? [...simplify(a.slice(0, index + 1)).slice(0, -1), ...simplify(a.slice(index))]
      : [a[0], a[a.length - 1]];
  };
  const compact = valid.filter(
    (p, i) =>
      i === 0 ||
      i === valid.length - 1 ||
      Math.hypot(p.x - valid[i - 1].x, p.y - valid[i - 1].y) > 16,
  );
  const result = simplify(compact);
  return result.length <= 24
    ? result
    : Array.from({ length: 24 }, (_, i) => result[Math.round((i * (result.length - 1)) / 23)]);
}
