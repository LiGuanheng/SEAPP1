import {
  ARMIES,
  ARMY_KEYS,
  COMMANDERS,
  DIFFICULTIES,
  ENEMIES,
  KING,
  SPECS,
  SPELLS,
  WORLD,
  isArmy,
  isCommander,
  type Army,
  type Kind,
  type Stats,
  type Spell,
} from "./data";
import { batchPrice, purchase, unlocked, type Loadout } from "./economy";
import { Navigation, type Point } from "./navigation";
import {
  createStructures,
  OUTPOSTS,
  FRONTS,
  FRONT_KEYS,
  frontAt,
  districtAt,
  type Front,
  type Structure,
} from "./world";
export type Order =
  | { type: "move"; x: number; y: number; anchorX?: number; anchorY?: number }
  | { type: "attack"; target: number };
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
  rally?: Point[];
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
  front: Front;
  guardRadius: number;
  reserve: boolean;
  frenzy: number;
  ward: number;
  castTime: number;
  castTarget: number;
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
  spell?: Spell;
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
  fromX: number;
  fromY: number;
  source: number;
}
export interface SpellZone {
  spell: Spell;
  x: number;
  y: number;
  radius: number;
  remaining: number;
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
    for (let iy = Math.floor((y - r) / 180); iy <= Math.floor((y + r) / 180); iy++)
      for (let ix = Math.floor((x - r) / 180); ix <= Math.floor((x + r) / 180); ix++) {
        const b = this.cells.get(`${ix},${iy}`);
        if (b)
          for (const u of b) if (u.hp > 0 && (u.x - x) ** 2 + (u.y - y) ** 2 <= r * r) a.push(u);
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
    resourceIncome: 0,
    spells: 0,
    towerShots: { field: 0, outer: 0, inner: 0, core: 0 },
    destroyed: { field: 0, outer: 0, inner: 0, core: 0 },
  };
  readonly heroInventory = new Set<Kind>();
  readonly readyAt = new Map<Kind, number>();
  readonly uses = new Map<Kind, number>();
  readonly byId = new Map<number, Target>();
  readonly spellReadyAt = new Map<Spell, number>();
  readonly zones: SpellZone[] = [];
  readonly reserveTeams: {
    ids: number[];
    dispatched: boolean;
    front?: Front;
    dispatchedAt?: number;
  }[] = [];
  firstCoreHit: { time: number; x: number; y: number; walls: number } | null = null;
  mana = 100;
  readonly maxMana = 100;
  private responseClock = 0;
  private spatial = new Spatial();
  private nextId = 1000;
  private rngState: number;
  private spawnClock = 0;
  private captureClock = 0;
  private reinforcementWave = 0;
  private navDirty = false;
  private accumulator = 0;
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
    const remaining = DIFFICULTIES[this.loadout.difficulty].seconds - this.time;
    return remaining < 1e-6 ? 0 : remaining;
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
      ARMY_KEYS.reduce((s, k) => s + this.loadout.inventory[k], this.heroInventory.size) +
      this.queued
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
    for (const f of FRONT_KEYS) {
      const p = FRONTS[f],
        dx = Math.sign(2000 - p.gateX),
        dy = Math.sign(1800 - p.gateY);
      for (let i = 0; i < Math.round(11 * density); i++) {
        const kind: Kind = i < 5 ? "soldier" : i < 9 ? "archer" : f === "north" ? "mage" : "knight";
        this.spawn(
          kind,
          p.gateX + dx * 135 + (this.random() - 0.5) * 140,
          p.gateY + dy * 135 + (this.random() - 0.5) * 140,
          1,
        );
      }
      for (let i = 0; i < 3; i++)
        this.spawn(
          i === 0 ? "archer" : "soldier",
          p.gateX - dx * 140 + (i - 1) * 32,
          p.gateY - dy * 140,
          1,
        );
    }
    for (const [x, y] of [
      [1360, 1800],
      [2610, 1800],
      [2000, 1250],
      [2000, 2350],
    ])
      for (let i = 0; i < Math.round(7 * density); i++)
        this.spawn(
          i < 3 ? "paladin" : i < 5 ? "mage" : "archer",
          x + (this.random() - 0.5) * 130,
          y + (this.random() - 0.5) * 110,
          1,
        );
    for (let i = 0; i < Math.round(7 * density); i++)
      this.spawn(
        i % 3 === 0 ? "mage" : "paladin",
        1850 + (i % 3) * 120,
        1720 + Math.floor(i / 3) * 100,
        1,
      );
    this.spawn("captain", 2000, 1900, 1);
    const teamCount =
      this.loadout.difficulty === "easy" ? 2 : this.loadout.difficulty === "hard" ? 4 : 3;
    const camps = this.structures.filter((s) => s.kind === "barracks");
    for (let i = 0; i < teamCount; i++) {
      const ids: number[] = [],
        camp = camps[i];
      for (let j = 0; j < (this.loadout.difficulty === "hard" ? 7 : 6); j++) {
        const u = this.spawn(
          j % 3 === 0 ? "mage" : j % 2 === 0 ? "soldier" : "knight",
          camp.x - 85 + (j % 3) * 32,
          camp.y + 95 + Math.floor(j / 3) * 32,
          1,
        );
        u.reserve = true;
        ids.push(u.id);
      }
      this.reserveTeams.push({ ids, dispatched: false });
    }
    this.spatial.rebuild(this.units);
  }
  private refreshNav() {
    this.nav.rebuild(this.structures.filter((s) => s.hp > 0));
    this.navDirty = false;
    for (const p of this.outposts) p.connected = this.nav.connected(FRONTS[p.front], p);
  }
  spawn(kind: Kind, x: number, y: number, side: 0 | 1 = 0, small = false, lane = 0): Unit {
    const base: Stats = isArmy(kind)
      ? ARMIES[kind]
      : isCommander(kind)
        ? COMMANDERS[kind].stats
        : kind === "king"
          ? KING
          : ENEMIES[kind]!;
    if (!base) throw new Error(`Invalid unit ${kind}`);
    const evo =
      side === 0 && this.loadout.spec === "evolve" && isArmy(kind) && ARMIES[kind].commander
        ? 1.1
        : 1;
    const elemental = side === 0 && this.loadout.spec === "element" && base.range > 80 ? 1.1 : 1;
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
      front: frontAt(x, y),
      guardRadius: districtAt(x, y) === "core" ? 250 : districtAt(x, y) === "field" ? 220 : 330,
      reserve: false,
      frenzy: 0,
      ward: 0,
      castTime: 0,
      castTarget: 0,
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
      FRONT_KEYS.some(
        (f) =>
          Math.abs(x - FRONTS[f].x) <= FRONTS[f].w / 2 &&
          Math.abs(y - FRONTS[f].y) <= FRONTS[f].h / 2,
      )
    )
      return true;
    return this.outposts.some(
      (p) =>
        p.captured &&
        p.connected &&
        !p.contested &&
        Math.abs(x - p.x) <= p.w / 2 &&
        Math.abs(y - p.y) <= p.h / 2 &&
        !this.units.some((u) => u.side === 1 && u.hp > 0 && distance(u, { x, y }) < 80),
    );
  }
  deploy(kind: Kind, x: number, y: number, batches: number = 1): boolean {
    if (this.status !== "battle" || !this.canDeploy(x, y)) return false;
    if ((batches !== Infinity && !Number.isFinite(batches)) || batches <= 0) return false;
    let count = 0;
    if (isArmy(kind)) {
      if (!unlocked(this.loadout, kind)) return false;
      count = Math.min(
        this.loadout.inventory[kind],
        batches === Infinity ? Infinity : Math.max(0, Math.floor(batches)) * ARMIES[kind].batch,
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
    const members = [...ids].filter((id) => {
      const u = this.byId.get(id);
      return u && !isStructure(u) && u.side === 0 && u.hp > 0;
    });
    const columns = Math.ceil(Math.sqrt(members.length)),
      rows = Math.ceil(members.length / columns);
    for (const [index, id] of members.entries()) {
      const u = this.byId.get(id);
      if (u && !isStructure(u) && u.side === 0 && u.hp > 0) {
        u.order = { ...order };
        if (u.order.type === "move" && members.length > 1) {
          if (order.type === "move") {
            u.order.anchorX = order.x;
            u.order.anchorY = order.y;
          }
          u.order.x = Math.max(
            40,
            Math.min(
              WORLD.width - 40,
              order.type === "move" ? order.x + ((index % columns) - (columns - 1) / 2) * 22 : 0,
            ),
          );
          u.order.y = Math.max(
            40,
            Math.min(
              WORLD.height - 40,
              order.type === "move"
                ? order.y + (Math.floor(index / columns) - (rows - 1) / 2) * 22
                : 0,
            ),
          );
        }
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
    const visible = [...this.structures, ...this.units.filter((u) => u.side === 1)]
      .filter((t) => t.hp > 0)
      .sort((a, b) => b.y - a.y);
    for (const t of visible) {
      if (isStructure(t) && !["wall", "gate"].includes(t.kind)) {
        const half = t.kind === "crystal" ? 130 : t.kind === "barracks" ? 100 : 65;
        const height =
          t.kind === "crystal"
            ? 280
            : t.kind === "barracks"
              ? 165
              : t.kind === "cannon"
                ? 140
                : 205;
        if (Math.abs(x - t.x) < half && y > t.y - height && y < t.y + 24) return t;
      }
    }
    let best: Target | undefined,
      dist = 65;
    for (const t of [...this.structures, ...this.units.filter((u) => u.side === 1)]) {
      if (t.hp <= 0) continue;
      const d = distance(t, { x, y }) - (isStructure(t) ? Math.max(t.w, t.h) / 2 : t.size / 2);
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
    if (target.kind === "crystal" && !this.firstCoreHit)
      this.firstCoreHit = {
        time: this.time,
        x: source?.x ?? target.x,
        y: source?.y ?? target.y,
        walls: this.stats.walls,
      };
    if (!isStructure(target) && target.side === 0 && target.ward > 0) amount *= 0.6;
    target.hp -= amount;
    if (!isStructure(target)) target.hit = 0.16;
    if (target.hp > 0) return;
    target.hp = 0;
    if (isStructure(target)) {
      if (!target.paid) {
        const bonus = target.resource && source?.kind === "raider" ? 90 : 0;
        this.reward(target.reward + bonus);
        if (target.resource) {
          this.stats.resourceIncome += target.reward + bonus;
          this.events.push({
            type: "loot",
            x: target.x,
            y: target.y,
            text: `${bonus ? "掠夺成功" : "夺取物资"} +${target.reward + bonus}`,
            radius: 80,
          });
        }
        target.paid = true;
      }
      this.stats.destroyed[target.district]++;
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
        this.reward(["paladin", "knight", "captain"].includes(target.kind) ? 4 : 1);
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
    if (source?.kind === "spider" && !isStructure(target) && target.hp > 0) target.poison = 3;
  }
  private hit(u: Unit, t: Target) {
    if (!this.nav.clear(u, t, u.id, t.id)) return;
    let damage =
      u.damage *
      u.period *
      (u.buff > 0 ? 1.2 : 1) *
      (u.hunt > 0 ? 1.15 : 1) *
      (u.frenzy > 0 ? 1.1 : 1);
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
    if (isStructure(t) && (t.kind === "wall" || t.kind === "gate")) damage *= u.wallBonus ?? 1;
    if (isStructure(t) && u.flying) damage *= 0.55;
    if (isStructure(t) && t.resource && u.kind === "raider") damage *= 3;
    if (["knight", "paladin"].includes(u.kind) && ["wolf", "rider"].includes(t.kind)) damage *= 1.5;
    u.cooldown = u.period * (u.frenzy > 0 ? 0.75 : 1);
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
        time: u.kind === "elf" ? 0.4 : 0.25,
        kind: u.kind,
        fromX: u.x,
        fromY: u.y,
        source: u.id,
      });
    else {
      this.damage(t, damage, u);
      if (u.splash) this.splash(t.x, t.y, u.splash, damage * 0.65, u.side, t.id, u, t.id);
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
    source?: Unit,
    originId = 0,
    airOnly = false,
  ) {
    for (const t of this.spatial.near(x, y, r))
      if (
        (!airOnly || t.flying) &&
        t.side !== side &&
        t.id !== exclude &&
        this.nav.clear({ x, y }, t, originId, t.id)
      )
        this.damage(t, d, source);
  }
  skillInfo(kind: Kind) {
    const u = this.getUnit(kind);
    const cd = Math.max(0, (this.readyAt.get(kind) ?? 0) - this.time);
    const exhausted =
      (kind === "emperor" || (kind === "king" && this.loadout.spec === "summon")) &&
      (this.uses.get(kind) ?? 0) >= 2;
    return {
      unit: u,
      cooldown: cd,
      available: !!u && !cd && !exhausted && this.status === "battle" && !this.paused,
      exhausted,
    };
  }
  cast(kind: Kind, x: number, y: number): string {
    const info = this.skillInfo(kind);
    if (!info.unit) return "英雄尚未部署或已阵亡";
    if (this.paused) return "请先恢复战斗";
    if (!info.available) return info.exhausted ? "本场次数已用尽" : "技能尚未冷却";
    const hero = info.unit;
    const c = isCommander(kind) ? COMMANDERS[kind] : null;
    const r = c?.radius ?? 180;
    if (
      x < 0 ||
      y < 0 ||
      x > WORLD.width ||
      y > WORLD.height ||
      distance(hero, { x, y }) > (c?.castRange ?? 460)
    )
      return "超出施法距离";
    if (kind === "king" && this.loadout.spec === "summon" && !this.canDeploy(x, y))
      return "异界召唤需要合法部署区";
    let wall: Structure | undefined;
    if (kind === "titan") {
      wall = this.structures
        .filter(
          (s) =>
            s.hp > 0 && (s.kind === "wall" || s.kind === "gate") && distance(s, { x, y }) < 100,
        )
        .sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0];
      if (!wall) return "请指定一段城墙或城门";
      if (!this.nav.clear(hero, wall, hero.id, wall.id)) return "城墙被其他建筑遮挡";
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
    this.readyAt.set(kind, this.time + (c?.cooldown ?? SPECS[this.loadout.spec].cooldown));
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
      this.damage(wall!, 750, hero);
      for (const u of this.spatial.near(x, y, 145)) if (u.side === 1) u.root = 2;
    } else if (kind === "dragon") {
      for (const t of [...this.structures, ...this.units.filter((u) => u.side === 1)]) {
        const a = Math.atan2(t.y - hero.y, t.x - hero.x);
        const delta = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
        if (
          t.hp > 0 &&
          distance(t, hero) <= r &&
          Math.abs(delta) <= 0.65 &&
          this.nav.clear(hero, t, hero.id, t.id)
        )
          this.damage(t, 170, hero);
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
      for (const t of [...this.structures, ...this.units.filter((u) => u.side === 1)])
        if (
          t.hp > 0 &&
          distance(t, { x, y }) <= r &&
          this.nav.clear(hero, t, hero.id, t.id) &&
          this.nav.clear({ x, y }, t, 0, t.id)
        )
          this.damage(t, t.kind === "crystal" ? 35 : 140, hero);
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
  spellInfo(spell: Spell) {
    const data = SPELLS[spell],
      cooldown = Math.max(0, (this.spellReadyAt.get(spell) ?? 0) - this.time);
    return {
      cooldown,
      available:
        !!data &&
        this.mana >= data.cost &&
        cooldown === 0 &&
        !this.paused &&
        this.status === "battle",
    };
  }
  canCastSpell(x: number, y: number) {
    const target = this.nav.obstacleAt(x, y);
    return (
      x >= 0 &&
      y >= 0 &&
      x <= WORLD.width &&
      y <= WORLD.height &&
      this.units.some(
        (u) =>
          u.side === 0 &&
          u.hp > 0 &&
          distance(u, { x, y }) <= 360 &&
          this.nav.clear(u, { x, y }, u.id, target),
      )
    );
  }
  castSpell(spell: Spell, x: number, y: number): string {
    const d = SPELLS[spell];
    if (!d || this.status !== "battle") return "当前无法施法";
    if (this.paused) return "请先恢复战斗";
    if (this.mana < d.cost) return `魔力不足 · 需要${d.cost}`;
    if (this.spellInfo(spell).cooldown > 0) return "法术尚未冷却";
    if (!this.canCastSpell(x, y)) return "需要360距离内友军提供无遮挡视野";
    this.mana -= d.cost;
    this.spellReadyAt.set(spell, this.time + d.cooldown);
    this.stats.spells++;
    this.zones.push({ spell, x, y, radius: d.radius, remaining: d.duration });
    this.events.push({ type: "spell", spell, x, y, radius: d.radius, text: d.name });
    return "";
  }
  private updateSpells(dt: number) {
    this.mana = Math.min(this.maxMana, this.mana + dt * 1.8);
    for (const z of this.zones) {
      z.remaining -= dt;
      if (z.spell === "meteor") {
        if (z.remaining > 0) continue;
        for (const t of [...this.structures, ...this.spatial.near(z.x, z.y, z.radius)]) {
          if (
            t.hp <= 0 ||
            (!isStructure(t) && t.side !== 1) ||
            distance(t, z) > z.radius ||
            !this.nav.clear(z, t, 0, t.id)
          )
            continue;
          this.damage(t, t.kind === "crystal" ? 45 : isStructure(t) ? 120 : 180);
        }
        this.events.push({
          type: "impact",
          kind: "mage",
          spell: "meteor",
          x: z.x,
          y: z.y,
          radius: z.radius,
        });
      } else
        for (const u of this.spatial.near(z.x, z.y, z.radius)) {
          if (u.side !== 0 || !this.nav.clear(z, u, 0, u.id)) continue;
          if (z.spell === "heal") u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05 * dt);
          if (z.spell === "rage") u.frenzy = 0.12;
          if (z.spell === "barrier") u.ward = 0.12;
        }
    }
    for (let i = this.zones.length - 1; i >= 0; i--)
      if (this.zones[i].remaining <= 0) this.zones.splice(i, 1);
  }
  private directReserves(dt: number) {
    this.responseClock += dt;
    if (this.responseClock < DIFFICULTIES[this.loadout.difficulty].response) return;
    this.responseClock = 0;
    const threats = FRONT_KEYS.map((front) => ({
      front,
      score: this.units
        .filter(
          (u) =>
            u.side === 0 &&
            u.hp > 0 &&
            frontAt(u.x, u.y) === front &&
            distance(u, { x: FRONTS[front].gateX, y: FRONTS[front].gateY }) < 950,
        )
        .reduce((sum, u) => sum + Math.min(5, u.maxHp / 120), 0),
    })).sort((a, b) => b.score - a.score);
    const threat = threats.find(
      (t) =>
        t.score >= 7 &&
        this.reserveTeams.filter(
          (r) =>
            r.dispatched &&
            r.front === t.front &&
            r.ids.some((id) => (this.byId.get(id)?.hp ?? 0) > 0),
        ).length < 2,
    );
    const team = this.reserveTeams.find(
      (t) => !t.dispatched && t.ids.some((id) => (this.byId.get(id)?.hp ?? 0) > 0),
    );
    if (!threat || !team) return;
    team.dispatched = true;
    team.front = threat.front;
    team.dispatchedAt = this.time;
    this.reinforcementWave++;
    const p = this.outposts.find((p) => p.front === threat.front)!;
    const innerGate = this.structures.find(
      (s) => s.kind === "gate" && s.district === "inner" && s.front === threat.front,
    )!;
    for (const [i, id] of team.ids.entries()) {
      const u = this.byId.get(id) as Unit;
      if (!u || u.hp <= 0) continue;
      u.reserve = false;
      u.front = threat.front;
      u.homeX = p.x + ((i % 3) - 1) * 32;
      u.homeY = p.y + Math.floor(i / 3) * 32;
      u.guardRadius = 420;
      u.rally = [
        { x: innerGate.x, y: innerGate.y },
        { x: u.homeX, y: u.homeY },
      ];
      u.target = 0;
      u.think = 0;
    }
    this.events.push({
      type: "reinforce",
      x: innerGate.x,
      y: innerGate.y,
      text: `${FRONTS[threat.front].name.slice(0, 2)}承压 · 内城预备队沿道路增援`,
    });
  }
  advance(realSeconds: number) {
    if (this.paused || this.status !== "battle") return;
    this.accumulator += Math.max(0, realSeconds * this.speed);
    while (this.accumulator >= 1 / 60 - 1e-8 && this.status === "battle") {
      this.step(1 / 60);
      this.accumulator = Math.max(0, this.accumulator - 1 / 60);
    }
  }
  step(dt = 0.05) {
    if (this.paused || this.status !== "battle") return;
    this.time += dt;
    this.spawnClock += dt;
    let spawned = 0;
    while (
      this.spawnClock >= 0.01 &&
      this.queue.length &&
      this.active < WORLD.cap &&
      spawned < 12
    ) {
      this.spawnClock -= 0.01;
      spawned++;
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
    this.updateSpells(dt);
    for (const p of this.projectiles) {
      const tracked = this.byId.get(p.target);
      if (!p.splash && tracked && tracked.hp > 0) {
        p.x = tracked.x;
        p.y = tracked.y;
      }
      p.time -= dt;
      if (p.time > 0) continue;
      const t = this.byId.get(p.target);
      const source = this.byId.get(p.source),
        caster = source && !isStructure(source) ? source : undefined;
      const clear = this.nav.clear({ x: p.fromX, y: p.fromY }, p, p.source, p.target);
      if (p.splash && clear) {
        this.splash(
          p.x,
          p.y,
          p.splash,
          p.damage,
          p.side,
          0,
          caster,
          p.target,
          p.kind === "antiAir",
        );
        if (t && isStructure(t) && t.hp > 0 && distance(t, p) < p.splash + 40)
          this.damage(t, p.damage, caster);
      } else if (!p.splash && clear && t && t.hp > 0) this.damage(t, p.damage, caster);
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
      u.frenzy = Math.max(0, u.frenzy - dt);
      u.ward = Math.max(0, u.ward - dt);
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
      if (u.castTime > 0) {
        u.castTime -= dt;
        const target = this.byId.get(u.castTarget);
        if (
          !target ||
          target.hp <= 0 ||
          distance(u, target) > u.range + 40 ||
          !this.nav.clear(u, target, u.id, target.id)
        ) {
          u.castTime = 0;
          u.cooldown = 0.4;
        } else if (u.castTime <= 0) this.hit(u, target);
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
        const d = isStructure(target)
          ? Math.hypot(
              Math.max(0, Math.abs(u.x - target.x) - target.w / 2),
              Math.max(0, Math.abs(u.y - target.y) - target.h / 2),
            )
          : distance(u, target) - target.size * 0.28;
        if (d <= u.range && this.nav.clear(u, target, u.id, target.id)) {
          if (u.cooldown <= 0) {
            if (u.kind === "elf") {
              u.castTime = 0.65;
              u.castTarget = target.id;
              this.events.push({ type: "chant", x: u.x, y: u.y, kind: u.kind, radius: 35 });
            } else this.hit(u, target);
          }
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
    this.directReserves(dt);
    this.stats.peak = Math.max(this.stats.peak, this.active);
    this.checkResult();
  }
  private chooseTarget(u: Unit) {
    if (u.order?.type === "move") {
      if (distance(u, u.order) >= 25) {
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
      if (
        u.side === 1 &&
        distance(v, { x: u.homeX, y: u.homeY }) > u.guardRadius &&
        !u.rally?.length
      )
        continue;
      if (!this.nav.clear(u, v, u.id, v.id)) continue;
      let score = distance(u, v);
      if (["wolf", "rider", "moon"].includes(u.kind) && ["archer", "mage"].includes(v.kind))
        score *= 0.55;
      if (u.kind === "raider" && distance(u, v) < 150) score *= 0.3;
      if (score < best) {
        best = score;
        target = v;
      }
    }
    if (u.side === 0)
      for (const s of this.structures) {
        if (s.hp <= 0 || ["wall", "gate", "cityblock"].includes(s.kind)) continue;
        const d = distance(u, s);
        const score =
          d *
          (u.kind === "raider" && s.resource
            ? 0.25
            : u.flying && s.kind === "antiAir"
              ? 0.45
              : 0.9);
        if (
          d < (u.kind === "raider" && s.resource ? 700 : 320) &&
          score < best &&
          this.nav.clear(u, s, u.id, s.id)
        ) {
          target = s;
          best = score;
        }
      }
    u.target = target?.id ?? 0;
  }
  private move(u: Unit, target: Target | undefined, dt: number) {
    let tx: number,
      ty: number,
      flow = false;
    if (u.order?.type === "move") {
      if (distance(u, u.order) < 18) return;
      tx = u.order.x;
      ty = u.order.y;
      flow = true;
      if (u.order.anchorX !== undefined && u.order.anchorY !== undefined) {
        if (distance(u, u.order) < 240) flow = false;
        else {
          tx = u.order.anchorX;
          ty = u.order.anchorY;
        }
      }
    } else if (target) {
      tx = target.x;
      ty = target.y;
      flow = !this.nav.clear(u, target, u.id, target.id);
    } else if (u.side === 1) {
      tx = u.rally?.[0]?.x ?? u.homeX;
      ty = u.rally?.[0]?.y ?? u.homeY;
      if (distance(u, { x: tx, y: ty }) < 18) {
        u.rally?.shift();
        return;
      }
      flow = true;
    } else {
      const p = this.outposts.find((p) => p.front === u.front);
      if (p && !p.captured && !u.flying) {
        if (distance(u, p) < 60) return;
        tx = p.x;
        ty = p.y;
      } else {
        tx = WORLD.crystal.x;
        ty = WORLD.crystal.y;
      }
      flow = true;
    }
    let dx = tx - u.x,
      dy = ty - u.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (!u.flying && flow) {
      const direction = this.nav.direction(u.x, u.y, tx, ty, u.side === 1);
      dx = direction.x;
      dy = direction.y;
    }
    const stride = u.speed * dt * (u.hunt > 0 ? 1.35 : 1) * (u.frenzy > 0 ? 1.2 : 1);
    let nx = u.x + dx * stride,
      ny = u.y + dy * stride;
    if (!u.flying) {
      const blocker = this.nav.obstacleAt(
        nx,
        ny,
        u.kind === "spider" || u.kind === "web",
        u.side === 1,
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
        if (v.id === u.id || v.side !== u.side || !!v.flying !== !!u.flying) continue;
        const d = distance(u, v) || 1;
        if (d < 14) {
          nx += ((u.x - v.x) / d) * dt * 18;
          ny += ((u.y - v.y) / d) * dt * 18;
        }
      }
    }
    if (
      u.flying ||
      !this.nav.obstacleAt(nx, ny, u.kind === "spider" || u.kind === "web", u.side === 1)
    ) {
      u.x = Math.max(40, Math.min(WORLD.width - 40, nx));
      u.y = Math.max(40, Math.min(WORLD.height - 40, ny));
      u.moving = true;
      u.runDistance = Math.min(150, u.runDistance + stride);
      u.facing = dx >= 0 ? 1 : -1;
    }
  }
  private updateTowers(dt: number) {
    for (const s of this.structures) {
      s.attackFlash = Math.max(0, s.attackFlash - dt);
      if (s.hp <= 0 || !["arrow", "cannon", "antiAir", "holy", "crystal"].includes(s.kind))
        continue;
      s.cooldown -= dt;
      if (s.cooldown > 0) continue;
      const range =
        s.kind === "crystal" ? 170 : s.kind === "cannon" ? 370 : s.kind === "holy" ? 300 : 340;
      const targets = this.spatial
        .near(s.x, s.y, range)
        .filter(
          (u) =>
            u.side === 0 &&
            (s.district === "field" || districtAt(u.x, u.y) === s.district) &&
            this.nav.clear(s, u, s.id, u.id) &&
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
          this.spatial.near(a.x, a.y, 95).length > this.spatial.near(b.x, b.y, 95).length ? a : b,
        );
      else target = targets.sort((a, b) => distance(a, s) - distance(b, s))[0];
      const damage =
        s.kind === "cannon"
          ? 88
          : s.kind === "antiAir"
            ? s.district === "core"
              ? 110
              : s.district === "inner"
                ? 100
                : 90
            : s.kind === "holy"
              ? 62
              : s.kind === "crystal"
                ? 28
                : 16;
      const splash =
        s.kind === "cannon" ? 110 : s.kind === "antiAir" ? 65 : s.kind === "crystal" ? 75 : 0;
      s.cooldown =
        s.kind === "cannon" ? 4.4 : s.kind === "holy" ? 2.3 : s.kind === "crystal" ? 3 : 1.35;
      s.attackFlash = 0.3;
      this.stats.towerShots[s.district]++;
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
        fromX: s.x,
        fromY: s.y,
        source: s.id,
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
      !ARMY_KEYS.some((k) => unlocked(this.loadout, k) && this.money >= batchPrice(this.loadout, k))
    ) {
      this.status = "defeat";
      this.reason = "军团力竭 · 已无可用作战手段";
    }
    if (this.status !== "battle")
      this.events.push({
        type: this.status,
        x: WORLD.crystal.x,
        y: WORLD.crystal.y,
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
      mana: +this.mana.toFixed(2),
      firstCoreHit: this.firstCoreHit,
      reservesDispatched: this.reinforcementWave,
    };
  }
}
