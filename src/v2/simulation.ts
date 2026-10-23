import {
  ARMIES,
  ARMY_KEYS,
  COMMANDERS,
  DIFFICULTIES,
  ENEMIES,
  KING,
  SPECS,
  WORLD,
  isArmy,
  isCommander,
  type Army,
  type Kind,
  type Stats,
} from "./data";
import { batchPrice, purchase, unlocked, type Loadout } from "./economy";
import { Navigation, type Point } from "./navigation";
import { createStructures, OUTPOSTS, type Structure } from "./world";
export type Order =
  { type: "move"; x: number; y: number } | { type: "attack"; target: number };
export interface Unit extends Stats {
  id: number;
  kind: Kind;
  side: 0 | 1;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  maxHp: number;
  hp: number;
  cooldown: number;
  think: number;
  target: number;
  order?: Order;
  lane: number;
  facing: number;
  moving: boolean;
  hit: number;
  attack: number;
  root: number;
  buff: number;
  hunt: number;
  poison: number;
  heal: number;
  healedAt: number;
  runDistance: number;
  small: boolean;
  splitDone: boolean;
  deadAt: number;
}
export interface Event {
  type: string;
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  kind?: Kind;
  side?: number;
  radius?: number;
  angle?: number;
  text?: string;
  target?: number;
}
interface Queue {
  kind: Kind;
  count: number;
  x: number;
  y: number;
  small: boolean;
  lane: number;
}
interface Projectile {
  x: number;
  y: number;
  target: number;
  side: 0 | 1;
  damage: number;
  splash: number;
  time: number;
  kind: Kind;
}
type Target = Unit | Structure;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const isStructure = (t: Target): t is Structure => "w" in t;
class Spatial {
  private cells = new Map<string, Unit[]>();
  rebuild(units: Unit[]) {
    this.cells.clear();
    for (const u of units) {
      if (u.hp <= 0) continue;
      const key = `${Math.floor(u.x / 180)},${Math.floor(u.y / 180)}`;
      const b = this.cells.get(key);
      if (b) b.push(u);
      else this.cells.set(key, [u]);
    }
  }
  near(x: number, y: number, r: number): Unit[] {
    const a: Unit[] = [];
    for (
      let iy = Math.floor((y - r) / 180);
      iy <= Math.floor((y + r) / 180);
      iy++
    )
      for (
        let ix = Math.floor((x - r) / 180);
        ix <= Math.floor((x + r) / 180);
        ix++
      ) {
        const b = this.cells.get(`${ix},${iy}`);
        if (b)
          for (const u of b)
            if (u.hp > 0 && (u.x - x) ** 2 + (u.y - y) ** 2 <= r * r) a.push(u);
      }
    return a;
  }
}
export class Battle {
  readonly loadout: Loadout;
  readonly structures: Structure[];
  readonly units: Unit[] = [];
  readonly queue: Queue[] = [];
  readonly events: Event[] = [];
  readonly outposts = structuredClone(OUTPOSTS);
  readonly nav = new Navigation();
  readonly stats = {
    deployed: 0,
    kills: 0,
    lost: 0,
    income: 0,
    walls: 0,
    skills: 0,
    peak: 0,
  };
  readonly heroInventory = new Set<Kind>();
  readonly readyAt = new Map<Kind, number>();
  readonly uses = new Map<Kind, number>();
  readonly byId = new Map<number, Target>();
  private spatial = new Spatial();
  private nextId = 1000;
  private rngState: number;
  private spawnClock = 0;
  private captureClock = 0;
  private reinforcementWave = 0;
  private navDirty = false;
  time = 0;
  paused = false;
  speed = 1;
  status: "battle" | "victory" | "defeat" = "battle";
  reason = "";
  seed: number;
  selected = new Set<number>();
  groups = [new Set<number>(), new Set<number>(), new Set<number>()];
  constructor(loadout: Loadout, seed = 20261024) {
    this.loadout = structuredClone(loadout);
    this.seed = seed;
    this.rngState = seed;
    this.structures = createStructures(loadout.difficulty);
    for (const s of this.structures) this.byId.set(s.id, s);
    this.heroInventory.add("king");
    for (const c of loadout.commanders) this.heroInventory.add(c);
    this.refreshNav();
    this.createDefenders();
  }
  random() {
    this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }
  get money() {
    return this.loadout.money;
  }
  get remaining() {
    return Math.max(
      0,
      DIFFICULTIES[this.loadout.difficulty].seconds - this.time,
    );
  }
  get crystal() {
    return this.structures.find((s) => s.kind === "crystal")!;
  }
  get active() {
    return this.units.filter((u) => u.side === 0 && u.hp > 0).length;
  }
  get queued() {
    return this.queue.reduce((s, q) => s + q.count, 0);
  }
  get reserves() {
    return (
      ARMY_KEYS.reduce(
        (s, k) => s + this.loadout.inventory[k],
        this.heroInventory.size,
      ) + this.queued
    );
  }
  get living() {
    return this.units.filter((u) => u.hp > 0);
  }
  getUnit(k: Kind) {
    return this.units.find((u) => u.kind === k && u.side === 0 && u.hp > 0);
  }
  private createDefenders() {
    const density = DIFFICULTIES[this.loadout.difficulty].density;
    const positions: [[number, number], Kind, number][] = [
      [[850, 1570], "soldier", 9],
      [[850, 1420], "archer", 7],
      [[1570, 1630], "knight", 8],
      [[1600, 1490], "mage", 5],
      [[2320, 1570], "soldier", 9],
      [[2350, 1420], "archer", 8],
      [[1300, 1250], "paladin", 5],
      [[1900, 1240], "paladin", 5],
      [[1510, 900], "mage", 4],
      [[1710, 1030], "archer", 6],
    ];
    for (const [[x, y], kind, n] of positions)
      for (let i = 0; i < Math.round(n * density); i++)
        this.spawn(
          kind,
          x + (this.random() - 0.5) * 180,
          y + (this.random() - 0.5) * 100,
          1,
        );
    this.spawn("captain", 1600, 1130, 1);
    this.spatial.rebuild(this.units);
  }
  private refreshNav() {
    this.nav.rebuild(this.structures.filter((s) => s.hp > 0));
    this.navDirty = false;
    for (const p of this.outposts)
      p.connected = this.nav.connected({ x: p.x, y: 2070 }, p);
  }
  spawn(
    kind: Kind,
    x: number,
    y: number,
    side: 0 | 1 = 0,
    small = false,
    lane = 0,
  ): Unit {
    const base: Stats = isArmy(kind)
      ? ARMIES[kind]
      : isCommander(kind)
        ? COMMANDERS[kind].stats
        : kind === "king"
          ? KING
          : ENEMIES[kind]!;
    if (!base) throw new Error(`Invalid unit ${kind}`);
    const evo =
      side === 0 &&
      this.loadout.spec === "evolve" &&
      isArmy(kind) &&
      ARMIES[kind].commander
        ? 1.1
        : 1;
    const elemental =
      side === 0 && this.loadout.spec === "element" && base.range > 80
        ? 1.1
        : 1;
    const hp = base.hp * evo * (small ? 0.32 : 1);
    const u: Unit = {
      ...base,
      hp,
      maxHp: hp,
      damage: base.damage * evo * elemental * (small ? 0.4 : 1),
      size: base.size * (small ? 0.68 : 1),
      kind,
      id: this.nextId++,
      side,
      x,
      y,
      homeX: x,
      homeY: y,
      cooldown: this.random() * 0.6,
      think: 0,
      target: 0,
      lane,
      facing: -1,
      moving: false,
      hit: 0,
      attack: 0,
      root: 0,
      buff: 0,
      hunt: 0,
      poison: 0,
      heal: 4,
      healedAt: -100,
      runDistance: 0,
      small,
      splitDone: small,
      deadAt: 0,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    if (side === 0) this.stats.deployed++;
    return u;
  }
  canDeploy(x: number, y: number): boolean {
    if (
      x < 0 ||
      x > WORLD.width ||
      y < 0 ||
      y > WORLD.height ||
      distance({ x, y }, WORLD.crystal) < 300 ||
      this.nav.obstacleAt(x, y)
    )
      return false;
    if (
      y >= 1870 &&
      y <= 2270 &&
      ((x >= 550 && x <= 1120) ||
        (x >= 1270 && x <= 1910) ||
        (x >= 2100 && x <= 2660))
    )
      return true;
    return this.outposts.some(
      (p) =>
        p.captured &&
        p.connected &&
        !p.contested &&
        Math.abs(x - p.x) <= p.w / 2 &&
        Math.abs(y - p.y) <= p.h / 2 &&
        !this.units.some(
          (u) => u.side === 1 && u.hp > 0 && distance(u, { x, y }) < 80,
        ),
    );
  }
  deploy(kind: Kind, x: number, y: number, batches: number = 1): boolean {
    if (this.status !== "battle" || !this.canDeploy(x, y)) return false;
    let count = 0;
    if (isArmy(kind)) {
      if (!unlocked(this.loadout, kind)) return false;
      count = Math.min(
        this.loadout.inventory[kind],
        batches === Infinity
          ? Infinity
          : Math.max(0, Math.floor(batches)) * ARMIES[kind].batch,
      );
      if (!count) return false;
      this.loadout.inventory[kind] -= count;
    } else {
      if (!this.heroInventory.has(kind)) return false;
      count = 1;
      this.heroInventory.delete(kind);
    }
    this.queue.push({
      kind,
      count,
      x,
      y,
      small: false,
      lane: x < 1200 ? -1 : x > 2000 ? 1 : 0,
    });
    this.events.push({ type: "deploy", x, y, kind, radius: 70 });
    return true;
  }
  deployAll(x: number, y: number) {
    if (!this.canDeploy(x, y)) return false;
    for (const k of [...this.heroInventory]) this.deploy(k, x, y);
    for (const k of ARMY_KEYS) this.deploy(k, x, y, Infinity);
    return true;
  }
  buy(k: Army, n: number) {
    if (this.status !== "battle") return 0;
    return purchase(this.loadout, k, n);
  }
  command(ids: Iterable<number>, order: Order) {
    for (const id of ids) {
      const u = this.byId.get(id);
      if (u && !isStructure(u) && u.side === 0 && u.hp > 0) {
        u.order = { ...order };
        u.target = order.type === "attack" ? order.target : 0;
        u.think = 0;
      }
    }
  }
  charge() {
    for (const u of this.units)
      if (u.side === 0 && u.hp > 0 && u.order?.type !== "attack") {
        u.order = undefined;
        u.target = 0;
        u.think = 0;
      }
  }
  select(x1: number, y1: number, x2: number, y2: number, append = false) {
    if (!append) this.selected.clear();
    for (const u of this.units)
      if (
        u.hp > 0 &&
        u.side === 0 &&
        u.x >= Math.min(x1, x2) &&
        u.x <= Math.max(x1, x2) &&
        u.y >= Math.min(y1, y2) &&
        u.y <= Math.max(y1, y2)
      )
        this.selected.add(u.id);
  }
  targetAt(x: number, y: number): Target | undefined {
    const visible = [
      ...this.structures,
      ...this.units.filter((u) => u.side === 1),
    ]
      .filter((t) => t.hp > 0)
      .sort((a, b) => b.y - a.y);
    for (const t of visible) {
      if (isStructure(t) && !["wall", "gate"].includes(t.kind)) {
        const half =
          t.kind === "crystal" ? 130 : t.kind === "barracks" ? 100 : 65;
        const height =
          t.kind === "crystal"
            ? 280
            : t.kind === "barracks"
              ? 165
              : t.kind === "cannon"
                ? 140
                : 205;
        if (Math.abs(x - t.x) < half && y > t.y - height && y < t.y + 24)
          return t;
      }
    }
    let best: Target | undefined,
      dist = 65;
    for (const t of [
      ...this.structures,
      ...this.units.filter((u) => u.side === 1),
    ]) {
      if (t.hp <= 0) continue;
      const d =
        distance(t, { x, y }) -
        (isStructure(t) ? Math.max(t.w, t.h) / 2 : t.size / 2);
      if (d < dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  }
  private reward(n: number) {
    this.loadout.money += n;
    this.stats.income += n;
  }
  damage(target: Target, amount: number, source?: Unit) {
    if (target.hp <= 0) return;
    target.hp -= amount;
    if (!isStructure(target)) target.hit = 0.16;
    if (target.hp > 0) return;
    target.hp = 0;
    if (isStructure(target)) {
      if (!target.paid) {
        this.reward(target.reward);
        target.paid = true;
      }
      this.navDirty = true;
      if (target.kind === "wall" || target.kind === "gate") {
        this.stats.walls++;
        this.events.push({
          type: "wall",
          x: target.x,
          y: target.y,
          radius: 75,
        });
      } else
        this.events.push({
          type: "destroy",
          x: target.x,
          y: target.y,
          kind: target.kind,
          radius: 100,
        });
    } else {
      target.deadAt = this.time;
      this.events.push({
        type: "death",
        x: target.x,
        y: target.y,
        kind: target.kind,
        side: target.side,
      });
      this.selected.delete(target.id);
      if (target.side === 1) {
        this.stats.kills++;
        this.reward(
          ["paladin", "knight", "captain"].includes(target.kind) ? 4 : 1,
        );
      } else {
        this.stats.lost++;
        if (target.kind === "split" && !target.splitDone) {
          target.splitDone = true;
          this.queue.push({
            kind: "slime",
            count: 1,
            x: target.x,
            y: target.y,
            small: true,
            lane: target.lane,
          });
        }
      }
    }
    if (source?.kind === "spider" && !isStructure(target) && target.hp > 0)
      target.poison = 3;
  }
  private hit(u: Unit, t: Target) {
    let damage =
      u.damage * u.period * (u.buff > 0 ? 1.2 : 1) * (u.hunt > 0 ? 1.15 : 1);
    if ((u.kind === "rider" || u.kind === "moon") && u.runDistance >= 80) {
      damage *= 1.4;
      this.events.push({
        type: "impact",
        x: t.x,
        y: t.y,
        kind: u.kind,
        radius: 45,
      });
    }
    u.runDistance = 0;
    if (isStructure(t) && (t.kind === "wall" || t.kind === "gate"))
      damage *= u.wallBonus ?? 1;
    if (
      ["knight", "paladin"].includes(u.kind) &&
      ["wolf", "rider"].includes(t.kind)
    )
      damage *= 1.5;
    u.cooldown = u.period;
    u.attack = 0.26;
    this.events.push({
      type: u.range > 80 ? "shot" : "hit",
      x: u.x,
      y: u.y,
      tx: t.x,
      ty: t.y,
      kind: u.kind,
      side: u.side,
      radius: u.splash ?? 0,
      target: t.id,
    });
    if (u.range > 80)
      this.projectiles.push({
        x: t.x,
        y: t.y,
        target: t.id,
        side: u.side,
        damage,
        splash: u.splash ?? 0,
        time: 0.25,
        kind: u.kind,
      });
    else {
      this.damage(t, damage, u);
      if (u.splash)
        this.splash(t.x, t.y, u.splash, damage * 0.65, u.side, t.id);
      if (u.kind === "spider" && !isStructure(t)) t.poison = 3;
    }
  }
  private projectiles: Projectile[] = [];
  private splash(
    x: number,
    y: number,
    r: number,
    d: number,
    side: number,
    exclude = 0,
  ) {
    for (const t of this.spatial.near(x, y, r))
      if (t.side !== side && t.id !== exclude) this.damage(t, d);
  }
  skillInfo(kind: Kind) {
    const u = this.getUnit(kind);
    const cd = Math.max(0, (this.readyAt.get(kind) ?? 0) - this.time);
    const exhausted =
      (kind === "emperor" ||
        (kind === "king" && this.loadout.spec === "summon")) &&
      (this.uses.get(kind) ?? 0) >= 2;
    return {
      unit: u,
      cooldown: cd,
      available:
        !!u && !cd && !exhausted && this.status === "battle" && !this.paused,
      exhausted,
    };
  }
  cast(kind: Kind, x: number, y: number): string {
    const info = this.skillInfo(kind);
    if (!info.unit) return "英雄尚未部署或已阵亡";
    if (this.paused) return "请先恢复战斗";
    if (!info.available)
      return info.exhausted ? "本场次数已用尽" : "技能尚未冷却";
    const hero = info.unit;
    const c = isCommander(kind) ? COMMANDERS[kind] : null;
    const r = c?.radius ?? 180;
    if (
      x < 0 ||
      y < 0 ||
      x > 3200 ||
      y > 2400 ||
      distance(hero, { x, y }) > (c?.castRange ?? 460)
    )
      return "超出施法距离";
    if (
      kind === "king" &&
      this.loadout.spec === "summon" &&
      !this.canDeploy(x, y)
    )
      return "异界召唤需要合法部署区";
    let wall: Structure | undefined;
    if (kind === "titan") {
      wall = this.structures
        .filter(
          (s) =>
            s.hp > 0 &&
            (s.kind === "wall" || s.kind === "gate") &&
            distance(s, { x, y }) < 100,
        )
        .sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0];
      if (!wall) return "请指定一段城墙或城门";
    }
    if (
      kind === "emperor" &&
      !this.units.some(
        (u) =>
          u.side === 0 &&
          u.hp > 0 &&
          ["slime", "split"].includes(u.kind) &&
          distance(u, { x, y }) <= r,
      )
    )
      return "范围内没有可分裂的史莱姆";
    this.readyAt.set(
      kind,
      this.time + (c?.cooldown ?? SPECS[this.loadout.spec].cooldown),
    );
    this.uses.set(kind, (this.uses.get(kind) ?? 0) + 1);
    this.stats.skills++;
    const angle = Math.atan2(y - hero.y, x - hero.x);
    this.events.push({
      type: "skill",
      x: kind === "dragon" ? hero.x : x,
      y: kind === "dragon" ? hero.y : y,
      tx: x,
      ty: y,
      kind,
      radius: r,
      angle,
      text: c?.skill ?? SPECS[this.loadout.spec].skill,
    });
    if (kind === "titan") {
      this.damage(wall!, 750);
      for (const u of this.spatial.near(x, y, 145))
        if (u.side === 1) u.root = 2;
    } else if (kind === "dragon") {
      for (const t of [
        ...this.structures,
        ...this.units.filter((u) => u.side === 1),
      ]) {
        const a = Math.atan2(t.y - hero.y, t.x - hero.x);
        const delta = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
        if (t.hp > 0 && distance(t, hero) <= r && Math.abs(delta) <= 0.65)
          this.damage(t, 170);
      }
    } else if (kind === "king" && this.loadout.spec === "summon")
      this.queue.push({
        kind: "slime",
        count: 30,
        x,
        y,
        small: false,
        lane: hero.lane,
      });
    else if (kind === "king" && this.loadout.spec === "element") {
      for (const t of [
        ...this.structures,
        ...this.units.filter((u) => u.side === 1),
      ])
        if (t.hp > 0 && distance(t, { x, y }) <= r)
          this.damage(t, t.kind === "crystal" ? 35 : 140);
    } else if (kind === "emperor") {
      for (const u of this.units
        .filter(
          (u) =>
            u.side === 0 &&
            u.hp > 0 &&
            ["slime", "split"].includes(u.kind) &&
            distance(u, { x, y }) <= r,
        )
        .slice(0, 25))
        this.queue.push({
          kind: "slime",
          count: 1,
          x: u.x,
          y: u.y,
          small: true,
          lane: u.lane,
        });
    } else
      for (const u of this.spatial.near(x, y, r)) {
        if (kind === "web" && u.side === 1 && !u.flying) u.root = 5;
        if (u.side === 0) {
          if (kind === "forest") u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2);
          if (kind === "moon" && u.speed >= 100) u.hunt = 9;
          if (kind === "king" && this.loadout.spec === "evolve") u.buff = 10;
        }
      }
    if (this.navDirty) this.refreshNav();
    this.checkResult();
    return "";
  }
  advance(realSeconds: number) {
    if (this.paused || this.status !== "battle") return;
    let remaining = Math.max(0, realSeconds * this.speed);
    while (remaining > 1e-6 && this.status === "battle") {
      const dt = Math.min(0.05, remaining);
      this.step(dt);
      remaining -= dt;
    }
  }
  step(dt = 0.05) {
    if (this.paused || this.status !== "battle") return;
    this.time += dt;
    this.spawnClock += dt;
    while (
      this.spawnClock >= 0.035 &&
      this.queue.length &&
      this.active < WORLD.cap
    ) {
      this.spawnClock -= 0.035;
      const q = this.queue[0];
      let x = q.x + (this.random() - 0.5) * 92,
        y = q.y + (this.random() - 0.5) * 72;
      for (let i = 0; i < 5 && this.nav.obstacleAt(x, y); i++) {
        x = q.x + (this.random() - 0.5) * 120;
        y = q.y + (this.random() - 0.5) * 90;
      }
      if (this.nav.obstacleAt(x, y)) {
        x = q.x;
        y = q.y;
      }
      this.spawn(q.kind, x, y, 0, q.small, q.lane);
      q.count--;
      if (q.count <= 0) this.queue.shift();
    }
    this.spawnClock = Math.min(this.spawnClock, 0.1);
    this.spatial.rebuild(this.units);
    for (const p of this.projectiles) {
      const tracked = this.byId.get(p.target);
      if (!p.splash && tracked && tracked.hp > 0) {
        p.x = tracked.x;
        p.y = tracked.y;
      }
      p.time -= dt;
      if (p.time > 0) continue;
      const t = this.byId.get(p.target);
      if (p.splash) {
        this.splash(p.x, p.y, p.splash, p.damage, p.side);
        if (t && isStructure(t) && t.hp > 0 && distance(t, p) < p.splash + 40)
          this.damage(t, p.damage);
      } else if (t && t.hp > 0) this.damage(t, p.damage);
      this.events.push({
        type: "impact",
        x: p.x,
        y: p.y,
        kind: p.kind,
        radius: p.splash,
      });
    }
    this.projectiles = this.projectiles.filter((p) => p.time > 0);
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      u.cooldown -= dt;
      u.think -= dt;
      u.hit = Math.max(0, u.hit - dt);
      u.attack = Math.max(0, u.attack - dt);
      u.buff = Math.max(0, u.buff - dt);
      u.hunt = Math.max(0, u.hunt - dt);
      u.moving = false;
      if (u.poison > 0) {
        u.poison -= dt;
        this.damage(u, dt * 3);
        if (u.hp <= 0) continue;
      }
      if (u.root > 0) {
        u.root -= dt;
        continue;
      }
      if (u.kind === "treant" || u.kind === "forest") {
        u.heal -= dt;
        if (u.heal <= 0) {
          u.heal = 4;
          for (const v of this.spatial.near(u.x, u.y, 100))
            if (v.side === 0 && this.time - v.healedAt >= 3.9) {
              v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.02);
              v.healedAt = this.time;
            }
        }
      }
      if (u.think <= 0) {
        u.think = 0.3 + this.random() * 0.2;
        this.chooseTarget(u);
      }
      const target = this.byId.get(u.target);
      if (target && target.hp > 0) {
        const rad = isStructure(target)
          ? Math.min(target.w, target.h) / 2
          : target.size * 0.28;
        const d = distance(u, target);
        if (d <= u.range + rad) {
          if (u.cooldown <= 0) this.hit(u, target);
          continue;
        }
      }
      this.move(u, target?.hp ? target : undefined, dt);
    }
    this.updateTowers(dt);
    this.captureClock += dt;
    if (this.navDirty) this.refreshNav();
    if (this.captureClock >= 0.25) {
      const elapsed = this.captureClock;
      this.captureClock = 0;
      this.capture(elapsed);
    }
    if (
      this.time >
        45 * (this.reinforcementWave + 1) +
          DIFFICULTIES[this.loadout.difficulty].response &&
      this.reinforcementWave < 3
    ) {
      this.reinforcementWave++;
      for (const b of this.structures
        .filter((s) => s.kind === "barracks" && s.hp > 0)
        .slice(0, 1)) {
        for (
          let i = 0;
          i < 4 + Math.round(DIFFICULTIES[this.loadout.difficulty].density * 3);
          i++
        )
          this.spawn(
            i % 3 === 0 ? "knight" : "soldier",
            b.x + 90 + (i % 3) * 25,
            b.y + 30 + Math.floor(i / 3) * 25,
            1,
          );
        this.events.push({
          type: "reinforce",
          x: b.x,
          y: b.y,
          text: "帝国预备队抵达",
        });
      }
    }
    this.stats.peak = Math.max(this.stats.peak, this.active);
    this.checkResult();
  }
  private chooseTarget(u: Unit) {
    if (u.order?.type === "move") {
      if (distance(u, u.order) < 25) u.order = undefined;
      else {
        u.target = 0;
        return;
      }
    }
    if (u.order?.type === "attack") {
      const t = this.byId.get(u.order.target);
      if (t && t.hp > 0) {
        u.target = t.id;
        return;
      }
      u.order = undefined;
    }
    const nearby = this.spatial.near(u.x, u.y, u.side === 0 ? 300 : 300);
    let target: Target | undefined;
    let best = Infinity;
    for (const v of nearby) {
      if (v.side === u.side || (v.flying && u.range < 80)) continue;
      if (u.side === 1 && distance(v, { x: u.homeX, y: u.homeY }) > 360)
        continue;
      let score = distance(u, v);
      if (
        ["wolf", "rider", "moon"].includes(u.kind) &&
        ["archer", "mage"].includes(v.kind)
      )
        score *= 0.55;
      if (score < best) {
        best = score;
        target = v;
      }
    }
    if (u.side === 0)
      for (const s of this.structures) {
        if (s.hp <= 0 || ["wall", "gate"].includes(s.kind)) continue;
        const d = distance(u, s);
        if (d < 320 && d * 0.9 < best) {
          target = s;
          best = d * 0.9;
        }
      }
    u.target = target?.id ?? 0;
  }
  private move(u: Unit, target: Target | undefined, dt: number) {
    let tx: number,
      ty: number,
      flow = false;
    if (u.order?.type === "move") {
      tx = u.order.x;
      ty = u.order.y;
      flow = true;
    } else if (target) {
      tx = target.x;
      ty = target.y;
    } else if (u.side === 1) {
      tx = u.homeX;
      ty = u.homeY;
      if (distance(u, { x: tx, y: ty }) < 18) return;
    } else {
      const p =
        u.lane < 0
          ? this.outposts[0]
          : u.lane > 0
            ? this.outposts[1]
            : undefined;
      if (p && !p.captured && !u.flying) {
        if (distance(u, p) < 60) return;
        tx = p.x;
        ty = p.y;
      } else {
        tx = 1600;
        ty = 1000;
      }
      flow = true;
    }
    let dx = tx - u.x,
      dy = ty - u.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (!u.flying && flow) {
      const direction = this.nav.direction(u.x, u.y, tx, ty);
      dx = direction.x;
      dy = direction.y;
    }
    const stride = u.speed * dt * (u.hunt > 0 ? 1.35 : 1);
    let nx = u.x + dx * stride,
      ny = u.y + dy * stride;
    if (!u.flying) {
      const blocker = this.nav.obstacleAt(
        nx,
        ny,
        u.kind === "spider" || u.kind === "web",
      );
      if (blocker) {
        const wall = this.byId.get(blocker);
        if (wall && u.side === 0) {
          u.target = blocker;
          if (u.cooldown <= 0) this.hit(u, wall);
        }
        return;
      }
    }
    // Light local separation prevents single pixel columns without heavy rigid body physics.
    if (u.id % 3 === Math.floor(this.time * 10) % 3) {
      for (const v of this.spatial.near(u.x, u.y, 18)) {
        if (v.id === u.id || v.side !== u.side || !!v.flying !== !!u.flying)
          continue;
        const d = distance(u, v) || 1;
        if (d < 14) {
          nx += ((u.x - v.x) / d) * dt * 18;
          ny += ((u.y - v.y) / d) * dt * 18;
        }
      }
    }
    if (
      u.flying ||
      !this.nav.obstacleAt(nx, ny, u.kind === "spider" || u.kind === "web")
    ) {
      u.x = Math.max(40, Math.min(3160, nx));
      u.y = Math.max(40, Math.min(2360, ny));
      u.moving = true;
      u.runDistance = Math.min(150, u.runDistance + stride);
      u.facing = dx >= 0 ? 1 : -1;
    }
  }
  private updateTowers(dt: number) {
    for (const s of this.structures) {
      s.attackFlash = Math.max(0, s.attackFlash - dt);
      if (
        s.hp <= 0 ||
        !["arrow", "cannon", "antiAir", "holy", "crystal"].includes(s.kind)
      )
        continue;
      s.cooldown -= dt;
      if (s.cooldown > 0) continue;
      const range =
        s.kind === "crystal"
          ? 170
          : s.kind === "cannon"
            ? 370
            : s.kind === "holy"
              ? 300
              : 340;
      const targets = this.spatial
        .near(s.x, s.y, range)
        .filter(
          (u) =>
            u.side === 0 &&
            (s.kind !== "antiAir" || u.flying) &&
            (s.kind !== "cannon" || !u.flying),
        );
      if (!targets.length) {
        s.cooldown = 0.2;
        continue;
      }
      let target = targets[0];
      if (s.kind === "holy")
        target = targets.sort(
          (a, b) =>
            b.maxHp +
            (isCommander(b.kind) ? 2000 : 0) -
            (a.maxHp + (isCommander(a.kind) ? 2000 : 0)),
        )[0];
      else if (s.kind === "cannon")
        target = targets.reduce((a, b) =>
          this.spatial.near(a.x, a.y, 95).length >
          this.spatial.near(b.x, b.y, 95).length
            ? a
            : b,
        );
      else target = targets.sort((a, b) => distance(a, s) - distance(b, s))[0];
      const damage =
        s.kind === "cannon"
          ? 88
          : s.kind === "antiAir"
            ? 72
            : s.kind === "holy"
              ? 62
              : s.kind === "crystal"
                ? 28
                : 16;
      const splash = s.kind === "cannon" ? 110 : s.kind === "crystal" ? 75 : 0;
      s.cooldown =
        s.kind === "cannon"
          ? 4.4
          : s.kind === "holy"
            ? 2.3
            : s.kind === "crystal"
              ? 3
              : 1.35;
      s.attackFlash = 0.3;
      this.events.push({
        type: "shot",
        x: s.x,
        y: s.y,
        tx: target.x,
        ty: target.y,
        kind: s.kind,
        side: 1,
        radius: splash,
        target: target.id,
      });
      this.projectiles.push({
        x: target.x,
        y: target.y,
        target: target.id,
        side: 1,
        damage,
        splash,
        time: s.kind === "cannon" ? 0.95 : 0.3,
        kind: s.kind,
      });
    }
  }
  private capture(dt: number) {
    for (const p of this.outposts) {
      const occupants = this.spatial.near(p.x, p.y, 145);
      p.contested = occupants.some((u) => u.side === 1);
      if (p.captured) continue;
      const ground = occupants.some((u) => u.side === 0 && !u.flying);
      if (ground && !p.contested && p.connected) {
        p.progress = Math.min(8, p.progress + dt);
        if (p.progress >= 8) {
          p.captured = true;
          this.reward(200);
          this.events.push({
            type: "capture",
            x: p.x,
            y: p.y,
            radius: 140,
            text: `${p.name}已占领 · +200`,
          });
        }
      }
    }
  }
  checkResult() {
    if (this.status !== "battle") return;
    if (this.crystal.hp <= 0) {
      this.status = "victory";
      this.reason = "日轮圣晶已被摧毁";
    } else if (this.remaining <= 0.000001) {
      this.status = "defeat";
      this.reason = "圣晶充能完成 · 净化降临";
    } else if (
      this.active === 0 &&
      this.reserves === 0 &&
      !ARMY_KEYS.some(
        (k) =>
          unlocked(this.loadout, k) &&
          this.money >= batchPrice(this.loadout, k),
      )
    ) {
      this.status = "defeat";
      this.reason = "军团力竭 · 已无可用作战手段";
    }
    if (this.status !== "battle")
      this.events.push({
        type: this.status,
        x: 1600,
        y: 1000,
        radius: 700,
        text: this.reason,
      });
  }
  get reinforcementCount() {
    return this.reinforcementWave;
  }
  snapshot() {
    return {
      time: +this.time.toFixed(2),
      remaining: +this.remaining.toFixed(2),
      money: this.money,
      active: this.active,
      queued: this.queued,
      reserves: this.reserves,
      crystalHp: this.crystal.hp,
      status: this.status,
      outposts: this.outposts.map((p) => ({ ...p })),
      stats: { ...this.stats },
    };
  }
}
