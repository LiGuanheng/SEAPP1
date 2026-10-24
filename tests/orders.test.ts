import { describe, it, expect } from "vitest";
import { Battle } from "../src/v2/simulation";
import { createLoadout, purchase } from "../src/v2/economy";
import { routePoints } from "../src/v2/orders";
import { towerRange } from "../src/v2/world";
const clean = () => {
  const b = new Battle(createLoadout());
  b.units.forEach((u) => (u.hp = 0));
  for (const s of b.structures)
    if (["arrow", "cannon", "antiAir", "holy"].includes(s.kind)) b.damage(s, s.hp);
  return b;
};
const quiet = () => {
  const b = clean();
  for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, s.hp);
  return b;
};
const run = (b: Battle, n: number) => {
  b.advance(n);
  b.events.length = 0;
};
describe("3.1 tactical routes and waiting orders", () => {
  it("a guardian body can be focused in front of a tall crystal without losing building selection", () => {
    const b = clean(),
      g = b.spawn("captain", 1950, 1760, 1);
    expect(b.targetAt(g.x, g.y)?.id).toBe(g.id);
    expect(b.targetAt(2000, 1540)?.id).toBe(b.crystal.id);
    g.hp = 0;
    expect(b.targetAt(g.x, g.y)?.id).toBe(b.crystal.id);
  });
  it("long appended routes discard completed history and retain the newest destination", () => {
    const b = clean(),
      u = b.spawn("goblin", 950, 3400);
    b.followRoute(
      [u.id],
      [
        { x: 1000, y: 3400 },
        { x: 1100, y: 3400 },
      ],
    );
    run(b, 1.5);
    for (let i = 0; i < 60; i++)
      b.followRoute([u.id], [{ x: 1200 + i * 10, y: 3300 + (i % 2) * 40 }], true);
    expect(u.route!.points.length).toBeLessThanOrEqual(48);
    expect(u.route!.points.at(-1)).toEqual({ x: 1790, y: 3340 });
    expect(u.route!.index).toBe(0);
  });
  it("new paid troops remain at their deployment locations until commanded", () => {
    const l = createLoadout();
    purchase(l, "goblin", 1);
    const b = new Battle(l);
    b.deploy("goblin", 1050, 3420);
    run(b, 1);
    const poses = b
      .members(b.units.filter((u) => u.side === 0).map((u) => u.id))
      .map((u) => ({ id: u.id, x: u.x, y: u.y }));
    run(b, 3);
    for (const p of poses) {
      const u = b.byId.get(p.id)!;
      expect(u.x).toBe(p.x);
      expect(u.y).toBe(p.y);
      expect("order" in u && u.order?.type).toBe("hold");
    }
  });
  it("a drawn route preserves bends, filters invalid points and retains the final destination", () => {
    const path = routePoints([
      { x: 900, y: 3400 },
      { x: 1000, y: 3400 },
      { x: 1200, y: 3400 },
      { x: 1200, y: 3200 },
      { x: NaN, y: 2 },
      { x: 1300, y: 3200 },
    ]);
    expect(path).toEqual([
      { x: 900, y: 3400 },
      { x: 1200, y: 3400 },
      { x: 1200, y: 3200 },
      { x: 1300, y: 3200 },
    ]);
  });
  it("troops visit route bends and stop at the final destination", () => {
    const b = quiet(),
      u = b.spawn("goblin", 950, 3400);
    b.followRoute(
      [u.id],
      [
        { x: 1100, y: 3400 },
        { x: 1100, y: 3250 },
        { x: 1300, y: 3250 },
      ],
    );
    let corner = false;
    for (let i = 0; i < 200; i++) {
      run(b, 0.1);
      if (u.x > 1070 && u.y > 3360) corner = true;
    }
    expect(corner).toBe(true);
    expect(u.order?.type).toBe("hold");
    expect(Math.hypot(u.x - 1300, u.y - 3250)).toBeLessThan(22);
    const p = { x: u.x, y: u.y };
    run(b, 4);
    expect({ x: u.x, y: u.y }).toEqual(p);
  });
  it("Shift-style appending keeps the current path and adds a later point", () => {
    const b = quiet(),
      u = b.spawn("goblin", 950, 3400);
    b.followRoute([u.id], [{ x: 1100, y: 3400 }]);
    run(b, 0.5);
    b.followRoute([u.id], [{ x: 1300, y: 3400 }], true);
    expect(u.route!.points).toHaveLength(2);
    run(b, 10);
    expect(u.order?.type).toBe("hold");
    expect(u.x).toBeGreaterThan(1275);
  });
  it("marching troops kill nearby targets then resume the same route", () => {
    const b = quiet(),
      u = b.spawn("goblin", 950, 3400),
      e = b.spawn("archer", 1070, 3420, 1);
    e.root = 100;
    b.followRoute([u.id], [{ x: 1320, y: 3400 }]);
    run(b, 30);
    expect(e.hp).toBe(0);
    expect(u.hp).toBeGreaterThan(0);
    expect(u.order?.type).toBe("hold");
    expect(Math.hypot(u.x - 1320, u.y - 3400)).toBeLessThan(22);
  });
  it("off-route targets do not drag a marching group away", () => {
    const b = quiet(),
      u = b.spawn("goblin", 950, 3400),
      e = b.spawn("archer", 1110, 2550, 1);
    e.root = 100;
    b.followRoute([u.id], [{ x: 1320, y: 3400 }]);
    run(b, 8);
    expect(e.hp).toBe(e.maxHp);
    expect(u.order?.type).toBe("hold");
    expect(Math.abs(u.y - 3400)).toBeLessThan(22);
  });
  it("a waiting melee troop does not chase a distant archer", () => {
    const b = clean(),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1100, 3400, 1);
    e.root = 100;
    run(b, 4);
    expect(u.x).toBe(950);
    expect(e.hp).toBe(e.maxHp);
  });
  it("stop cancels route and stale attacks immediately", () => {
    const b = clean(),
      u = b.spawn("goblin", 950, 3400);
    b.followRoute([u.id], [{ x: 1320, y: 3400 }]);
    run(b, 1);
    b.halt([u.id]);
    const p = { x: u.x, y: u.y };
    run(b, 4);
    expect({ x: u.x, y: u.y }).toEqual(p);
    expect(u.route).toBeUndefined();
  });
  it("a killed focus target leaves the squad waiting, not automatically attacking the city", () => {
    const b = clean(),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 980, 3400, 1);
    e.hp = 1;
    e.root = 100;
    b.command([u.id], { type: "attack", target: e.id });
    run(b, 2);
    expect(e.hp).toBe(0);
    expect(u.order?.type).toBe("hold");
    const p = { x: u.x, y: u.y };
    run(b, 4);
    expect({ x: u.x, y: u.y }).toEqual(p);
  });
  it("explicit auto assault applies to pending summons but subsequent deployments still wait", () => {
    const l = createLoadout();
    purchase(l, "goblin", 2);
    const b = new Battle(l);
    b.deploy("goblin", 1050, 3420, 1);
    b.charge();
    run(b, 1);
    expect(b.units.find((u) => u.side === 0)?.order).toBeUndefined();
    b.deploy("goblin", 1050, 3420, 1);
    run(b, 1);
    expect(b.units.filter((u) => u.side === 0 && u.order?.type === "hold")).toHaveLength(20);
  });
  it("priority changes really select resources versus guards and cancel an old windup", () => {
    const b = clean(),
      u = b.spawn("elf", 1300, 3350),
      e = b.spawn("archer", 1350, 3150, 1),
      s = b.structures.find((s) => s.kind === "supply" && s.x === 1500)!;
    e.root = 100;
    b.setPriority([u.id], "resources");
    run(b, 0.02);
    expect(u.target).toBe(s.id);
    b.setPriority([u.id], "troops");
    run(b, 0.02);
    expect(u.target).toBe(e.id);
  });
  it("type selection includes deployed units only, with append support", () => {
    const b = clean(),
      a = b.spawn("goblin", 950, 3400),
      c = b.spawn("wolf", 980, 3400);
    b.selectKind("goblin");
    expect([...b.selected]).toEqual([a.id]);
    b.selectKind("wolf", true);
    expect(b.selected.size).toBe(2);
    b.selectKind("slime");
    expect(b.selected.size).toBe(0);
    expect(c.hp).toBeGreaterThan(0);
  });
});
describe("3.1 imperial depth and resource economy", () => {
  it("central guard is a distinct strong guardian with elite support", () => {
    const b = new Battle(createLoadout("hard"));
    const g = b.units.find((u) => u.kind === "captain")!;
    expect(g.name).toBe("日轮守护骑士");
    expect(g.maxHp).toBe(4000);
    expect(g.size).toBe(125);
    expect(
      b.units.filter(
        (u) => u.side === 1 && u.homeX > 1600 && u.homeX < 2400 && u.homeY > 1450 && u.homeY < 2150,
      ).length,
    ).toBeGreaterThanOrEqual(19);
  });
  it("guardian shockwave and shield have real combat effects", () => {
    const b = clean(),
      g = b.spawn("captain", 950, 3400, 1),
      u = b.spawn("golem", 1020, 3400);
    g.sacredCooldown = 0;
    run(b, 0.02);
    expect(b.stats.guardianBursts).toBe(1);
    expect(u.hp).toBeLessThan(u.maxHp);
    expect(u.root).toBeGreaterThan(0);
    const hp = g.hp;
    b.damage(g, 100);
    expect(hp - g.hp).toBe(50);
  });
  it("tower ranges cover local approaches but not the far side of the city", () => {
    const b = new Battle(createLoadout("hard"));
    expect(b.structures.filter((s) => s.kind === "cannon").every((s) => towerRange(s) >= 500)).toBe(
      true,
    );
    const inner = b.structures.find((s) => s.kind === "cannon" && s.district === "inner")!;
    expect(towerRange(inner)).toBeLessThan(600);
  });
  it("core and inner defense still cannot attack a fresh outer assembly point", () => {
    const b = new Battle(createLoadout("hard"));
    b.units.forEach((u) => (u.hp = 0));
    const u = b.spawn("golem", 250, 1800);
    run(b, 2);
    expect(b.stats.towerShots.inner + b.stats.towerShots.core).toBe(0);
    expect(u.hp).toBe(u.maxHp);
  });
  it("large one-front pressure draws real soldiers from quiet flanks without spawning or teleporting", () => {
    const b = new Battle(createLoadout("hard")),
      initial = b.units.filter((u) => u.side === 1).length;
    for (let i = 0; i < 20; i++)
      b.spawn("golem", 300 + (i % 4) * 20, 1800 + Math.floor(i / 4) * 20);
    run(b, 8.2);
    expect(b.stats.reliefTransfers).toBeGreaterThan(0);
    expect(b.units.filter((u) => u.side === 1)).toHaveLength(initial);
    expect(b.units.some((u) => u.side === 1 && u.rally && u.rally.length >= 3)).toBe(true);
  });
  it("outer raiding is economically meaningful and still only pays once", () => {
    const b = clean(),
      s = b.structures.find((s) => s.kind === "mine")!,
      u = b.spawn("raider", s.x - 100, s.y),
      m = b.money;
    b.damage(s, s.hp, u);
    expect(b.money - m).toBe(590);
    expect(b.stats.lootSites).toBe(1);
    b.damage(s, 9999, u);
    expect(b.money - m).toBe(590);
  });
});
