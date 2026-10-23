import {
  ARMIES,
  ARMY_KEYS,
  COMMANDERS,
  DIFFICULTIES,
  type Army,
  type Commander,
  type Difficulty,
  type Specialization,
} from "./data";
export interface Loadout {
  difficulty: Difficulty;
  spec: Specialization;
  commanders: Commander[];
  inventory: Record<Army, number>;
  money: number;
  spent: number;
}
export const emptyInventory = () =>
  Object.fromEntries(ARMY_KEYS.map((k) => [k, 0])) as Record<Army, number>;
export function createLoadout(
  difficulty: Difficulty = "normal",
  spec: Specialization = "evolve",
): Loadout {
  return {
    difficulty,
    spec,
    commanders: [],
    inventory: emptyInventory(),
    money: DIFFICULTIES[difficulty].money,
    spent: 0,
  };
}
export function batchPrice(l: Pick<Loadout, "spec">, k: Army) {
  return Math.ceil(
    ARMIES[k].price * (l.spec === "summon" && !ARMIES[k].commander ? 0.85 : 1),
  );
}
export function unlocked(l: Loadout, k: Army) {
  return !ARMIES[k].commander || l.commanders.includes(ARMIES[k].commander!);
}
export function recruit(l: Loadout, k: Commander): boolean {
  if (
    l.commanders.includes(k) ||
    l.commanders.length >= 4 ||
    l.money < COMMANDERS[k].price
  )
    return false;
  l.commanders.push(k);
  l.money -= COMMANDERS[k].price;
  l.spent += COMMANDERS[k].price;
  return true;
}
export function dismiss(l: Loadout, k: Commander): boolean {
  if (!l.commanders.includes(k) || l.inventory[COMMANDERS[k].army] > 0)
    return false;
  l.commanders = l.commanders.filter((c) => c !== k);
  l.money += COMMANDERS[k].price;
  l.spent -= COMMANDERS[k].price;
  return true;
}
export function purchase(l: Loadout, k: Army, batches: number): number {
  if (
    !unlocked(l, k) ||
    (!Number.isFinite(batches) && batches !== Infinity) ||
    batches <= 0
  )
    return 0;
  const p = batchPrice(l, k);
  const n = Math.min(Math.floor(l.money / p), Math.floor(batches));
  if (n <= 0) return 0;
  l.money -= n * p;
  l.spent += n * p;
  l.inventory[k] += n * ARMIES[k].batch;
  return n;
}
export function refund(l: Loadout, k: Army): boolean {
  if (l.inventory[k] < ARMIES[k].batch) return false;
  l.inventory[k] -= ARMIES[k].batch;
  l.money += batchPrice(l, k);
  l.spent -= batchPrice(l, k);
  return true;
}
export function preset(
  difficulty: Difficulty,
  spec: Specialization,
  strategy: "breach" | "sky" | "swarm" = "breach",
): Loadout {
  const l = createLoadout(difficulty, spec);
  const cs: Commander[] =
    strategy === "breach"
      ? ["titan", "moon", "forest"]
      : strategy === "sky"
        ? ["dragon", "web", "forest"]
        : ["emperor", "titan"];
  cs.forEach((c) => recruit(l, c));
  const plan: [Army, number][] =
    strategy === "breach"
      ? [
          ["golem", 4],
          ["goblin", 5],
          ["wolf", 3],
          ["lizard", 3],
          ["treant", 2],
          ["slime", 2],
        ]
      : strategy === "sky"
        ? [
            ["wyvern", 5],
            ["goblin", 5],
            ["lizard", 4],
            ["spider", 3],
            ["treant", 2],
            ["slime", 1],
          ]
        : [
            ["split", 8],
            ["golem", 3],
            ["lizard", 3],
            ["slime", 5],
          ];
  plan.forEach(([k, n]) => purchase(l, k, n));
  return l;
}
