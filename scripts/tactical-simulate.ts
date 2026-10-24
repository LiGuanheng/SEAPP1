import { Battle } from "../src/v2/simulation";
import { preset } from "../src/v2/economy";
import { FRONTS, type Front } from "../src/v2/world";
import { ARMY_KEYS, type Army, type Difficulty, type Kind } from "../src/v2/data";
import { writeFileSync } from "node:fs";
function abilities(b: Battle) {
  const allies = b.units.filter((u) => u.side === 0 && u.hp > 0),
    foes = b.units.filter((u) => u.side === 1 && u.hp > 0),
    dist = (a: { x: number; y: number }, c: { x: number; y: number }) =>
      Math.hypot(a.x - c.x, a.y - c.y);
  for (const k of ["king", ...b.loadout.commanders] as Kind[]) {
    const u = b.getUnit(k);
    if (!u || !b.skillInfo(k).available) continue;
    if (k === "titan") {
      const wall = b.structures
        .filter(
          (s) =>
            s.hp > 0 &&
            ["wall", "gate"].includes(s.kind) &&
            dist(u, s) < 280 &&
            b.nav.clear(u, s, u.id, s.id),
        )
        .sort((a, c) => dist(a, u) - dist(c, u))[0];
      if (wall) b.cast(k, wall.x, wall.y);
    } else if (k === "forest") {
      const p = allies
        .filter((v) => v.hp / v.maxHp < 0.7 && dist(u, v) < 420)
        .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
      if (p) b.cast(k, p.x, p.y);
    } else if (k === "dragon") {
      const p = [...foes, ...b.structures].find(
        (s) => s.hp > 0 && dist(u, s) < 250 && b.nav.clear(u, s, u.id, s.id),
      );
      if (p) b.cast(k, p.x, p.y);
    } else if (k === "web") {
      const p = foes
        .filter((s) => dist(u, s) < 420)
        .sort((a, c) => Number(c.kind === "captain") - Number(a.kind === "captain"))[0];
      if (p) b.cast(k, p.x, p.y);
    } else if (allies.filter((v) => dist(u, v) < 180).length > 5) b.cast(k, u.x, u.y);
  }
  const target = foes
    .filter((v) => b.canCastSpell(v.x, v.y))
    .sort(
      (a, c) =>
        foes.filter((v) => dist(v, c) < 150).length - foes.filter((v) => dist(v, a) < 150).length,
    )[0];
  if (target && foes.filter((v) => dist(v, target) < 150).length >= 5)
    b.castSpell("meteor", target.x, target.y);
  const hurt = allies
    .filter((u) => u.hp / u.maxHp < 0.6 && u.maxHp > 400)
    .sort((a, c) => c.maxHp - c.hp - (a.maxHp - a.hp))[0];
  if (hurt) b.castSpell("heal", hurt.x, hurt.y);
  const tank = allies
    .filter((u) => u.maxHp > 450 && u.hp / u.maxHp < 0.8 && foes.some((v) => dist(u, v) < 330))
    .sort((a, c) => dist(a, { x: 2000, y: 1800 }) - dist(c, { x: 2000, y: 1800 }))[0];
  if (tank) {
    b.castSpell("barrier", tank.x, tank.y);
    if (b.mana >= 65) b.castSpell("rage", tank.x, tank.y);
  }
}
const results = [];
const cases: [Difficulty, "raid" | "direct", Front][] = process.argv.includes("--sweep")
  ? (["west", "south", "east", "north"].map((f) => ["hard", "direct", f]) as [
      Difficulty,
      "raid" | "direct",
      Front,
    ][])
  : process.argv.includes("--probe")
    ? [
        ["hard", "raid", "west"],
        ["hard", "raid", "north"],
        ["hard", "direct", "north"],
      ]
    : [
        ["hard", "direct", "west"],
        ["easy", "raid", "west"],
        ["normal", "raid", "west"],
        ["hard", "raid", "west"],
        ["normal", "raid", "north"],
      ];
for (const [difficulty, mode, front] of cases) {
  const b = new Battle(
      preset(difficulty, "evolve", process.argv.includes("--sky") ? "sky" : "breach"),
      Number(process.env.SIEGE_SEED ?? 20261024),
    ),
    p = FRONTS[front],
    scouts = new Map<number, number>(),
    scoutAssigned = new Set<number>(),
    ordered = new Set<number>();
  const sites =
    front === "west"
      ? [
          [410, 1200],
          [440, 2400],
          [1400, 420],
          [1500, 3230],
          [2750, 400],
          [2580, 3200],
        ]
      : [
          [1400, 420],
          [2750, 400],
          [410, 1200],
          [3550, 1050],
          [440, 2400],
          [3550, 2200],
        ];
  const scoutStarts =
    front === "west"
      ? [
          [250, 1250],
          [250, 2350],
        ]
      : [
          [1400, 230],
          [2750, 230],
        ];
  if (mode === "raid") {
    for (const q of scoutStarts) b.deploy("raider", q[0], q[1], 1);
  }
  b.deployAll(p.x, p.y);
  if (mode === "direct") b.charge();
  let phase = 0,
    lastControl = 0,
    purchases = 0;
  const artillery =
    b.structures.find((s) => s.kind === "cannon" && s.district === "outer" && s.front === front) ??
    b.structures.find((s) => s.kind === "arrow" && s.district === "outer" && s.front === front)!;
  const innerArtillery = b.structures.find(
    (s) => s.district === "inner" && s.kind === (front === "west" ? "cannon" : "holy"),
  )!;
  const guardian = b.units.find((u) => u.kind === "captain")!;
  const outer = b.structures.find(
    (s) => s.resource && s.district === "outer" && s.front === front,
  )!;
  const inner = b.structures.find(
      (s) => s.kind === "gate" && s.district === "inner" && s.front === front,
    )!,
    core = b.structures.find(
      (s) => s.kind === "gate" && s.district === "core" && s.front === front,
    )!;
  const path = () =>
    phase === 1
      ? [
          { x: p.gateX + (front === "west" ? 250 : 0), y: front === "north" ? 820 : p.gateY },
          { x: outer.x, y: outer.y },
          {
            x: b.outposts.find((q) => q.front === front)!.x,
            y: b.outposts.find((q) => q.front === front)!.y,
          },
        ]
      : [
          { x: inner.x, y: inner.y },
          {
            x: inner.x + (front === "west" ? 170 : 0),
            y: inner.y + (front === "north" ? 170 : -170),
          },
          { x: core.x, y: core.y },
          { x: 2000, y: 1800 },
        ];
  const trace = [];
  let traceAt = 0;
  let guard = 0;
  while (b.status === "battle" && guard++ < 4000) {
    b.advance(0.25);
    b.events.length = 0;
    if (mode === "direct") {
      if (!b.active && !b.queued) break;
      continue;
    }
    if (b.time >= lastControl) {
      lastControl = b.time + 1;
      abilities(b);
      if (b.time >= traceAt) {
        traceAt = b.time + 10;
        const a = b.units.filter((u) => u.side === 0 && u.hp > 0);
        trace.push({
          time: b.time,
          phase,
          active: b.active,
          money: b.money,
          loot: b.stats.lootSites,
          hp: Math.round(a.reduce((n, u) => n + u.hp, 0)),
          center: {
            x: Math.round(a.reduce((n, u) => n + u.x, 0) / a.length),
            y: Math.round(a.reduce((n, u) => n + u.y, 0) / a.length),
          },
          types: Object.fromEntries(
            [...new Set(a.map((u) => u.kind))].map((k) => [
              k,
              a.filter((u) => u.kind === k).length,
            ]),
          ),
          kills: b.stats.kills,
          spells: b.stats.spells,
        });
      }
      const live = b.units.filter((u) => u.side === 0 && u.hp > 0);
      for (const u of live.filter((u) => u.kind === "raider" && !scoutAssigned.has(u.id))) {
        const index = Math.hypot(u.x - scoutStarts[0][0], u.y - scoutStarts[0][1]) < 160 ? 0 : 1;
        scouts.set(u.id, index);
        scoutAssigned.add(u.id);
        ordered.add(u.id);
      }
      for (let group = 0; group < 2; group++) {
        const ids = live
          .filter((u) => scouts.has(u.id) && scouts.get(u.id) === group && u.order?.type === "hold")
          .map((u) => u.id);
        if (!ids.length) continue;
        const candidates = sites
          .filter((_, i) => i % 2 === group)
          .map((q) => b.structures.find((s) => s.resource && s.x === q[0] && s.y === q[1])!)
          .filter((s) => s && s.hp > 0);
        const t = candidates[0];
        if (t) {
          const first = sites[group];
          if (t.x === first[0] && t.y === first[1])
            b.command(ids, { type: "attack", target: t.id });
          else {
            let via: { x: number; y: number }[];
            if (front === "west")
              via =
                group === 0
                  ? t.x < 2000
                    ? [{ x: 400, y: 400 }]
                    : [
                        { x: 1400, y: 150 },
                        { x: 2750, y: 150 },
                      ]
                  : [{ x: t.x, y: 3450 }];
            else
              via =
                group === 0
                  ? [
                      { x: 250, y: 150 },
                      { x: 250, y: t.y },
                    ]
                  : [
                      { x: 3750, y: 150 },
                      { x: 3750, y: t.y },
                    ];
            b.followRoute(ids, [...via, { x: t.x, y: t.y }]);
            b.setPriority(ids, "resources");
          }
        } else
          for (const id of ids) {
            scouts.delete(id);
            ordered.delete(id);
          }
      }
      if (phase === 0 && b.stats.lootSites >= 4) {
        phase = 1;
        ordered.clear();
        for (const id of scouts.keys()) ordered.add(id);
      }
      const post = b.outposts.find((q) => q.front === front)!;
      if (phase === 1 && post.captured && outer.hp === 0 && b.stats.lootSites >= 4) {
        phase = 2;
        ordered.clear();
        for (const id of scouts.keys()) ordered.add(id);
      }
      if (phase === 2 && artillery.hp === 0 && b.stats.lootSites >= 6) {
        phase = 3;
        ordered.clear();
        for (const id of scouts.keys()) ordered.add(id);
      }
      if (phase === 3 && innerArtillery.hp === 0) {
        phase = 4;
        ordered.clear();
        for (const id of scouts.keys()) ordered.add(id);
      }
      if (
        phase === 4 &&
        (core.hp === 0 ||
          live.some((u) => !scouts.has(u.id) && Math.hypot(u.x - 2000, u.y - 1800) < 380))
      ) {
        phase = 5;
        ordered.clear();
        for (const id of scouts.keys()) ordered.add(id);
      }
      if (phase === 5 && guardian.hp === 0) {
        phase = 6;
        ordered.clear();
      }
      if (phase > 0) {
        const newcomers = live.filter((u) => !ordered.has(u.id));
        if (newcomers.length) {
          if ([2, 3, 5, 6].includes(phase))
            b.command(
              newcomers.map((u) => u.id),
              {
                type: "attack",
                target:
                  phase === 2
                    ? artillery.id
                    : phase === 3
                      ? innerArtillery.id
                      : phase === 5
                        ? guardian.id
                        : b.crystal.id,
              },
            );
          else
            b.followRoute(
              newcomers.map((u) => u.id),
              path(),
            );
          for (const u of newcomers) {
            ordered.add(u.id);
            b.setPriority(
              [u.id],
              phase === 1
                ? "resources"
                : ["elf", "lizard", "wolf", "rider", "moon"].includes(u.kind)
                  ? "ranged"
                  : "armor",
            );
          }
        }
      }
      const dest = post.captured && !post.contested && post.connected ? post : p;
      const plan: Army[] = ["golem", "elf", "golem", "treant"];
      let bought = false;
      if (b.money >= 140) {
        for (let i = 0; i < 4; i++) {
          const k = plan[(purchases + i) % plan.length];
          if (b.buy(k, 1)) {
            b.deploy(k, dest.x, dest.y, Infinity);
            purchases++;
            bought = true;
            break;
          }
        }
      }
      if (!bought && b.money >= 80 && b.active < 30) {
        const k: Army = b.money >= 95 ? "goblin" : "slime";
        if (b.buy(k, 1)) b.deploy(k, dest.x, dest.y, Infinity);
      }
      for (const k of ARMY_KEYS) if (b.loadout.inventory[k]) b.deploy(k, dest.x, dest.y, Infinity);
    }
  }
  const r = {
    difficulty,
    mode,
    front,
    phase,
    purchases,
    trace,
    ...b.snapshot(),
    armyLost: !b.active && !b.queued,
    guardian: b.units
      .filter((u) => u.kind === "captain")
      .map((u) => ({ hp: u.hp, maxHp: u.maxHp })),
    alive: b.units
      .filter((u) => u.side === 0 && u.hp > 0)
      .map((u) => ({
        kind: u.kind,
        hp: Math.round(u.hp),
        x: Math.round(u.x),
        y: Math.round(u.y),
        order: u.order?.type,
        routeIndex: u.route?.index,
      })),
  };
  results.push(r);
  console.log(
    JSON.stringify({
      difficulty,
      mode,
      front,
      phase,
      status: r.status,
      time: r.time,
      core: r.crystalHp,
      loot: r.stats.lootSites,
      income: r.stats.resourceIncome,
      walls: r.stats.walls,
      active: r.active,
      guardian: r.guardian,
      money: r.money,
    }),
  );
}
writeFileSync(
  process.argv.includes("--sweep")
    ? `docs/v3.1/DIRECT_${process.env.SIEGE_SEED ?? 20261024}.json`
    : process.argv.includes("--sky")
      ? "docs/v3.1/SKY_RESULTS.json"
      : process.argv.includes("--probe")
        ? "docs/v3.1/TACTICAL_PROBE.json"
        : "docs/v3.1/TACTICAL_RESULTS.json",
  JSON.stringify(
    { date: new Date().toISOString(), seed: Number(process.env.SIEGE_SEED ?? 20261024), results },
    null,
    2,
  ),
);
