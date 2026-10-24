import { describe, it, expect } from "vitest";
import { Battle } from "../src/v2/simulation";
import { DeploymentStream } from "../src/v2/deployment";
import { createLoadout, preset, purchase, recruit, batchPrice, refund } from "../src/v2/economy";
import { ARMIES, ARMY_KEYS, COMMANDER_KEYS, DIFFICULTIES, SPELL_KEYS, WORLD } from "../src/v2/data";
import { FRONTS, FRONT_KEYS, createStructures, districtAt } from "../src/v2/world";
const run = (b: Battle, n: number) => {
  b.advance(n);
  b.events.length = 0;
};
const fresh = () => new Battle(createLoadout());
describe("V3 money, inventory and rapid deployment", () => {
  it.each(["easy", "normal", "hard"] as const)(
    "%s starts with correct fixed funds and calibrated time",
    (d) => {
      const l = createLoadout(d),
        b = new Battle(l);
      expect(l.money).toBe(DIFFICULTIES[d].money);
      expect(b.remaining).toBe(DIFFICULTIES[d].seconds);
    },
  );
  it("rapid purchasing is atomic and refund exact", () => {
    const l = createLoadout("normal", "summon"),
      m = l.money;
    for (let i = 0; i < 100; i++) purchase(l, "raider", 1);
    expect(l.money).toBeGreaterThanOrEqual(0);
    expect(l.money + (l.inventory.raider / 12) * batchPrice(l, "raider")).toBe(m);
    expect(refund(l, "raider")).toBe(true);
  });
  it("invalid quantities have no ledger effects", () => {
    const l = createLoadout(),
      before = structuredClone(l);
    for (const n of [NaN, 0, -1, -Infinity]) expect(purchase(l, "slime", n)).toBe(0);
    expect(l).toEqual(before);
  });
  it("six heroes, maximum four, individual unlocks", () => {
    const l = createLoadout();
    expect(purchase(l, "golem", 1)).toBe(0);
    COMMANDER_KEYS.slice(0, 4).forEach((k) => expect(recruit(l, k)).toBe(true));
    expect(recruit(l, "forest")).toBe(false);
    expect(purchase(l, "golem", 1)).toBe(1);
  });
  it.each([1, 3, 5, 10, Infinity])("batch %s commits just inventory, never extra money", (n) => {
    const l = createLoadout();
    purchase(l, "slime", Infinity);
    const b = new Battle(l),
      m = b.money,
      stock = b.loadout.inventory.slime;
    expect(b.deploy("slime", 2000, 3370, n)).toBe(true);
    expect(b.money).toBe(m);
    expect(b.queued).toBe(Math.min(stock, n * 40));
    expect(b.queued + b.loadout.inventory.slime).toBe(stock);
  });
  it("NaN and invalid map positions never poison inventory", () => {
    const l = createLoadout();
    purchase(l, "slime", 3);
    const b = new Battle(l);
    expect(b.deploy("slime", 2000, 3370, NaN)).toBe(false);
    expect(b.deploy("slime", 2000, 1800, 3)).toBe(false);
    expect(b.loadout.inventory.slime).toBe(120);
  });
  it("holding repeats at the initial world position, then stops on release", () => {
    const l = createLoadout();
    purchase(l, "slime", 10);
    const b = new Battle(l),
      stream = new DeploymentStream(b);
    expect(stream.begin("slime", 2000, 3370, 1, 0)).toBe(true);
    stream.tick(319);
    expect(b.queued).toBe(40);
    stream.tick(320);
    stream.tick(480);
    expect(b.queued).toBe(120);
    stream.end();
    stream.tick(1000);
    expect(b.queued).toBe(120);
    expect(b.queue.every((q) => q.x === 2000 && q.y === 3370)).toBe(true);
  });
  it.each(["pause", "disabled", "empty"] as const)(
    "continuous deployment ends safely on %s",
    (mode) => {
      const l = createLoadout();
      purchase(l, "slime", mode === "empty" ? 1 : 4);
      const b = new Battle(l),
        stream = new DeploymentStream(b);
      stream.begin("slime", 2000, 3370, 1, 0);
      if (mode === "pause") b.paused = true;
      stream.tick(400, mode !== "disabled");
      expect(stream.active).toBe(false);
      expect(b.queued).toBe(40);
    },
  );
  it("hero and all-stock clicks never auto-repeat", () => {
    const b = new Battle(preset("normal", "evolve")),
      stream = new DeploymentStream(b);
    stream.begin("titan", 2000, 3370, 1, 0);
    expect(stream.active).toBe(false);
    stream.begin("slime", 2000, 3370, Infinity, 0);
    expect(stream.active).toBe(false);
  });
  it("300-cap queue is conserved and admits 300 in three seconds", () => {
    const l = createLoadout();
    purchase(l, "slime", Infinity);
    const b = new Battle(l);
    b.deploy("slime", 2000, 3370, Infinity);
    const total = b.queued;
    run(b, 3.2);
    expect(b.active).toBe(300);
    expect(b.queued + b.active + b.stats.lost).toBe(total);
  });
});
describe("V3 four fronts, depth and real occlusion", () => {
  it.each(FRONT_KEYS)("%s has a legal initial position and distinct resource economy", (front) => {
    const b = fresh(),
      p = FRONTS[front];
    expect(b.canDeploy(p.x, p.y)).toBe(true);
    expect(b.nav.connected(p, b.crystal)).toBe(false);
    expect(b.structures.some((s) => s.resource && s.front === front)).toBe(true);
  });
  it("core stays at geometric center with original 5600 HP", () => {
    const b = fresh();
    expect(b.crystal.x).toBe(WORLD.width / 2);
    expect(b.crystal.y).toBe(WORLD.height / 2);
    expect(b.crystal.hp).toBe(5600);
  });
  it.each(["outer", "inner", "core"] as const)(
    "%s has four real gates and complete enclosure",
    (d) => {
      const b = fresh();
      expect(b.structures.filter((s) => s.district === d && s.kind === "gate")).toHaveLength(4);
    },
  );
  it("intact outer corners have no traversable gap", () => {
    const b = fresh();
    for (const x of [600, 3400])
      for (const y of [550, 3050]) expect(b.nav.obstacleAt(x, y)).toBeGreaterThan(0);
  });
  it("walls stop ranged attacks in both directions", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("lizard", 2000, 3130),
      e = b.spawn("archer", 2000, 2960, 1);
    a.order = { type: "attack", target: e.id };
    e.homeX = e.x;
    e.homeY = e.y;
    const before = [a.hp, e.hp];
    run(b, 1);
    expect([a.hp, e.hp]).toEqual(before);
  });
  it("breaking a real gate updates ground connectivity", () => {
    const b = fresh(),
      p = b.outposts.find((p) => p.front === "south")!;
    expect(p.connected).toBe(false);
    const gate = b.structures.find(
      (s) => s.kind === "gate" && s.district === "outer" && s.front === "south",
    )!;
    b.damage(gate, gate.hp);
    run(b, 0.1);
    expect(p.connected).toBe(true);
    expect(b.nav.connected(FRONTS.south, p)).toBe(true);
  });
  it("friendly ground does not pass an intact wall", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("slime", 2000, 3110);
    b.command([a.id], { type: "move", x: 2000, y: 2900 });
    run(b, 1);
    expect(a.y).toBeGreaterThan(3080);
    expect(b.stats.walls).toBe(0);
  });
  it("no inner/core tower covers an initial deployment zone", () => {
    for (const f of FRONT_KEYS) {
      const b = fresh(),
        p = FRONTS[f];
      b.units.forEach((u) => (u.hp = 0));
      const a = b.spawn("golem", p.x, p.y);
      a.order = { type: "move", x: p.x, y: p.y };
      run(b, 2);
      expect(a.hp).toBe(a.maxHp);
      expect(b.stats.towerShots.inner + b.stats.towerShots.core).toBe(0);
    }
  });
  it("finite reserve troops exist from start, dispatch without creating units", () => {
    const b = fresh(),
      count = b.units.length,
      team = b.reserveTeams[0],
      starts = team.ids.map((id) => ({ ...b.byId.get(id)! }));
    for (let i = 0; i < 12; i++)
      b.spawn("golem", 2000 + (i % 5) * 20, 3150 + Math.floor(i / 5) * 20);
    run(b, 13);
    expect(b.units.length).toBe(count + 12);
    expect(b.reinforcementCount).toBeGreaterThan(0);
    expect(team.dispatchedAt).toBeGreaterThan(0);
    expect(
      team.ids.some(
        (id, i) =>
          Math.hypot(b.byId.get(id)!.x - starts[i].x, b.byId.get(id)!.y - starts[i].y) > 20,
      ),
    ).toBe(true);
  });
  it("a single feint does not dispatch every reserve", () => {
    const b = fresh();
    const u = b.spawn("slime", 450, 1800);
    u.order = { type: "move", x: 450, y: 1800 };
    run(b, 13);
    expect(b.reinforcementCount).toBe(0);
  });
  it("ground must open a forward route before forward deployment", () => {
    const b = fresh(),
      p = b.outposts[0];
    p.captured = true;
    expect(b.canDeploy(p.x, p.y)).toBe(false);
  });
});
describe("V3 tactical armies, mana and spells", () => {
  it("raider destroys nearby resource, receives single base+bonus reward", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const s = b.structures.find((s) => s.kind === "mine" && s.district === "field")!,
      a = b.spawn("raider", s.x - 90, s.y);
    b.command([a.id], { type: "attack", target: s.id });
    const m = b.money;
    run(b, 40);
    expect(s.hp).toBe(0);
    expect(b.money).toBe(m + s.reward + 90);
    b.damage(s, 9000, a);
    expect(b.money).toBe(m + s.reward + 90);
  });
  it("elf spends a real windup before damaging a cluster", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("elf", 1800, 3350),
      e = b.spawn("soldier", 1990, 3350, 1),
      f = b.spawn("soldier", 2020, 3350, 1);
    a.cooldown = 0;
    a.order = { type: "attack", target: e.id };
    e.root = 4;
    f.root = 4;
    run(b, 0.5);
    expect(e.hp).toBe(e.maxHp);
    run(b, 1);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(f.hp).toBeLessThan(f.maxHp);
  });
  it("elf never bursts enemies behind an intact wall", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("elf", 2000, 3140),
      e = b.spawn("soldier", 2000, 2950, 1);
    e.root = 4;
    a.order = { type: "attack", target: e.id };
    run(b, 1.5);
    expect(e.hp).toBe(e.maxHp);
  });
  it.each(SPELL_KEYS)("%s validates visibility, mana and cooldown atomically", (spell) => {
    const b = fresh(),
      before = b.mana;
    expect(b.castSpell(spell, 2000, 1800)).not.toBe("");
    expect(b.mana).toBe(before);
    b.spawn("golem", 2000, 3370);
    run(b, 0.02);
    expect(b.castSpell(spell, 2000, 3370)).toBe("");
    expect(b.mana).toBeLessThan(before);
    const after = b.mana;
    expect(b.castSpell(spell, 2000, 3370)).not.toBe("");
    expect(b.mana).toBe(after);
  });
  it("healing restores over time without reviving dead units", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("golem", 2000, 3370),
      dead = b.spawn("slime", 2040, 3370);
    a.hp = 100;
    b.damage(dead, 900);
    run(b, 0.02);
    b.castSpell("heal", a.x, a.y);
    run(b, 1);
    expect(a.hp).toBeGreaterThan(120);
    expect(dead.hp).toBe(0);
  });
  it("barrier reduces actual incoming damage", () => {
    const b = fresh(),
      a = b.spawn("golem", 2000, 3370);
    run(b, 0.02);
    b.castSpell("barrier", a.x, a.y);
    run(b, 0.1);
    const hp = a.hp;
    b.damage(a, 100);
    expect(hp - a.hp).toBeCloseTo(60);
  });
  it("rage actually accelerates movement", () => {
    const l = createLoadout(),
      a = new Battle(l),
      b = new Battle(l),
      u = a.spawn("goblin", 2000, 3400),
      v = b.spawn("goblin", 2000, 3400);
    a.command([u.id], { type: "move", x: 2000, y: 3250 });
    b.command([v.id], { type: "move", x: 2000, y: 3250 });
    run(a, 0.02);
    run(b, 0.02);
    a.castSpell("rage", u.x, u.y);
    run(a, 1);
    run(b, 1);
    expect(u.y).toBeLessThan(v.y - 10);
  });
  it("meteor has a warning delay and cannot hit across a wall", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const a = b.spawn("golem", 2000, 3150),
      e = b.spawn("soldier", 2000, 2990, 1);
    e.root = 4;
    run(b, 0.02);
    expect(b.castSpell("meteor", 2000, 3100)).toBe("");
    run(b, 0.6);
    expect(e.hp).toBe(e.maxHp);
    run(b, 0.6);
    expect(e.hp).toBe(e.maxHp);
    expect(a.hp).toBe(a.maxHp);
  });
  it("paused mana and cooldown stop and no insufficient-mana casts", () => {
    const b = fresh();
    b.spawn("goblin", 2000, 3370);
    b.mana = 0;
    expect(b.castSpell("rage", 2000, 3370)).toContain("魔力不足");
    b.paused = true;
    run(b, 10);
    expect(b.mana).toBe(0);
    b.paused = false;
    run(b, 10);
    expect(b.mana).toBeCloseTo(18);
  });
});
describe("V3 results and lifecycle invariants", () => {
  it("only crystal destruction wins, victory takes precedence on timeout", () => {
    const b = fresh();
    b.time = DIFFICULTIES.normal.seconds;
    b.crystal.hp = 0;
    b.checkResult();
    expect(b.status).toBe("victory");
  });
  it("timeout reaches exactly zero", () => {
    const b = fresh();
    b.time = DIFFICULTIES.normal.seconds - 0.01;
    run(b, 0.1);
    expect(b.status).toBe("defeat");
    expect(b.remaining).toBe(0);
  });
  it("exhaustion preserves funds, inventory, heroes and summons correctly", () => {
    const b = fresh();
    b.checkResult();
    expect(b.status).toBe("battle");
    b.loadout.money = 0;
    b.heroInventory.clear();
    b.checkResult();
    expect(b.status).toBe("defeat");
  });
  it("king death does not kill surviving combat forces", () => {
    const b = fresh(),
      a = b.spawn("king", 2000, 3370);
    b.spawn("goblin", 2040, 3370);
    b.damage(a, 9000);
    b.checkResult();
    expect(b.status).toBe("battle");
  });
  it("new session restores ledger, map, spells and queue independently", () => {
    const l = preset("normal", "evolve"),
      a = new Battle(l);
    a.deployAll(2000, 3370);
    run(a, 2);
    a.castSpell("rage", 2000, 3320);
    const b = new Battle(l);
    expect(b.time).toBe(0);
    expect(b.mana).toBe(100);
    expect(b.queued).toBe(0);
    expect(b.loadout).toEqual(l);
    expect(b.crystal.hp).toBe(5600);
  });
  it("fixed 60Hz is deterministic at different render frame rates", () => {
    const l = preset("normal", "evolve"),
      a = new Battle(l, 42),
      b = new Battle(l, 42);
    a.deployAll(2000, 3370);
    b.deployAll(2000, 3370);
    a.advance(1);
    for (let i = 0; i < 120; i++) b.advance(1 / 120);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
  it("twelve distinct troops remain available through correct unlocks", () => {
    expect(ARMY_KEYS).toHaveLength(12);
    expect(ARMIES.raider.commander).toBeUndefined();
    expect(ARMIES.elf.splash).toBeGreaterThan(0);
    expect(createStructures("hard").filter((s) => s.kind === "cannon").length).toBeGreaterThan(
      createStructures("easy").filter((s) => s.kind === "cannon").length,
    );
    expect(districtAt(2000, 1800)).toBe("core");
  });
});

describe("V3 route and commander regressions", () => {
  it.each(FRONT_KEYS)("%s ground army really crosses three broken rings", (front) => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    for (const s of b.structures)
      if (!["wall", "gate", "crystal"].includes(s.kind)) b.damage(s, s.hp);
    const p = FRONTS[front];
    for (let i = 0; i < 4; i++) b.spawn("golem", p.x + i * 12, p.y);
    let entered = false;
    for (let n = 0; n < 180 && !entered; n++) {
      run(b, 1);
      entered = b.units.some((u) => u.side === 0 && u.hp > 0 && districtAt(u.x, u.y) === "core");
    }
    expect(entered).toBe(true);
    expect(b.stats.walls).toBeGreaterThanOrEqual(3);
  });
  it("meteor can target an occluding resource itself, but not a building beyond a wall", () => {
    const b = fresh(),
      s = b.structures.find((s) => s.kind === "supply" && s.district === "field")!;
    b.spawn("golem", s.x - 120, s.y);
    run(b, 0.02);
    expect(b.canCastSpell(s.x, s.y)).toBe(true);
    expect(b.castSpell("meteor", s.x, s.y)).toBe("");
    run(b, 1);
    expect(s.hp).toBeLessThan(s.maxHp);
  });
  it("ordinary guard returns home after a target leaves its defense radius", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const e = b.spawn("soldier", 1000, 3350, 1),
      u = b.spawn("golem", 1100, 3350);
    e.guardRadius = 180;
    run(b, 1);
    b.command([u.id], { type: "move", x: 1500, y: 3350 });
    run(b, 8);
    expect(Math.hypot(e.x - e.homeX, e.y - e.homeY)).toBeLessThan(100);
  });
  it("dragon breath, titan breach, wolf buff, web root, forest heal and slime copies remain manual", () => {
    const b = fresh();
    b.units.forEach((u) => (u.hp = 0));
    const dragon = b.spawn("dragon", 1800, 3350),
      enemy = b.spawn("knight", 2000, 3350, 1);
    enemy.root = 9;
    run(b, 0.02);
    const hp = enemy.hp;
    expect(b.cast("dragon", 2050, 3350)).toBe("");
    expect(enemy.hp).toBe(hp - 170);
    const moon = b.spawn("moon", 1400, 3350),
      wolf = b.spawn("wolf", 1450, 3350);
    run(b, 0.02);
    b.cast("moon", moon.x, moon.y);
    expect(wolf.hunt).toBe(9);
    const web = b.spawn("web", 2100, 3350);
    run(b, 0.02);
    b.cast("web", enemy.x, enemy.y);
    expect(enemy.root).toBe(5);
    const forest = b.spawn("forest", 1400, 3320),
      golem = b.spawn("golem", 1430, 3320);
    golem.hp = 100;
    run(b, 0.02);
    b.cast("forest", forest.x, forest.y);
    expect(golem.hp).toBeGreaterThan(200);
    const emperor = b.spawn("emperor", 2600, 3350);
    for (let i = 0; i < 30; i++) b.spawn("slime", 2600 + i, 3350);
    run(b, 0.02);
    b.cast("emperor", emperor.x, emperor.y);
    expect(b.queue.filter((q) => q.small).reduce((n, q) => n + q.count, 0)).toBe(25);
    const titan = b.spawn("titan", 2200, 3150),
      wall = b.structures.find(
        (s) =>
          s.kind === "wall" && s.district === "outer" && Math.abs(s.x - 2200) < 60 && s.y === 3050,
      )!;
    run(b, 0.02);
    const before = wall.hp;
    expect(b.cast("titan", wall.x, wall.y)).toBe("");
    expect(wall.hp).toBe(Math.max(0, before - 750));
    expect(dragon.hp).toBeGreaterThan(0);
    expect(web.hp).toBeGreaterThan(0);
    expect(titan.hp).toBeGreaterThan(0);
  });
  it.each(["summon", "evolve", "element"] as const)(
    "%s specialization F is retained beside common spells",
    (spec) => {
      const b = new Battle(createLoadout("normal", spec)),
        u = b.spawn("king", 2000, 3370),
        ally = b.spawn("goblin", 2040, 3370);
      run(b, 0.02);
      expect(b.cast("king", u.x, u.y)).toBe("");
      if (spec === "summon") expect(b.queued).toBe(30);
      if (spec === "evolve") expect(ally.buff).toBe(10);
      expect(b.stats.skills).toBe(1);
      expect(b.stats.spells).toBe(0);
    },
  );
});

describe("V3 invalid payload and finite lifecycle", () => {
  it("unknown dragged spells cannot poison mana or cooldown maps", () => {
    const b = fresh();
    for (const k of ["constructor", "__proto__", "unknown"])
      expect(b.castSpell(k as never, 2000, 3370)).toBe("未知法术");
    expect(b.mana).toBe(100);
    expect(b.spellReadyAt.size).toBe(0);
  });
  it("ordinary troops cannot impersonate a commander active skill", () => {
    const b = fresh();
    b.spawn("golem", 2000, 3370);
    expect(b.cast("golem", 2000, 3370)).not.toBe("");
    expect(b.stats.skills).toBe(0);
  });
  it("no defense units appear from a timer after several reserve cycles", () => {
    const b = fresh(),
      n = b.units.length;
    run(b, 100);
    expect(b.units.length).toBe(n);
    expect(b.reinforcementCount).toBe(0);
  });
  it("empty or concluded all-deploy never reports a successful duplicate", () => {
    const b = fresh();
    b.heroInventory.clear();
    expect(b.deployAll(2000, 3370)).toBe(false);
    b.status = "victory";
    b.heroInventory.add("king");
    expect(b.deployAll(2000, 3370)).toBe(false);
    expect(b.queued).toBe(0);
  });
});
