import { describe, it, expect, vi } from "vitest";
import { Battle } from "../src/v2/simulation";
import { createLoadout, purchase, preset } from "../src/v2/economy";
const run = (b: Battle, t: number) => {
  b.advance(t);
  b.events.length = 0;
};
const empty = () => {
  const b = new Battle(createLoadout());
  b.units.forEach((u) => (u.hp = 0));
  for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, s.hp);
  run(b, 0.02);
  return b;
};
describe("4.0 intelligent legion ownership and commands", () => {
  it("fresh paid deployments automatically fight without any right-click command", () => {
    const l = createLoadout();
    purchase(l, "goblin", 2);
    const b = new Battle(l);
    expect(b.automatic).toBe(true);
    expect(b.legion.command).toBe("sweep");
    b.deploy("goblin", 250, 1800, 1);
    run(b, 4);
    const us = b.units.filter((u) => u.side === 0);
    expect(us).toHaveLength(20);
    expect(us.every((u) => u.control === "auto" && u.autoGoal)).toBe(true);
    expect(us.some((u) => Math.hypot(u.x - 250, u.y - 1800) > 110)).toBe(true);
    expect(b.loadout.inventory.goblin).toBe(20);
  });
  it("manual mode keeps fresh deployments waiting and re-enabling does not overwrite a manual route", () => {
    const b = empty();
    b.setAutomatic(false);
    const a = b.spawn("goblin", 950, 3400),
      c = b.spawn("wolf", 900, 3400);
    run(b, 2);
    expect(a.x).toBe(950);
    expect(a.control).toBe("idle");
    b.followRoute([a.id], [{ x: 1300, y: 3400 }]);
    const route = a.route;
    b.setAutomatic(true);
    run(b, 0.3);
    expect(a.control).toBe("manual");
    expect(a.route).toBe(route);
    expect(c.control).toBe("auto");
  });
  it("whole-army orders preserve independently assigned routes, holds and focus targets", () => {
    const b = empty(),
      a = b.spawn("goblin", 950, 3400),
      c = b.spawn("golem", 900, 3400),
      d = b.spawn("elf", 1000, 3400);
    b.followRoute([a.id], [{ x: 1300, y: 3400 }]);
    b.halt([c.id]);
    b.command([d.id], { type: "attack", target: b.crystal.id });
    const orders = [a.order, c.order, d.order].map((o) => structuredClone(o));
    expect(b.issueLegion("assault")).toBe("");
    run(b, 0.1);
    expect([a.order, c.order, d.order]).toEqual(orders);
    expect([a, c, d].every((u) => u.control === "manual")).toBe(true);
  });
  it("selected-unit command changes only that selection; explicit resume returns it to global AI", () => {
    const b = empty(),
      a = b.spawn("goblin", 950, 3400),
      c = b.spawn("goblin", 900, 3400);
    b.halt([a.id, c.id]);
    expect(b.issueLegion("loot", [a.id])).toBe("");
    run(b, 0.1);
    expect(a.control).toBe("auto");
    expect(a.tactic).toBe("loot");
    expect(c.control).toBe("manual");
    expect(b.legion.command).toBe("sweep");
    b.resumeAutomatic([a.id]);
    expect(a.tactic).toBeUndefined();
  });
  it("invalid or unsafe rally points do not discard existing tasks", () => {
    const b = new Battle(preset("normal", "evolve")),
      u = b.spawn("goblin", 250, 900);
    b.followRoute([u.id], [{ x: 300, y: 1200 }]);
    const order = structuredClone(u.order);
    expect(b.issueLegion("rally", [u.id], { x: 2000, y: 1800 })).not.toBe("");
    expect(u.order).toEqual(order);
  });
  it("rally cannot route through a complete wall or teleport disconnected troops", () => {
    const b = new Battle(createLoadout()),
      u = b.spawn("golem", 2000, 1900),
      p = { x: 250, y: 900 };
    expect(b.issueLegion("rally", undefined, p)).toBe("");
    run(b, 4);
    expect(u.autoGoal?.blocked).toBe(true);
    expect(Math.hypot(u.x - 2000, u.y - 1900)).toBeLessThan(5);
  });
  it("a safe rally really gathers units coming from several directions", () => {
    const b = empty(),
      a = b.spawn("wolf", 900, 3400),
      c = b.spawn("wolf", 1800, 3400),
      d = b.spawn("wolf", 1400, 3250),
      p = { x: 1300, y: 3400 };
    // Three ground allies establish control of a cleared location.
    expect(b.issueLegion("rally", undefined, p)).toBe("");
    run(b, 12);
    expect([a, c, d].every((u) => Math.hypot(u.x - p.x, u.y - p.y) < 175)).toBe(true);
  });
  it("strategic planning neither spends money nor releases active skills or summons", () => {
    const b = new Battle(preset("normal", "evolve"));
    b.deployAll(250, 1800);
    const money = b.money,
      stock = structuredClone(b.loadout.inventory);
    run(b, 20);
    expect(b.money).toBeGreaterThanOrEqual(money);
    expect(b.loadout.inventory).toEqual(stock);
    expect(b.stats.skills).toBe(0);
    expect(b.stats.spells).toBe(0);
    expect(b.stats.deployed).toBeLessThanOrEqual(300);
  });
  it("resource raiders choose reachable real resources instead of jumping intact walls", () => {
    const b = new Battle(createLoadout()),
      u = b.spawn("raider", 250, 1200);
    run(b, 0.1);
    expect(u.autoGoal?.kind).toBe("raid");
    const site = b.byId.get(u.autoGoal!.target)!;
    expect("resource" in site && site.resource).toBe(true);
    expect(b.legion.groundApproach(site as never, u)).toBeDefined();
    run(b, 40);
    expect(b.stats.resourceIncome).toBeGreaterThan(0);
  });
  it("golems receive a real breach target and advance after destroying the barrier", () => {
    const b = new Battle(preset("easy", "evolve"));
    b.units.forEach((u) => (u.hp = 0));
    const us = Array.from({ length: 12 }, (_, i) => b.spawn("golem", 300, 1700 + i * 8));
    run(b, 0.1);
    expect(us.some((u) => u.autoGoal?.kind === "breach")).toBe(true);
    const targets = new Set(us.map((u) => u.autoGoal!.target));
    run(b, 35);
    expect([...targets].some((id) => b.byId.get(id)!.hp === 0)).toBe(true);
    expect(us.some((u) => u.x > 650)).toBe(true);
  });
  it("an opened neighboring gap replaces an unnecessary intact-wall objective", () => {
    const b = new Battle(createLoadout()),
      u = b.spawn("golem", 250, 1800);
    run(b, 0.1);
    const old = b.byId.get(u.autoGoal!.target)!;
    const gap = b.structures.find(
      (s) =>
        s.kind === "wall" &&
        s.district === "outer" &&
        s.front === "west" &&
        s.id !== old.id &&
        Math.hypot(s.x - old.x, s.y - old.y) < 350,
    )!;
    b.damage(gap, gap.hp);
    b.legion.invalidate();
    run(b, 1.1);
    expect(u.autoGoal?.target).not.toBe(old.id);
    expect(old.hp).toBeGreaterThan(0);
  });
  it("elf target choice favors a nearby enemy cluster and never casts its active skill", () => {
    const b = empty(),
      elf = b.spawn("elf", 1000, 3400);
    const solo = b.spawn("archer", 1150, 3400, 1);
    solo.root = 100;
    const dense = Array.from({ length: 5 }, (_, i) => b.spawn("soldier", 1210 + i * 5, 3300, 1));
    dense.forEach((e) => (e.root = 100));
    run(b, 0.02);
    expect(dense.some((e) => e.id === elf.target)).toBe(true);
    expect(b.stats.skills).toBe(0);
  });
  it("unsupported flyers choose a target outside anti-air coverage rather than rushing the crystal", () => {
    const b = new Battle(createLoadout()),
      u = b.spawn("wyvern", 3750, 1800);
    b.issueLegion("assault");
    run(b, 0.1);
    expect(u.autoGoal?.target).not.toBe(b.crystal.id);
    for (const s of b.structures.filter((s) => s.hp > 0 && s.kind === "antiAir"))
      expect(Math.hypot(s.x - u.autoGoal!.x, s.y - u.autoGoal!.y)).toBeGreaterThan(460);
    b.advance(5);
    expect(
      b.events.filter((e) => e.type === "shot" && e.kind === "antiAir" && e.target === u.id),
    ).toHaveLength(0);
    expect(b.units.filter((v) => v.side === 0 && v.hp > 0)).toHaveLength(1);
  });
  it("unsupported flyers wait when the only valuable target is protected by anti-air", () => {
    const b = empty(),
      aa = b.structures.find((s) => s.kind === "antiAir")!;
    aa.x = 1300;
    aa.y = 3300;
    aa.hp = 720;
    const u = b.spawn("wyvern", 1800, 3400);
    b.issueLegion("assault");
    run(b, 0.1);
    expect(u.autoGoal?.kind).toBe("air-cover");
    expect(u.autoGoal?.target).toBe(0);
    expect(b.legion.advice).toContain("防空");
  });
  it("strategic scans are throttled and component/path data are shared", () => {
    const b = empty();
    for (let i = 0; i < 300; i++)
      b.spawn("goblin", 900 + (i % 20) * 5, 3300 + Math.floor(i / 20) * 5);
    const spy = vi.spyOn(b.legion, "update");
    run(b, 2);
    expect(spy).toHaveBeenCalled();
    expect(b.legion.metrics.updates).toBeLessThanOrEqual(4);
    expect(b.nav.metrics.componentBuilds).toBeLessThanOrEqual(3);
  });
  it("continuous summoning does not restart a whole-map planning pass for every new unit", () => {
    const l = createLoadout();
    purchase(l, "slime", Infinity);
    const b = new Battle(l);
    b.deploy("slime", 1050, 3430, Infinity);
    run(b, 5);
    expect(b.active).toBe(300);
    expect(b.legion.metrics.updates).toBeLessThanOrEqual(7);
    expect(b.units.filter((u) => u.side === 0).every((u) => u.autoGoal)).toBe(true);
  });
  it("four-front rally crosses real fortress corners without breaking walls or leaving a squad behind", () => {
    const l = createLoadout();
    purchase(l, "wolf", 6);
    const b = new Battle(l);
    for (const [x, y] of [
      [250, 850],
      [3750, 850],
      [1100, 230],
      [1050, 3430],
    ]) {
      b.deploy("wolf", x, y, 1);
      run(b, 0.1);
    }
    run(b, 0.6);
    expect(b.issueLegion("rally", undefined, { x: 250, y: 900 })).toBe("");
    run(b, 105);
    const units = b.units.filter((u) => u.side === 0 && u.hp > 0);
    expect(units).toHaveLength(48);
    expect(units.every((u) => Math.hypot(u.x - 250, u.y - 900) < 205)).toBe(true);
    expect(b.stats.walls).toBe(0);
  });
  it("an unsupported flyer uses a safe aerial rally corridor instead of crossing the anti-air district", () => {
    const b = new Battle(createLoadout()),
      u = b.spawn("wyvern", 3750, 850);
    expect(b.issueLegion("rally", undefined, { x: 250, y: 900 })).toBe("");
    run(b, 80);
    expect(Math.hypot(u.x - 250, u.y - 900)).toBeLessThan(205);
    expect(u.hp).toBe(u.maxHp);
    expect(b.stats.walls).toBe(0);
  });
  it("wolves favor nearby fragile back-line units over a heavy knight", () => {
    const b = empty(),
      u = b.spawn("wolf", 1000, 3400),
      tank = b.spawn("knight", 1150, 3400, 1),
      archer = b.spawn("archer", 1250, 3400, 1);
    tank.root = 100;
    archer.root = 100;
    run(b, 0.02);
    expect(u.target).toBe(archer.id);
  });
  it("tree guards follow a wounded main-line unit and provide actual passive healing", () => {
    const b = empty(),
      tank = b.spawn("golem", 1200, 3400),
      tree = b.spawn("treant", 850, 3400);
    b.halt([tank.id]);
    tank.hp = tank.maxHp * 0.5;
    const hp = tank.hp;
    run(b, 18);
    expect(tree.autoGoal?.kind).toBe("escort");
    expect(Math.hypot(tree.x - tank.x, tree.y - tank.y)).toBeLessThan(110);
    expect(tank.hp).toBeGreaterThan(hp);
  });
});
