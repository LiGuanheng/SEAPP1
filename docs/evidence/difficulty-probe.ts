// Reproducible supplementary playability probe. It uses only the normal ledger,
// orders and skill APIs; it never replaces HP, wallets or result state.
import { Battle } from "../../src/v2/simulation";
import { preset } from "../../src/v2/economy";
import { type Army } from "../../src/v2/data";
import { writeFileSync } from "node:fs";
const results = [];
for (const difficulty of ["easy", "hard"] as const)
  for (const strategy of ["breach", "sky"] as const) {
    const b = new Battle(preset(difficulty, "evolve", strategy), 20261024);
    // West air approach avoids the east anti-air battery; it is a legal tactical choice.
    const x = 850;
    b.deployAll(x, 2070);
    let next = 0;
    while (b.status === "battle" && b.time < 721) {
      b.advance(0.25);
      b.events.length = 0;
      if (b.time >= next) {
        next = b.time + 4;
        for (const c of b.loadout.commanders) {
          const u = b.getUnit(c);
          if (!u || !b.skillInfo(c).available) continue;
          if (c === "titan") {
            const w = b.structures.find(
              (s) =>
                s.hp > 0 &&
                ["wall", "gate"].includes(s.kind) &&
                Math.hypot(s.x - u.x, s.y - u.y) < 290,
            );
            if (w) b.cast(c, w.x, w.y);
          } else if (c === "dragon") {
            const t = b.structures.find(
              (s) =>
                s.hp > 0 &&
                !["wall", "gate"].includes(s.kind) &&
                Math.hypot(s.x - u.x, s.y - u.y) < 250,
            );
            if (t) b.cast(c, t.x, t.y);
          } else if (c === "forest") {
            const t = b.units
              .filter(
                (v) =>
                  v.side === 0 &&
                  v.hp > 0 &&
                  v.hp < v.maxHp * 0.8 &&
                  Math.hypot(v.x - u.x, v.y - u.y) < 430,
              )
              .sort((a, z) => z.maxHp - z.hp - (a.maxHp - a.hp))[0];
            if (t) b.cast(c, t.x, t.y);
          } else b.cast(c, u.x, u.y);
        }
        const king = b.getUnit("king");
        if (king && b.time > 8 && b.skillInfo("king").available) {
          const t = b.units
            .filter((v) => v.side === 0 && v.hp > 0 && Math.hypot(v.x - king.x, v.y - king.y) < 430)
            .sort((a, z) => a.y - z.y)[0];
          if (t) b.cast("king", t.x, t.y);
        }
        const p = b.outposts.find((p) => p.captured && !p.contested && b.canDeploy(p.x, p.y));
        const px = p?.x ?? x,
          py = p?.y ?? 2070;
        for (const k of [
          strategy === "breach" ? "golem" : "wyvern",
          "lizard",
          "goblin",
          "slime",
        ] as Army[])
          if (b.buy(k, 1)) break;
        for (const k of Object.keys(b.loadout.inventory) as Army[])
          if (b.loadout.inventory[k]) b.deploy(k, px, py, Infinity);
      }
    }
    results.push({ difficulty, strategy, approach: "west", ...b.snapshot() });
  }
writeFileSync(
  "docs/V2_DIFFICULTY_RESULTS.json",
  JSON.stringify(
    {
      seed: 20261024,
      note: "Supplementary easy/hard fixed-seed playability samples using normal purchases, healing and blessing. The sky army approaches from west. No HP/wallet overrides.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  results.map((r) => ({
    difficulty: r.difficulty,
    strategy: r.strategy,
    status: r.status,
    time: r.time,
    crystal: r.crystalHp,
  })),
);
