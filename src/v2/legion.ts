import { WORLD } from "./data";
import { FRONTS, FRONT_KEYS, districtAt, towerRange, type Front, type Structure } from "./world";
import type { Point } from "./navigation";
import type { Battle, Unit } from "./simulation";
import { segmentDistance } from "./orders";
export const LEGION_COMMANDS = {
  sweep: "自动扫荡",
  loot: "优先掠夺",
  rally: "集结待命",
  assault: "最终总攻",
} as const;
export type LegionCommand = keyof typeof LEGION_COMMANDS;
export type ControlOwner = "auto" | "manual" | "idle";
export interface LegionGoal extends Point {
  kind: "advance" | "raid" | "breach" | "escort" | "rally" | "air-cover";
  target: number;
  phase: number;
  label: string;
  anchor?: Point;
  blocked?: boolean;
}
interface FrontPlan {
  goal: LegionGoal;
  breach: Structure | undefined;
  phase: number;
}
const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const military = (s: Structure) =>
  ["arrow", "cannon", "antiAir", "holy", "barracks"].includes(s.kind);
const side = (f: Front) => ({
  x: f === "west" ? 1 : f === "east" ? -1 : 0,
  y: f === "north" ? 1 : f === "south" ? -1 : 0,
});
/** A bounded, one-second strategic director. Units keep independent combat clocks.
 * It assigns objectives only: it never buys, spawns, or casts an active skill. */
export class LegionDirector {
  command: LegionCommand = "sweep";
  muster: Point | null = null;
  effectiveMuster: Point | null = null;
  advice = "先掠夺外围、突破外城；可随时发动总攻";
  private nextUpdate = 0;
  private nextDanger = 0;
  private plans = new Map<string, FrontPlan>();
  private resources: Structure[] = [];
  private towers: Structure[] = [];
  private allies: Unit[] = [];
  private gateMap = new Map<string, Structure>();
  private committedBreaches = new Map<string, Structure>();
  private localCells = new Map<string, Structure[]>();
  readonly clusters = new Map<number, number>();
  readonly metrics = { updates: 0, assignments: 0 };
  constructor(private b: Battle) {
    for (const s of b.structures)
      if (s.kind === "gate") this.gateMap.set(`${s.district}:${s.front}`, s);
  }
  invalidate() {
    this.nextUpdate = 0;
  }
  stance(u: Unit) {
    return u.tactic ?? this.command;
  }
  nearStructures(p: Point, r: number) {
    const found = new Set<Structure>();
    for (let y = Math.floor((p.y - r) / 320); y <= Math.floor((p.y + r) / 320); y++)
      for (let x = Math.floor((p.x - r) / 320); x <= Math.floor((p.x + r) / 320); x++)
        for (const s of this.localCells.get(`${x},${y}`) ?? []) if (s.hp > 0) found.add(s);
    return [...found];
  }
  groundApproach(s: Structure, from: Point): Point | undefined {
    return [
      { x: s.x - s.w / 2 - 32, y: s.y },
      { x: s.x + s.w / 2 + 32, y: s.y },
      { x: s.x, y: s.y - s.h / 2 - 32 },
      { x: s.x, y: s.y + s.h / 2 + 32 },
    ]
      .filter((p) => !this.b.nav.obstacleAt(p.x, p.y) && this.b.nav.connected(from, p))
      .sort((a, c) => d(a, from) - d(c, from))[0];
  }
  safe(p: Point) {
    if (
      p.x < 60 ||
      p.y < 60 ||
      p.x > WORLD.width - 60 ||
      p.y > WORLD.height - 60 ||
      this.b.nav.obstacleAt(p.x, p.y)
    )
      return false;
    const controlled =
      this.b.canDeploy(p.x, p.y) ||
      this.b.units.filter((u) => u.side === 0 && u.hp > 0 && !u.flying && d(u, p) < 270).length >=
        3;
    if (!controlled || this.b.units.some((u) => u.side === 1 && u.hp > 0 && d(u, p) < 330))
      return false;
    return !this.b.structures.some(
      (s) =>
        s.hp > 0 &&
        ["arrow", "cannon", "holy", "crystal"].includes(s.kind) &&
        d(s, p) < towerRange(s) + 50 &&
        this.b.nav.clear(s, p, s.id, 0, {
          district: s.district,
          reach: s.kind === "cannon" ? 280 : 165,
        }),
    );
  }
  private safeCandidates() {
    return [
      ...this.b.outposts.filter((p) => p.captured && p.connected && !p.contested),
      { x: 250, y: 850 },
      { x: 250, y: 2750 },
      { x: 3750, y: 850 },
      { x: 3750, y: 2750 },
      { x: 1100, y: 230 },
      { x: 2850, y: 230 },
      { x: 1050, y: 3430 },
      { x: 2900, y: 3430 },
    ].filter((p) => this.safe(p));
  }
  private breach(front: Front, district: "outer" | "inner" | "core", lane: number) {
    const key = `${front}:${district}:${lane}`,
      committed = this.committedBreaches.get(key);
    if (committed && committed.hp > 0) return committed;
    const gate = this.gateMap.get(`${district}:${front}`)!;
    let choices = this.b.structures.filter(
      (s) =>
        s.district === district &&
        s.front === front &&
        ["gate", "wall"].includes(s.kind) &&
        d(s, gate) < 540,
    );
    const opened = choices.filter((s) => s.hp <= 0);
    if (opened.length) choices = opened;
    const score = (s: Structure) =>
      d(s, gate) * 0.35 +
      (s.hp > 0 ? 160 + s.hp * (s.weak ? 0.04 : 0.1) : 0) +
      this.allies.filter((u) => d(u, s) < 100).length * 9 +
      (lane === 0
        ? 0
        : Math.abs((front === "west" || front === "east" ? s.y - gate.y : s.x - gate.x) - 260) *
          0.25);
    const choice = choices.sort((a, c) => score(a) - score(c))[0] ?? gate;
    this.committedBreaches.set(key, choice);
    return choice;
  }
  private plan(front: Front, lane: number, assault = false): FrontPlan {
    const key = `${front}:${lane}:${assault}`,
      p = FRONTS[front],
      dir = side(front),
      post = this.b.outposts.find((q) => q.front === front)!;
    let phase = 0,
      breach: Structure | undefined,
      goal: LegionGoal;
    for (const ring of ["outer", "inner", "core"] as const) {
      breach = this.breach(front, ring, lane);
      const entry = { x: breach.x + dir.x * 115, y: breach.y + dir.y * 115 };
      const open = breach.hp <= 0;
      if (!open) {
        goal = {
          ...entry,
          kind: "breach",
          target: breach.id,
          phase,
          label: `突破${{ outer: "外城", inner: "内城", core: "核心" }[ring]}防线`,
        };
        const result = { goal, breach, phase };
        this.plans.set(key, result);
        return result;
      }
      if (!assault && ring === "outer" && !post.captured) {
        goal = { x: post.x, y: post.y, kind: "advance", target: 0, phase, label: "清理并占领前线" };
        const result = { goal, breach, phase };
        this.plans.set(key, result);
        return result;
      }
      if (!assault && ring !== "core") {
        const threats = this.b.structures.filter(
          (s) =>
            s.hp > 0 &&
            s.district === ring &&
            s.front === front &&
            (military(s) || s.resource) &&
            d(s, ring === "outer" ? post : entry) < 650,
        );
        const objective = threats.sort(
          (a, c) =>
            d(a, entry) / (a.kind === "cannon" ? 2 : 1) -
            d(c, entry) / (c.kind === "cannon" ? 2 : 1),
        )[0];
        if (objective) {
          goal = {
            x: objective.x,
            y: objective.y,
            kind: objective.resource ? "raid" : "advance",
            target: objective.id,
            phase,
            label: objective.resource ? "夺取前线物资" : "压制本路城防",
          };
          const result = { goal, breach, phase };
          this.plans.set(key, result);
          return result;
        }
      }
      phase++;
    }
    const spread = lane ? 95 : -95;
    goal = {
      x: 2000 + dir.y * spread - dir.x * 135,
      y: 1800 + dir.x * spread - dir.y * 135,
      kind: "advance",
      target: this.b.crystal.id,
      phase: 3,
      label: "中央圣晶决战",
    };
    const result = { goal, breach, phase: 3 };
    this.plans.set(key, result);
    void p;
    return result;
  }
  private assign(u: Unit) {
    const b = this.b,
      stance = this.stance(u),
      lane = u.id % 2;
    if (stance === "rally") {
      const requested = u.musterPoint ?? this.muster;
      if (!requested) {
        u.autoGoal = {
          x: u.x,
          y: u.y,
          kind: "rally",
          target: 0,
          phase: 0,
          label: "等待指定安全集结点",
          blocked: true,
        };
        return;
      }
      const destination = this.safe(requested)
        ? requested
        : this.safeCandidates().sort((a, c) => d(a, requested) - d(c, requested))[0];
      if (!destination || (!u.flying && !b.nav.connected(u, destination))) {
        if (u.autoGoal?.kind !== "rally" || !u.autoGoal.blocked)
          u.autoGoal = {
            x: u.x,
            y: u.y,
            kind: "rally",
            target: 0,
            phase: 0,
            label: "通路未连通，保持警戒",
            blocked: true,
          };
        return;
      }
      this.effectiveMuster = destination;
      const angle = u.id * 2.399963,
        r = 25 + Math.sqrt(u.id % 48) * 16;
      let q = { x: destination.x + Math.cos(angle) * r, y: destination.y + Math.sin(angle) * r };
      if (b.nav.obstacleAt(q.x, q.y) || (!u.flying && !b.nav.connected(q, destination)))
        q = { ...destination };
      u.autoGoal = {
        ...q,
        anchor: destination,
        kind: "rally",
        target: 0,
        phase: 0,
        label: d(u, q) < 30 ? "集结就绪" : "向安全区域集结",
      };
      return;
    }
    const plan = this.plans.get(`${u.front}:${lane}:${stance === "assault"}`)!;
    let goal = { ...plan.goal };
    // Units already inside a ring never walk back out to finish an old breach.
    const depth = { field: 0, outer: 1, inner: 2, core: 3 }[districtAt(u.x, u.y)];
    if (depth > goal.phase + 1 && goal.kind === "breach")
      goal = {
        x: 2000,
        y: 1800,
        kind: "advance",
        target: b.crystal.id,
        phase: depth,
        label: "沿已突破道路推进",
      };
    if (stance !== "assault" && (u.kind === "raider" || stance === "loot")) {
      const candidates = this.resources.filter(
        (s) => (s.front === u.front || d(s, u) < 850) && d(s, u) < 1600,
      );
      const accessible = candidates
        .map((s) => ({ s, p: this.groundApproach(s, u) }))
        .filter((v) => u.flying || v.p);
      accessible.sort((a, c) => d(a.s, u) - d(c.s, u));
      const retained =
        u.kind === "raider" && u.autoGoal?.kind === "raid"
          ? accessible.find((v) => v.s.id === u.autoGoal!.target)
          : undefined;
      const pick =
        retained ??
        (accessible.length > 1 && u.kind === "raider"
          ? accessible[Math.floor(u.id / 6) % Math.min(2, accessible.length)]
          : accessible[0]);
      if (pick && u.kind === "raider")
        goal = {
          x: pick.s.x,
          y: pick.s.y,
          kind: "raid",
          target: pick.s.id,
          phase: depth,
          label: "掠夺可到达的物资",
        };
      else if (pick && stance === "loot" && d(pick.s, u) < 900)
        goal = {
          x: pick.p?.x ?? pick.s.x,
          y: pick.p?.y ?? pick.s.y,
          kind: "escort",
          target: 0,
          phase: depth,
          label: "护卫掠夺队、清理威胁",
        };
    }
    if (["treant", "forest"].includes(u.kind)) {
      const main = this.allies.filter(
        (v) =>
          v.id !== u.id &&
          v.front === u.front &&
          !["raider", "treant", "forest"].includes(v.kind) &&
          d(v, u) < 800,
      );
      const hurt = main.filter((v) => v.hp / v.maxHp < 0.75).sort((a, c) => d(a, u) - d(c, u))[0];
      const leader =
        hurt ?? main.filter((v) => v.maxHp > 250).sort((a, c) => d(a, goal) - d(c, goal))[0];
      if (leader)
        goal = {
          x: leader.x,
          y: leader.y,
          kind: "escort",
          target: 0,
          phase: depth,
          label: "跟随主力、保护治疗",
        };
    }
    if (u.flying) {
      const valuable = [...this.towers, ...(stance === "assault" ? [] : this.resources)].filter(
        (s) => (s.front === u.front || d(s, u) < 800) && d(s, u) < 1500,
      );
      const value = (s: Structure) =>
        d(s, u) / (s.kind === "cannon" ? 2 : s.kind === "barracks" ? 1.5 : 1) +
        this.towers.filter((t) => t.kind === "antiAir" && d(t, s) < towerRange(t) + 50).length *
          650;
      const v = valuable.sort((a, c) => value(a) - value(c))[0];
      if (v)
        goal = {
          x: v.x,
          y: v.y,
          kind: v.resource ? "raid" : "advance",
          target: v.id,
          phase: depth,
          label: "空中压制高价值目标",
        };
      const risks = this.towers.filter(
        (s) =>
          s.kind === "antiAir" &&
          (d(s, goal) < towerRange(s) + 110 || segmentDistance(s, u, goal) < towerRange(s) + 70),
      );
      const aa = risks.sort((a, c) => d(a, u) - d(c, u))[0];
      if (aa) {
        const escort = this.allies.filter((v) => !v.flying && d(v, aa) < 320).length;
        if (escort >= 5 || aa.hp / aa.maxHp < 0.35)
          goal = {
            x: aa.x,
            y: aa.y,
            kind: "advance",
            target: aa.id,
            phase: depth,
            label: "协同地面压制防空",
          };
        else {
          const len = d(aa, FRONTS[u.front]) || 1,
            rr = towerRange(aa) + 110;
          goal = {
            x: aa.x + ((FRONTS[u.front].x - aa.x) / len) * rr,
            y: aa.y + ((FRONTS[u.front].y - aa.y) / len) * rr,
            kind: "air-cover",
            target: 0,
            phase: depth,
            label: "防空威胁：等待地面协同",
          };
        }
      }
    }
    // Stable goals survive several planning cycles; only death/phase/command changes replace them.
    if (
      u.autoGoal &&
      u.autoGoal.target === goal.target &&
      u.autoGoal.kind === goal.kind &&
      d(u.autoGoal, goal) < 50
    )
      return;
    u.autoGoal = goal;
    this.metrics.assignments++;
  }
  update() {
    const b = this.b;
    if (b.time < this.nextUpdate) return;
    this.nextUpdate = b.time + 1;
    this.metrics.updates++;
    this.allies = b.units.filter((u) => u.side === 0 && u.hp > 0);
    this.resources = b.structures.filter((s) => s.hp > 0 && s.resource);
    this.towers = b.structures.filter((s) => s.hp > 0 && military(s));
    this.localCells.clear();
    for (const s of b.structures)
      if (s.hp > 0)
        for (let y = Math.floor((s.y - s.h / 2) / 320); y <= Math.floor((s.y + s.h / 2) / 320); y++)
          for (
            let x = Math.floor((s.x - s.w / 2) / 320);
            x <= Math.floor((s.x + s.w / 2) / 320);
            x++
          ) {
            const k = `${x},${y}`,
              bucket = this.localCells.get(k);
            if (bucket) bucket.push(s);
            else this.localCells.set(k, [s]);
          }
    this.clusters.clear();
    const enemies = b.units.filter((u) => u.side === 1 && u.hp > 0);
    for (const e of enemies) this.clusters.set(e.id, enemies.filter((v) => d(v, e) < 90).length);
    for (const f of FRONT_KEYS)
      for (let lane = 0; lane < 2; lane++)
        for (const assault of [false, true]) this.plan(f, lane, assault);
    const managed = this.allies.filter((u) => u.control === "auto");
    if (managed.some((u) => this.stance(u) === "rally") && b.time >= this.nextDanger) {
      this.nextDanger = b.time + 3;
      b.nav.setDanger([
        ...this.towers
          .filter((s) => s.kind !== "antiAir")
          .map((s) => ({ ...s, radius: towerRange(s) + 50, weight: 25 })),
        ...enemies.map((e) => ({ ...e, radius: e.range + 100, weight: 8 })),
      ]);
    }
    for (const u of managed) this.assign(u);
    this.advice =
      b.remaining < 180
        ? "时间将尽 · 建议准备最终总攻（不会自动花钱或施法）"
        : [...this.plans.values()].some((p) => p.phase >= 2)
          ? "重要防线已打通 · 可集结援军或提前总攻"
          : b.money >= 600
            ? "物资充足 · 可购买援军，从安全前线继续部署"
            : "自动分路推进 · 主动技能仍由你掌控";
  }
}
