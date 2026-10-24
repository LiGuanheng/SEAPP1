import { Battle } from "../src/v2/simulation";
import { preset, createLoadout, recruit, purchase } from "../src/v2/economy";
import { FRONTS, type Front } from "../src/v2/world";
import type { Army, Difficulty, Kind } from "../src/v2/data";
import { writeFileSync } from "node:fs";
const cases: [Difficulty, "breach" | "sky" | "wrong", Front][] = [
  ["normal", "breach", "west"],
  ["normal", "breach", "north"],
  ["normal", "sky", "west"],
  ["hard", "breach", "west"],
  ["normal", "wrong", "south"],
];
const results = [];
for (const [difficulty, strategy, front] of cases) {
  const l =
    strategy === "wrong"
      ? createLoadout(difficulty, "summon")
      : preset(difficulty, "evolve", strategy);
  if (strategy === "wrong") {
    recruit(l, "emperor");
    purchase(l, "slime", Infinity);
  }
  const b = new Battle(l, 20261024),
    p = FRONTS[front];
  if (strategy !== "wrong") {
    const starts =
      front === "north"
        ? [
            [1400, 230],
            [2750, 230],
          ]
        : [
            [250, 1200],
            [250, 2400],
          ];
    for (const q of starts) b.deploy("raider", q[0], q[1], 1);
  }
  b.deployAll(p.x, p.y);
  let nextAction = 0,
    purchases = 0,
    actions = 0,
    final = false,
    nextTrace = 0;
  const trace = [];
  while (b.status === "battle") {
    b.advance(0.5);
    b.events.length = 0;
    if (b.time >= nextTrace) {
      nextTrace = b.time + 15;
      const a = b.units.filter((u) => u.side === 0 && u.hp > 0);
      trace.push({
        ...b.snapshot(),
        goals: Object.fromEntries(
          [...new Set(a.map((u) => u.autoGoal?.label))].map((k) => [
            k,
            a.filter((u) => u.autoGoal?.label === k).length,
          ]),
        ),
      });
    }
    if (b.time < nextAction) continue;
    nextAction = b.time + 5;
    const post = b.outposts.find((q) => q.front === front)!,
      dest = post.captured && !post.contested && b.canDeploy(post.x, post.y) ? post : p;
    const plan: Army[] =
      strategy === "wrong"
        ? ["slime"]
        : strategy === "sky"
          ? ["treant", "elf", "lizard", "wyvern"]
          : ["golem", "elf", "treant", "lizard"];
    for (let i = 0; i < plan.length; i++) {
      const k = plan[(purchases + i) % plan.length];
      if (b.buy(k, 1)) {
        b.deploy(k, dest.x, dest.y, 1);
        purchases++;
        break;
      }
    }
    // A scripted player makes only strategic purchases and a small, finite number of manual casts.
    if (strategy !== "wrong" && actions < 8) {
      for (const k of ["titan", "forest", "web", "dragon", "king"] as Kind[]) {
        const u = b.getUnit(k);
        if (!u || !b.skillInfo(k).available) continue;
        const near = (v: { x: number; y: number }) => Math.hypot(u.x - v.x, u.y - v.y);
        let t;
        if (k === "titan")
          t = b.structures
            .filter(
              (s) =>
                s.hp > 0 &&
                ["wall", "gate"].includes(s.kind) &&
                near(s) < 270 &&
                b.nav.clear(u, s, u.id, s.id),
            )
            .sort((a, c) => near(a) - near(c))[0];
        else if (k === "forest")
          t = b.units
            .filter((v) => v.side === 0 && v.hp > 0 && v.hp / v.maxHp < 0.6 && near(v) < 400)
            .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
        else if (k === "web")
          t = b.units.find(
            (v) => v.side === 1 && v.hp > 0 && near(v) < 400 && b.nav.clear(u, v, u.id, v.id),
          );
        else if (k === "dragon")
          t = b.units.find(
            (v) => v.side === 1 && v.hp > 0 && near(v) < 240 && b.nav.clear(u, v, u.id, v.id),
          );
        else if (b.units.filter((v) => v.side === 0 && v.hp > 0 && near(v) < 180).length > 8) t = u;
        if (t && !b.cast(k, t.x, t.y)) {
          actions++;
          break;
        }
      }
    }
    if (!final && strategy === "sky" && b.time > 100) {
      b.issueLegion("assault");
      final = true;
    }
    if (!b.active && !b.queued && b.money < 80) break;
  }
  const r = {
    difficulty,
    strategy,
    front,
    purchases,
    manualCasts: actions,
    finalCommand: final,
    ...b.snapshot(),
    trace,
    alive: b.units
      .filter((u) => u.side === 0 && u.hp > 0)
      .map((u) => ({
        kind: u.kind,
        x: Math.round(u.x),
        y: Math.round(u.y),
        goal: u.autoGoal,
        target: u.target,
      })),
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
      active: r.active,
      loot: r.stats.lootSites,
      purchases,
      casts: actions,
    }),
  );
}
writeFileSync(
  "docs/v4.0/AUTO_CAMPAIGNS.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      seed: 20261024,
      method:
        "Only legal purchases/deployment and <=8 player casts. No route/target orders. Sky case requests final assault once at 100s.",
      results,
    },
    null,
    2,
  ),
);
