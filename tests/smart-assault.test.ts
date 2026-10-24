import { describe, it, expect, vi } from "vitest";
import { Battle } from "../src/v2/simulation";
import { createLoadout, purchase } from "../src/v2/economy";
import { DeploymentStream } from "../src/v2/deployment";
import type { Kind } from "../src/v2/data";
const field = () => {
  const b = new Battle(createLoadout(), undefined, false);
  b.units.forEach((u) => (u.hp = 0));
  for (const s of b.structures) if (s.kind !== "crystal") b.damage(s, s.hp);
  b.advance(0.02);
  return b;
};
// Isolated fixtures use real structure stats/IDs, with only position and remaining health arranged.
const site = (b: Battle, kind: Kind, x: number, y: number) => {
  const s = b.structures.find((s) => s.kind === kind)!;
  s.x = x;
  s.y = y;
  s.hp = 80;
  s.cooldown = 0;
  b.nav.rebuild(b.structures.filter((s) => s.hp > 0));
  return s;
};
const run = (b: Battle, t: number) => {
  b.advance(t);
  b.events.length = 0;
};
describe("3.2 directional assault and self defense", () => {
  it("a clear 300-unit route steers directly rather than building a flow field for each formation slot", () => {
    const b = field(),
      ids = [];
    for (let i = 0; i < 300; i++)
      ids.push(b.spawn("goblin", 900 + (i % 20) * 6, 3300 + Math.floor(i / 20) * 6).id);
    const spy = vi.spyOn(b.nav, "direction");
    b.followRoute(ids, [{ x: 1700, y: 3400 }]);
    run(b, 0.5);
    expect(spy).not.toHaveBeenCalled();
    expect(b.byId.get(ids[0])!.x).toBeGreaterThan(900);
  });
  it("a blocked group route shares its waypoint instead of individual formation path destinations", () => {
    const b = field();
    site(b, "wall", 1280, 3400).hp = 800;
    const ids = Array.from({ length: 80 }, (_, i) => b.spawn("goblin", 950, 3300 + i * 2).id),
      spy = vi.spyOn(b.nav, "direction");
    b.followRoute(ids, [{ x: 1700, y: 3400 }]);
    run(b, 0.1);
    const destinations = new Set(spy.mock.calls.map((a) => `${a[2]},${a[3]}`));
    expect(spy).toHaveBeenCalled();
    expect(destinations.size).toBe(1);
  });
  it("clears civilian and resource buildings well beside the drawn line, then resumes and stops", () => {
    const b = field(),
      civil = site(b, "cityblock", 1100, 3140),
      mine = site(b, "mine", 1470, 3070),
      u = b.spawn("golem", 900, 3400);
    b.followRoute([u.id], [{ x: 1800, y: 3400 }]);
    run(b, 80);
    expect(civil.hp).toBe(0);
    expect(mine.hp).toBe(0);
    expect(u.order?.type).toBe("hold");
    expect(Math.hypot(u.x - 1800, u.y - 3400)).toBeLessThan(22);
  });
  it("arrival does not cancel clearing a nearby building", () => {
    const b = field(),
      s = site(b, "cityblock", 1280, 3200),
      u = b.spawn("elf", 1000, 3400);
    b.followRoute([u.id], [{ x: 1000, y: 3400 }]);
    run(b, 20);
    expect(s.hp).toBe(0);
    expect(u.order?.type).toBe("hold");
  });
  it("actual ranged hits cause a waiting melee squad to close, retaliate and return", () => {
    const b = field(),
      a = b.spawn("golem", 950, 3400),
      ally = b.spawn("golem", 910, 3400),
      e = b.spawn("archer", 1160, 3400, 1);
    run(b, 1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(a.threat?.id).toBe(e.id);
    expect(ally.threat?.id).toBe(e.id);
    run(b, 20);
    expect(e.hp).toBe(0);
    expect(a.order?.type).toBe("hold");
    expect(Math.hypot(a.x - 950, a.y - 3400)).toBeLessThan(20);
  });
  it("tower projectiles retain their attacker identity and trigger real retaliation", () => {
    const b = field(),
      tower = site(b, "arrow", 1120, 3200),
      u = b.spawn("golem", 950, 3400);
    run(b, 1);
    expect(u.threat?.id).toBe(tower.id);
    expect(u.hp).toBeLessThan(u.maxHp);
    run(b, 20);
    expect(tower.hp).toBe(0);
  });
  it("a resource preference never prevents defending against a nearby attacker", () => {
    const b = field(),
      s = site(b, "mine", 1300, 3200),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1150, 3400, 1);
    b.followRoute([u.id], [{ x: 1800, y: 3400 }]);
    b.setPriority([u.id], "resources");
    b.damage(u, 1, e);
    run(b, 0.02);
    expect(u.target).toBe(e.id);
    run(b, 50);
    expect(e.hp).toBe(0);
    expect(s.hp).toBe(0);
    expect(u.order?.type).toBe("hold");
  });
  it("an attacker cannot pull defenders across the entire map", () => {
    const b = field(),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1150, 3400, 1);
    e.root = 100;
    b.damage(u, 1, e);
    e.x = 2500;
    run(b, 0.1);
    expect(u.threat).toBeUndefined();
    expect(u.x).toBe(950);
  });
  it("manual focus has priority over automatic target changes", () => {
    const b = field(),
      s = site(b, "cityblock", 1090, 3350),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1150, 3520, 1);
    e.root = 100;
    b.command([u.id], { type: "attack", target: s.id });
    b.damage(u, 1, e);
    run(b, 0.02);
    expect(u.target).toBe(s.id);
    run(b, 35);
    expect(u.control).toBe("manual");
    expect(s.hp).toBe(0);
  });
  it("finishing a focus does not forget an ongoing local attack", () => {
    const b = field(),
      s = site(b, "cityblock", 1090, 3350),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1150, 3520, 1);
    e.root = 100;
    b.command([u.id], { type: "attack", target: s.id });
    b.damage(u, 1, e);
    b.damage(s, s.hp);
    run(b, 0.02);
    expect(u.threat?.id).toBe(e.id);
    expect(u.target).toBe(e.id);
  });
  it("dead attackers are forgotten without losing the remaining assault route", () => {
    const b = field(),
      u = b.spawn("golem", 950, 3400),
      e = b.spawn("archer", 1150, 3400, 1);
    b.followRoute([u.id], [{ x: 1400, y: 3400 }]);
    b.damage(u, 1, e);
    e.hp = 0;
    run(b, 15);
    expect(u.threat).toBeUndefined();
    expect(u.order?.type).toBe("hold");
    expect(u.x).toBeGreaterThan(1378);
  });
});
describe("3.2 explicit exact-batch deployment", () => {
  it("an ordinary held press commits exactly one configured batch, with plenty of stock left", () => {
    const l = createLoadout();
    purchase(l, "slime", 10);
    const b = new Battle(l),
      s = new DeploymentStream(b);
    s.begin("slime", 1050, 3420, 1, 0);
    for (let t = 0; t < 5000; t += 100) s.tick(t);
    expect(b.queued).toBe(40);
    expect(b.loadout.inventory.slime).toBe(360);
  });
  it("explicit continuous mode waits 600ms, repeats once per 500ms and stops immediately", () => {
    const l = createLoadout();
    purchase(l, "goblin", 10);
    const b = new Battle(l),
      s = new DeploymentStream(b);
    s.begin("goblin", 1050, 3420, 1, 0, true);
    s.tick(599);
    expect(b.queued).toBe(20);
    s.tick(600);
    expect(b.queued).toBe(40);
    s.tick(1099);
    expect(b.queued).toBe(40);
    s.tick(1100);
    expect(b.queued).toBe(60);
    s.end();
    s.tick(10000);
    expect(b.queued).toBe(60);
  });
});
