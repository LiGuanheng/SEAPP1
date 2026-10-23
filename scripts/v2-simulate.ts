import { Battle } from "../src/v2/simulation";
import { preset, createLoadout, purchase, recruit } from "../src/v2/economy";
import { ARMY_KEYS, isCommander, type Army } from "../src/v2/data";
import { writeFileSync } from "node:fs";
const results = [];
for (const strategy of ["breach", "sky", "slime"] as const) {
  for (const seed of [19, 42, 20261024]) {
    const l =
      strategy === "slime"
        ? createLoadout("normal", "summon")
        : preset("normal", "evolve", strategy);
    if (strategy === "slime") {
      recruit(l, "emperor");
      purchase(l, "slime", Infinity);
    }
    const b = new Battle(l, seed);
    b.deployAll(strategy === "slime" ? 1600 : strategy === "breach" ? 850 : 2330, 2070);
    let lastBuy = 0;
    const start = performance.now();
    while (b.status === "battle" && b.time < 601) {
      b.step(1 / 60);
      b.events.length = 0;
      if (strategy !== "slime" && Math.floor(b.time) > lastBuy + 5) {
        lastBuy = Math.floor(b.time);
        for (const c of l.commanders) {
          const u = b.getUnit(c);
          if (!u || !b.skillInfo(c).available) continue;
          if (c === "titan") {
            const wall = b.structures.find(
              (s) =>
                s.hp > 0 &&
                ["wall", "gate"].includes(s.kind) &&
                Math.hypot(s.x - u.x, s.y - u.y) < 280,
            );
            if (wall) b.cast(c, wall.x, wall.y);
          } else if (c === "dragon") {
            const t = b.structures.find(
              (s) =>
                s.hp > 0 &&
                !["wall", "gate"].includes(s.kind) &&
                Math.hypot(s.x - u.x, s.y - u.y) < 260,
            );
            if (t) b.cast(c, t.x, t.y);
          } else b.cast(c, u.x, u.y);
        }
        const p = b.outposts.find((p) => p.captured && !p.contested);
        const x = p?.x ?? (strategy === "breach" ? 850 : 2330),
          y = p?.y ?? 2070;
        const buy: Army = strategy === "breach" ? "golem" : "wyvern";
        b.buy(buy, 1);
        b.deploy(buy, x, y, Infinity);
        for (const k of ARMY_KEYS) if (b.loadout.inventory[k]) b.deploy(k, x, y, Infinity);
      }
    }
    const result = {
      strategy,
      seed,
      ...b.snapshot(),
      wallMs: Math.round(performance.now() - start),
      heroes: b.units
        .filter((u) => isCommander(u.kind))
        .map((u) => ({
          kind: u.kind,
          hp: Math.round(u.hp),
          x: Math.round(u.x),
          y: Math.round(u.y),
        })),
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
}
writeFileSync("docs/V2_BALANCE_RESULTS.json", JSON.stringify(results, null, 2));
