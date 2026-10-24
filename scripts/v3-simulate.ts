import { Battle } from "../src/v2/simulation";
import { preset, createLoadout, purchase, recruit } from "../src/v2/economy";
import { ARMY_KEYS, type Army, type Difficulty, isCommander } from "../src/v2/data";
import { FRONTS, type Front } from "../src/v2/world";
import { writeFileSync } from "node:fs";
export function direct(b: Battle, front: Front) {
  const living = b.units.filter((u) => u.side === 0 && u.hp > 0),
    enemies = b.units.filter((u) => u.side === 1 && u.hp > 0);
  const near = (x: number, y: number, r: number) =>
    living.filter((u) => Math.hypot(u.x - x, u.y - y) < r);
  for (const k of ["king", ...b.loadout.commanders] as const) {
    const u = b.getUnit(k);
    if (!u || !b.skillInfo(k).available) continue;
    if (k === "titan") {
      const s = b.structures
        .filter(
          (s) =>
            s.hp > 0 &&
            ["wall", "gate"].includes(s.kind) &&
            Math.hypot(s.x - u.x, s.y - u.y) < 280 &&
            b.nav.clear(u, s, u.id, s.id),
        )
        .sort((a, c) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(c.x - u.x, c.y - u.y))[0];
      if (s) b.cast(k, s.x, s.y);
    } else if (k === "forest") {
      const t = near(u.x, u.y, 430)
        .filter((v) => v.hp / v.maxHp < 0.75)
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (t) b.cast(k, t.x, t.y);
    } else if (k === "dragon") {
      const t = [...enemies, ...b.structures].find(
        (s) => s.hp > 0 && Math.hypot(s.x - u.x, s.y - u.y) < 250 && b.nav.clear(u, s, u.id, s.id),
      );
      if (t) b.cast(k, t.x, t.y);
    } else if (k === "web") {
      const t = enemies.find((v) => Math.hypot(v.x - u.x, v.y - u.y) < 400);
      if (t) b.cast(k, t.x, t.y);
    } else if (k !== "emperor" && near(u.x, u.y, 180).length > 4) b.cast(k, u.x, u.y);
  }
  const injured = living
    .filter((u) => u.hp / u.maxHp < 0.65)
    .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
  if (injured && near(injured.x, injured.y, 160).length >= 3)
    b.castSpell("heal", injured.x, injured.y);
  const push = living
    .filter(
      (u) =>
        u.maxHp > 400 &&
        (u.hp < u.maxHp ||
          b.structures.some(
            (s) =>
              s.hp > 0 &&
              ["wall", "gate"].includes(s.kind) &&
              Math.hypot(s.x - u.x, s.y - u.y) < 160,
          )),
    )
    .sort((a, c) => Math.hypot(a.x - 2000, a.y - 1800) - Math.hypot(c.x - 2000, c.y - 1800))[0];
  if (push && near(push.x, push.y, 180).length > 5) {
    b.castSpell("barrier", push.x, push.y);
    b.castSpell("rage", push.x, push.y);
  }
  const target = enemies
    .filter((e) =>
      living.some((u) => Math.hypot(e.x - u.x, e.y - u.y) < 340 && b.nav.clear(u, e, u.id, e.id)),
    )
    .sort(
      (a, c) =>
        enemies.filter((e) => Math.hypot(e.x - c.x, e.y - c.y) < 150).length -
        enemies.filter((e) => Math.hypot(e.x - a.x, e.y - a.y) < 150).length,
    )[0];
  if (target && enemies.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) < 150).length >= 5)
    b.castSpell("meteor", target.x, target.y);
  const post = b.outposts.find(
    (p) => p.front === front && p.captured && !p.contested && p.connected,
  );
  const p = post ?? FRONTS[front];
  const wanted: Army[] = b.loadout.commanders.includes("titan")
    ? ["golem", "elf", "treant", "lizard", "goblin", "raider", "slime"]
    : ["wyvern", "elf", "lizard", "goblin", "raider", "slime"];
  if (b.money >= 110) for (const k of wanted) if (b.buy(k, 1)) break;
  for (const k of ARMY_KEYS) if (b.loadout.inventory[k]) b.deploy(k, p.x, p.y, Infinity);
}
const cases: [Difficulty, "breach" | "sky" | "slime", Front][] = [
  ["easy", "breach", "west"],
  ["normal", "breach", "west"],
  ["normal", "breach", "north"],
  ["hard", "breach", "west"],
  ["normal", "sky", "south"],
  ["normal", "slime", "south"],
];
const results = [];
for (const [difficulty, strategy, front] of cases) {
  const l =
    strategy === "slime"
      ? createLoadout(difficulty, "summon")
      : preset(difficulty, "evolve", strategy);
  if (strategy === "slime") {
    recruit(l, "emperor");
    purchase(l, "slime", Infinity);
  }
  const b = new Battle(l, 20261024),
    p = FRONTS[front],
    start = performance.now();
  b.deployAll(p.x, p.y);
  let control = 0;
  while (b.status === "battle") {
    b.advance(0.25);
    b.events.length = 0;
    if (strategy !== "slime" && b.time >= control) {
      control = b.time + 2;
      direct(b, front);
    }
  }
  const r = {
    difficulty,
    strategy,
    front,
    seed: b.seed,
    ...b.snapshot(),
    wallMs: Math.round(performance.now() - start),
    heroes: b.units
      .filter((u) => isCommander(u.kind))
      .map((u) => ({ kind: u.kind, hp: Math.round(u.hp), x: Math.round(u.x), y: Math.round(u.y) })),
    remainingStructures: b.structures
      .filter((s) => s.hp > 0 && s.kind !== "wall" && s.kind !== "gate")
      .map((s) => ({ kind: s.kind, x: s.x, y: s.y, hp: Math.round(s.hp) })),
  };
  results.push(r);
  console.log(
    JSON.stringify({
      difficulty,
      strategy,
      front,
      status: r.status,
      time: r.time,
      core: r.crystalHp,
      walls: r.stats.walls,
      kills: r.stats.kills,
      active: r.active,
      income: r.stats.income,
      first: r.firstCoreHit,
    }),
  );
}
writeFileSync(
  "docs/v3/BALANCE_RESULTS.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      method:
        "legal budget; actual purchase/deploy; same Battle.advance fixed 60Hz; no hp/money/result overrides",
      results,
    },
    null,
    2,
  ),
);
