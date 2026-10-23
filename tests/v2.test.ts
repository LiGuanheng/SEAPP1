import { describe, it, expect } from "vitest";
import { ARMIES, ARMY_KEYS, COMMANDER_KEYS, DIFFICULTIES, type Commander } from "../src/v2/data";
import { createLoadout, purchase, recruit, refund, batchPrice, preset } from "../src/v2/economy";
import { Battle } from "../src/v2/simulation";
describe("V2 ledger and loadout", () => {
  it.each(["easy", "normal", "hard"] as const)("difficulty %s has exact money/time", (d) => {
    const l = createLoadout(d),
      b = new Battle(l);
    expect(l.money).toBe(DIFFICULTIES[d].money);
    expect(b.remaining).toBe(DIFFICULTIES[d].seconds);
  });
  it("buy is atomic, deployment is separate, no negative funds on rapid buy", () => {
    const l = createLoadout();
    expect(purchase(l, "slime", 1)).toBe(1);
    expect(l.inventory.slime).toBe(40);
    expect(l.money).toBe(2720);
    for (let i = 0; i < 100; i++) purchase(l, "goblin", 1);
    expect(l.money).toBeGreaterThanOrEqual(0);
    expect((l.inventory.goblin / 20) * 95 + (l.inventory.slime / 40) * 80 + l.money).toBe(2800);
  });
  it("recruitment caps at four and unlocks only its own special", () => {
    const l = createLoadout();
    expect(purchase(l, "golem", 1)).toBe(0);
    COMMANDER_KEYS.slice(0, 4).forEach((c) => expect(recruit(l, c)).toBe(true));
    expect(recruit(l, "forest")).toBe(false);
    expect(recruit(l, "dragon")).toBe(false);
    expect(purchase(l, "golem", 1)).toBe(1);
    expect(purchase(l, "treant", 1)).toBe(0);
  });
  it("summoner discount rounds upward only for common armies", () => {
    const l = createLoadout("normal", "summon");
    expect(batchPrice(l, "slime")).toBe(68);
    expect(batchPrice(l, "goblin")).toBe(81);
    expect(batchPrice(l, "golem")).toBe(140);
  });
  it("invalid amounts and locked purchases have zero effects", () => {
    const l = createLoadout(),
      before = structuredClone(l);
    for (const n of [0, -1, NaN, -Infinity]) expect(purchase(l, "slime", n)).toBe(0);
    expect(purchase(l, "wyvern", 3)).toBe(0);
    expect(l).toEqual(before);
  });
  it("refund returns exact batch and price", () => {
    const l = createLoadout("normal", "summon");
    purchase(l, "slime", 1);
    expect(refund(l, "slime")).toBe(true);
    expect(l.money).toBe(2800);
    expect(refund(l, "slime")).toBe(false);
  });
});
describe("V2 deployment, clock and result invariants", () => {
  it("fixed-step timeout leaves exactly zero displayed time, without floating residue", () => {
    const b = new Battle(createLoadout());
    b.advance(600);
    expect(b.status).toBe("defeat");
    expect(b.remaining).toBe(0);
  });
  it("the deployed king dying does not end a surviving army", () => {
    const l = createLoadout();
    purchase(l, "goblin", 1);
    const b = new Battle(l);
    b.deploy("king", 850, 2070);
    b.deploy("goblin", 850, 2070);
    b.advance(1);
    b.damage(b.getUnit("king")!, 99999);
    b.checkResult();
    expect(b.status).toBe("battle");
    expect(b.active).toBeGreaterThan(0);
    expect(b.skillInfo("king").available).toBe(false);
    expect(b.deploy("king", 850, 2070)).toBe(false);
  });
  it("a real defender pays its reward only once", () => {
    const b = new Battle(createLoadout());
    const u = b.units.find((u) => u.kind === "soldier")!,
      before = b.money;
    b.damage(u, 99999);
    b.damage(u, 99999);
    expect(b.money).toBe(before + 1);
    expect(b.stats.kills).toBe(1);
  });
  it("fixed simulation gives identical results across render frame rates", () => {
    const l = preset("normal", "evolve"),
      a = new Battle(l, 42),
      b = new Battle(l, 42);
    a.deployAll(850, 2070);
    b.deployAll(850, 2070);
    a.advance(1);
    for (let i = 0; i < 120; i++) b.advance(1 / 120);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.units).toEqual(b.units);
  });
  it("invalid crystal deployment never consumes stock or money", () => {
    const b = new Battle(preset("normal", "evolve"));
    const m = b.money,
      n = b.loadout.inventory.golem;
    expect(b.deploy("golem", 1600, 1000, 1)).toBe(false);
    expect(b.money).toBe(m);
    expect(b.loadout.inventory.golem).toBe(n);
    expect(b.deploy("golem", 850, 2070, 1)).toBe(true);
    expect(b.money).toBe(m);
    expect(b.queued).toBe(4);
  });
  it("queue preserves every purchased unit above the 300 active cap", () => {
    const l = createLoadout("easy");
    purchase(l, "slime", Infinity);
    const b = new Battle(l);
    b.deploy("slime", 850, 2200, Infinity);
    const total = b.queued;
    for (let i = 0; i < 300; i++) b.step(0.05);
    expect(b.active).toBeLessThanOrEqual(300);
    expect(b.active + b.queued + b.stats.lost).toBe(total);
    expect(b.queued).toBeGreaterThan(0);
  });
  it("paused time and CDs stop; 2x uses simulation seconds", () => {
    const b = new Battle(createLoadout());
    b.paused = true;
    b.advance(3);
    expect(b.time).toBe(0);
    b.paused = false;
    b.speed = 2;
    b.advance(1);
    expect(b.time).toBeCloseTo(2, 5);
    expect(b.remaining).toBeCloseTo(598, 5);
  });
  it("destroying any facility never changes time limit", () => {
    const b = new Battle(createLoadout());
    const barracks = b.structures.find((s) => s.kind === "barracks")!;
    b.damage(barracks, 99999);
    expect(b.remaining).toBe(600);
    expect(b.money).toBe(2900);
    b.damage(barracks, 99999);
    expect(b.money).toBe(2900);
  });
  it("remaining cash, heroes or stock prevents false exhaustion", () => {
    const b = new Battle(createLoadout());
    b.checkResult();
    expect(b.status).toBe("battle");
    b.loadout.money = 0;
    b.checkResult();
    expect(b.status).toBe("battle");
    b.heroInventory.clear();
    b.checkResult();
    expect(b.status).toBe("defeat");
  });
  it("crystal death wins even on timeout frame", () => {
    const b = new Battle(createLoadout());
    b.time = 600;
    b.crystal.hp = 0;
    b.checkResult();
    expect(b.status).toBe("victory");
  });
  it("timeout is exact and does not need a casualty", () => {
    const b = new Battle(createLoadout());
    b.time = 599.95;
    b.step(0.05);
    expect(b.status).toBe("defeat");
    expect(b.reason).toContain("净化");
  });
  it("IDs are unique and fixed seed reproduces initial defenders", () => {
    const a = new Battle(preset("normal", "evolve"), 19),
      b = new Battle(preset("normal", "evolve"), 19);
    expect(a.units).toEqual(b.units);
    expect(new Set([...a.structures, ...a.units].map((t) => t.id)).size).toBe(
      a.structures.length + a.units.length,
    );
  });
  it("evolution and element passives modify actual stats", () => {
    const b = new Battle(createLoadout("normal", "evolve"));
    expect(b.spawn("golem", 800, 2000).maxHp).toBeCloseTo(605);
    const e = new Battle(createLoadout("normal", "element"));
    expect(e.spawn("lizard", 800, 2000).damage).toBeCloseTo(9.9);
  });
  it("all 10 distinct troop types are configured", () => {
    expect(ARMY_KEYS).toHaveLength(10);
    expect(new Set(ARMY_KEYS.map((k) => ARMIES[k].sprite)).size).toBe(10);
  });
  it("retry starts fresh; no destruction/reward/time carries over", () => {
    const l = preset("normal", "evolve"),
      a = new Battle(l);
    a.damage(a.structures[0], 9999);
    a.time = 99;
    const b = new Battle(l);
    expect(b.time).toBe(0);
    expect(b.structures[0].hp).toBe(b.structures[0].maxHp);
    expect(b.money).toBe(l.money);
  });
});
describe("V2 six manual heroes and commands", () => {
  it("evolution blessing buffs actual friendlies for ten seconds", () => {
    const b = new Battle(createLoadout("normal", "evolve"));
    b.spawn("king", 850, 2070);
    const u = b.spawn("goblin", 850, 2070);
    b.step(0.01);
    expect(b.cast("king", 850, 2070)).toBe("");
    expect(u.buff).toBe(10);
    expect(b.readyAt.get("king")).toBeCloseTo(b.time + 65);
  });
  it("meteor has the explicit 35 damage cap against the crystal", () => {
    const b = new Battle(createLoadout("normal", "element"));
    b.spawn("king", 1600, 1100);
    const hp = b.crystal.hp;
    expect(b.cast("king", 1600, 1000)).toBe("");
    expect(b.crystal.hp).toBe(hp - 35);
  });
  function hero(k: Commander) {
    const l = createLoadout();
    recruit(l, k);
    const b = new Battle(l);
    b.spawn(k, 850, 1600);
    b.step(0.01);
    return b;
  }
  it("unspawned/dead hero cannot cast or spend a cooldown", () => {
    const b = new Battle(createLoadout());
    expect(b.cast("titan", 850, 1700)).not.toBe("");
    expect(b.readyAt.size).toBe(0);
  });
  it("titan breaks a real collision segment, cooldown forbids repeat", () => {
    const b = hero("titan");
    const wall = b.structures.find((s) => s.weak && s.x === 850 && s.y === 1700)!;
    const hp = wall.hp;
    expect(b.cast("titan", wall.x, wall.y)).toBe("");
    expect(wall.hp).toBe(Math.max(0, hp - 750));
    expect(b.nav.obstacleAt(wall.x, wall.y)).toBe(0);
    expect(b.cast("titan", wall.x, wall.y)).not.toBe("");
  });
  it("dragon cone deals damage only inside actual cone", () => {
    const b = hero("dragon");
    const u = b.spawn("soldier", 1000, 1600, 1),
      back = b.spawn("soldier", 700, 1600, 1);
    expect(b.cast("dragon", 1040, 1600)).toBe("");
    expect(u.hp).toBe(0);
    expect(back.hp).toBe(back.maxHp);
  });
  it("moon buff only affects fast friendly troops", () => {
    const b = hero("moon"),
      fast = b.spawn("wolf", 850, 1600),
      slow = b.spawn("golem", 850, 1600);
    b.step(0.01);
    expect(b.cast("moon", 850, 1600)).toBe("");
    expect(fast.hunt).toBe(9);
    expect(slow.hunt).toBe(0);
  });
  it("web roots ground enemies", () => {
    const b = hero("web"),
      u = b.spawn("soldier", 850, 1590, 1);
    b.step(0.01);
    expect(b.cast("web", 850, 1590)).toBe("");
    expect(u.root).toBe(5);
  });
  it("forest heal is capped by each target maximum HP", () => {
    const b = hero("forest"),
      u = b.spawn("golem", 850, 1590);
    u.hp = u.maxHp * 0.9;
    b.step(0.01);
    expect(b.cast("forest", 850, 1590)).toBe("");
    expect(u.hp).toBeLessThanOrEqual(u.maxHp);
    expect(u.hp).toBeGreaterThan(u.maxHp * 0.95);
  });
  it("emperor produces at most 25 weak children in the shared queue", () => {
    const b = hero("emperor");
    for (let i = 0; i < 35; i++) b.spawn("slime", 850 + i, 1580);
    b.step(0.01);
    expect(b.cast("emperor", 850, 1580)).toBe("");
    expect(b.queued).toBe(25);
  });
  it("summoner allows only two casts in legal deployment areas", () => {
    const b = new Battle(createLoadout("normal", "summon"));
    b.spawn("king", 850, 2060);
    expect(b.cast("king", 850, 1900)).toBe("");
    b.time = 16;
    expect(b.cast("king", 850, 1900)).toBe("");
    b.time = 32;
    expect(b.cast("king", 850, 1900)).not.toBe("");
    expect(b.queued).toBe(60);
  });
  it("movement orders are explicit, charge preserves focus attacks", () => {
    const b = hero("titan"),
      u = b.getUnit("titan")!;
    b.command([u.id], { type: "move", x: 700, y: 2000 });
    expect(u.order?.type).toBe("move");
    b.charge();
    expect(u.order).toBeUndefined();
    b.command([u.id], { type: "attack", target: b.crystal.id });
    b.charge();
    expect(u.order?.type).toBe("attack");
  });
});
describe("V2 siege and forward reinforcements", () => {
  it("the east front also unlocks real paid reinforcement deployment", () => {
    const l = createLoadout();
    purchase(l, "goblin", 1);
    const b = new Battle(l);
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, 99999);
    b.spawn("goblin", 2300, 1360, 0, false, 1);
    b.advance(9);
    expect(b.outposts[1].captured).toBe(true);
    expect(b.canDeploy(2300, 1360)).toBe(true);
    expect(b.deploy("goblin", 2300, 1360)).toBe(true);
  });
  it("contested posts cannot gain progress or accept reinforcements", () => {
    const b = new Battle(createLoadout());
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, 99999);
    b.spawn("slime", 850, 1360, 0, false, -1);
    const enemy = b.spawn("soldier", 860, 1360, 1);
    enemy.root = 99;
    b.advance(9);
    expect(b.outposts[0].progress).toBe(0);
    b.outposts[0].captured = true;
    expect(b.canDeploy(850, 1360)).toBe(false);
  });
  it("finite reserves spawn outside collision and physically march to a defense lane", () => {
    const b = new Battle(createLoadout());
    const firstId = Math.max(...b.units.map((u) => u.id));
    b.time = 57;
    b.step(0.05);
    const reserves = b.units.filter((u) => u.id > firstId);
    expect(reserves).toHaveLength(7);
    expect(reserves.every((u) => !b.nav.obstacleAt(u.x, u.y))).toBe(true);
    const before = reserves.map((u) => ({ x: u.x, y: u.y }));
    b.advance(2);
    expect(reserves.some((u, i) => Math.hypot(u.x - before[i].x, u.y - before[i].y) > 40)).toBe(
      true,
    );
  });
  it("move command holds its destination until the player orders a charge", () => {
    const b = new Battle(createLoadout());
    const u = b.spawn("goblin", 700, 2000);
    b.command([u.id], { type: "move", x: 700, y: 2150 });
    b.advance(6);
    expect(u.order?.type).toBe("move");
    expect(Math.hypot(u.x - 700, u.y - 2150)).toBeLessThan(25);
    const y = u.y;
    b.advance(4);
    expect(u.y).toBeCloseTo(y);
    b.charge();
    expect(u.order).toBeUndefined();
  });
  it("tower artwork can be targeted at its visible upper body", () => {
    const b = new Battle(createLoadout());
    const tower = b.structures.find((s) => s.kind === "arrow")!;
    expect(b.targetAt(tower.x, tower.y - 150)?.id).toBe(tower.id);
  });
  it("wolf cavalry earns a real first charge bonus after running", () => {
    const b = new Battle(createLoadout());
    const u = b.spawn("rider", 800, 2000),
      t = b.spawn("soldier", 800, 2020, 1);
    u.runDistance = 100;
    u.cooldown = 0;
    u.target = t.id;
    u.think = 1;
    t.root = 1;
    b.step(0.05);
    expect(t.hp).toBeCloseTo(t.maxHp - u.damage * u.period * 1.4);
    expect(u.runDistance).toBe(0);
  });
  it("multiple treants cannot multiply a single healing pulse", () => {
    const b = new Battle(createLoadout());
    const u = b.spawn("golem", 800, 2100);
    u.hp = 200;
    for (let i = 0; i < 8; i++) b.spawn("treant", 800 + i, 2100).heal = 0;
    b.step(0.05);
    expect(u.hp).toBeCloseTo(200 + u.maxHp * 0.02);
  });
  it("out of range casting neither spends a use nor starts cooldown", () => {
    const l = createLoadout();
    recruit(l, "titan");
    const b = new Battle(l);
    b.spawn("titan", 850, 2070);
    expect(b.cast("titan", 1550, 1700)).toContain("距离");
    expect(b.uses.size).toBe(0);
    expect(b.readyAt.size).toBe(0);
  });
  it("intact enclosure blocks ground connectivity; real breach opens it", () => {
    const b = new Battle(createLoadout());
    expect(b.outposts[0].connected).toBe(false);
    expect(b.canDeploy(850, 1360)).toBe(false);
    const wall = b.structures.find((s) => s.weak && s.x === 850 && s.y === 1700)!;
    b.damage(wall, 9999);
    b.step(0.05);
    expect(b.outposts[0].connected).toBe(true);
    expect(b.canDeploy(850, 1360)).toBe(false);
  });
  it("ground occupants capture for eight seconds, reward once, then can deploy", () => {
    const l = createLoadout();
    purchase(l, "goblin", 1);
    const b = new Battle(l);
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, 99999);
    b.spawn("goblin", 850, 1360, 0, false, -1);
    const before = b.money;
    for (let i = 0; i < 150; i++) b.step(0.05);
    expect(b.outposts[0].captured).toBe(false);
    for (let i = 0; i < 20; i++) b.step(0.05);
    expect(b.outposts[0].captured).toBe(true);
    expect(b.money).toBe(before + 200);
    expect(b.canDeploy(850, 1360)).toBe(true);
    expect(b.deploy("goblin", 850, 1360, 1)).toBe(true);
    for (let i = 0; i < 100; i++) b.step(0.05);
    expect(b.money).toBe(before + 200);
  });
  it("flying alone cannot capture a forward post", () => {
    const b = new Battle(createLoadout());
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, 99999);
    const u = b.spawn("wyvern", 850, 1360);
    u.order = { type: "move", x: 850, y: 1360 };
    for (let i = 0; i < 200; i++) b.step(0.05);
    expect(b.outposts[0].captured).toBe(false);
  });
  it("golem destroys collision wall and actually crosses the former wall position", () => {
    const b = new Battle(createLoadout());
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures)
      if (!["wall", "gate", "crystal"].includes(s.kind)) b.damage(s, 99999);
    const u = b.spawn("golem", 850, 1770, 0, false, -1);
    for (let i = 0; i < 500; i++) b.step(0.05);
    expect(b.stats.walls).toBeGreaterThan(0);
    expect(u.y).toBeLessThan(1600);
  });
  it("air defense ignores ground units and fires on flyers", () => {
    const b = new Battle(createLoadout());
    for (const u of b.units) u.hp = 0;
    for (const s of b.structures) if (!["crystal", "antiAir"].includes(s.kind)) b.damage(s, 99999);
    b.spawn("golem", 2330, 1650);
    b.events.length = 0;
    b.step(0.05);
    expect(b.events.filter((e) => e.type === "shot" && e.kind === "antiAir")).toHaveLength(0);
    b.spawn("wyvern", 2330, 1630);
    for (let i = 0; i < 50; i++) b.step(0.05);
    expect(b.events.some((e) => e.type === "shot" && e.kind === "antiAir")).toBe(true);
  });
  it("destroyed barracks prevents future reserves; only three waves exist", () => {
    const b = new Battle(createLoadout());
    for (const s of b.structures) if (s.kind === "barracks") b.damage(s, 99999);
    const n = b.units.length;
    b.time = 59;
    b.step(0.05);
    expect(b.units).toHaveLength(n);
    b.time = 110;
    b.step(0.05);
    b.time = 170;
    b.step(0.05);
    b.time = 240;
    b.step(0.05);
    expect(b.reinforcementCount).toBe(3);
  });
});
