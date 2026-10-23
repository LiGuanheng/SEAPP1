import { COMBAT, HUMAN_AI, HUMAN_UNITS, LORD, MAX_ACTIVE, TIMING, TOWERS, UNITS } from '../config/balance';
import { MAP_H, MAP_W, NODES, THRONE, TOWERS as TOWER_DEFS, ZONES, type NodeId } from '../config/mapData';
import type { CampaignState, HumanUnitType, TowerKind, UnitStack, UnitType } from '../core/types';
import { NavGrid, type FlowField } from './nav';

export type Side = 'undead' | 'human';

export interface SimUnit {
  id: number;
  side: Side;
  type: UnitType | HumanUnitType | 'lord';
  art: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dps: number;
  range: number;
  speed: number;
  radius: number;
  siege: number;
  command: number;
  cooldown: number;
  attackAnim: number;
  hitFlash: number;
  facing: 1 | -1;
  moving: boolean;
  dead: boolean;
  deathT: number;
  /** 玩家指定目标 */
  focusId: number | null;
  focusStructure: string | null;
  destX: number | null;
  destY: number | null;
  homeX: number;
  homeY: number;
  leash: number;
  retarget: number;
  stuckT: number;
  lastX: number;
  lastY: number;
  spawnT: number;
  targetId: number | null;
  targetStructure: string | null;
  /** Boss 蓄力技能冷却 */
  skill: number;
}

export interface SimStructure {
  id: string;
  name: string;
  kind: 'outer' | 'wall' | 'gate' | 'inner' | 'innerGate' | 'facility' | 'tower' | 'nodeCamp';
  facilityKind?: string;
  towerKind?: TowerKind;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  /** 塔的攻击冷却与朝向 */
  cooldown: number;
  angle: number;
  /** 墙段被摧毁时用于更新导航 */
  wallId?: string;
  activated?: number;
}

export type SimEvent =
  | { t: 'hit'; x: number; y: number; kind: 'blood' | 'spark' | 'wall' }
  | { t: 'shot'; x0: number; y0: number; x1: number; y1: number; kind: 'mg' | 'cannon' | 'holy' }
  | { t: 'blast'; x: number; y: number; r: number }
  | { t: 'death'; x: number; y: number; side: Side; art: string }
  | { t: 'spawn'; x: number; y: number; side: Side }
  | { t: 'wallBreak'; x: number; y: number; name: string }
  | { t: 'structureDown'; x: number; y: number; name: string; kind: string }
  | { t: 'capture'; node: NodeId; name: string }
  | { t: 'charge'; x: number; y: number }
  | { t: 'notice'; text: string };

export interface DeployResult {
  ok: boolean;
  count: number;
  reason?: 'NO_STOCK' | 'NO_COMMAND' | 'NOT_IN_ZONE' | 'BLOCKED' | 'PAUSED' | 'FINAL_FULL' | 'BOSS_WOUNDED';
  message?: string;
}

interface QueuedSpawn {
  type: UnitType | 'lord';
  x: number;
  y: number;
  at: number;
}

const ART: Record<string, string> = {
  zombie: 'zombie',
  runner: 'runner',
  brute: 'brute',
  spider: 'spider',
  boss: 'boss',
  lord: 'lord',
  infantry: 'infantry',
  gunner: 'gunner',
  sniper: 'sniper',
  paladin: 'paladin',
};

export interface SimOptions {
  state: CampaignState;
  final: boolean;
  seed: number;
  lowQuality: boolean;
}

export class BattleSim {
  readonly nav = new NavGrid();
  readonly units: SimUnit[] = [];
  readonly structures = new Map<string, SimStructure>();
  readonly events: SimEvent[] = [];
  readonly final: boolean;
  readonly day: number;
  readonly timeLimit: number;
  readonly maxActive: number;
  /** 玩家可部署的库存（战斗内可变，战斗结束后写回） */
  reserve: UnitStack;
  deployedTotal: UnitStack = { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0 };
  lostTotal: UnitStack = { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0 };
  kills = 0;
  converted = 0;
  captured: NodeId[] = [];
  lighthouseDamage = 0;
  commandUsed = 0;
  outcome: 'ongoing' | 'victory' | 'timeout' | 'retreat' | 'defeat' = 'ongoing';
  elapsed = 0;

  private nextId = 1;
  private unitById = new Map<number, SimUnit>();
  private rng: () => number;
  private queue: QueuedSpawn[] = [];
  private flows = new Map<string, FlowField>();
  private structAt = new Map<number, SimStructure>();
  private captureTimers = new Map<NodeId, number>();
  private state: CampaignState;
  bossDeployed = false;

  constructor(opts: SimOptions) {
    this.state = opts.state;
    this.final = opts.final;
    this.day = opts.state.day;
    this.timeLimit = opts.final ? TIMING.finalSeconds : TIMING.siegeSeconds;
    this.maxActive = opts.lowQuality
      ? opts.final
        ? MAX_ACTIVE.finalLow
        : MAX_ACTIVE.low
      : opts.final
        ? MAX_ACTIVE.final
        : MAX_ACTIVE.high;
    this.rng = mulberry32(opts.seed);
    this.reserve = { ...opts.state.inventory };
    if (opts.final) this.reserve.boss = Math.max(this.reserve.boss, opts.state.boss.unlocked ? 1 : 0);

    this.buildWorld();
    this.buildFlow('lighthouse');
    this.spawnGarrison();
    if (opts.final) this.spawnLord();
  }

  /* ---------------- 世界构建 ---------------- */

  private buildWorld(): void {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        this.nav.cost[i] = 1;
      }
    }
    // 基础地形代价
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        this.nav.setCost(x, y, 1);
      }
    }

    // 墙
    for (const w of this.state.walls) {
      const rect =
        w.dir === 'h'
          ? { x: w.x * 32, y: w.y * 32 + 6, w: w.len * 32, h: 30 }
          : { x: w.x * 32 + 6, y: w.y * 32, w: 30, h: w.len * 32 };
      const s: SimStructure = {
        id: w.id,
        name: w.kind === 'gate' ? '外城门' : w.kind === 'innerGate' ? '内城门' : w.kind === 'inner' ? '内墙' : '外墙',
        kind: w.kind,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        cx: rect.x + rect.w / 2,
        cy: rect.y + rect.h / 2,
        hp: w.hp,
        maxHp: w.maxHp,
        destroyed: w.destroyed,
        cooldown: 0,
        angle: 0,
        wallId: w.id,
      };
      this.structures.set(s.id, s);
      if (!w.destroyed) this.markWallBlocked(w, true);
    }

    // 人类设施
    for (const f of this.state.human) {
      const s: SimStructure = {
        id: f.id,
        name: f.name,
        kind: 'facility',
        facilityKind: f.kind,
        x: f.x * 32,
        y: f.y * 32,
        w: f.w * 32,
        h: f.h * 32,
        cx: (f.x + f.w / 2) * 32,
        cy: (f.y + f.h / 2) * 32,
        hp: f.hp,
        maxHp: f.maxHp,
        destroyed: f.destroyed,
        cooldown: 0,
        angle: 0,
      };
      this.structures.set(s.id, s);
      if (!f.destroyed) this.nav.setRect(f.x, f.y, f.w, f.h, 60);
    }

    // 防御塔（初始 + 玩家已摧毁的除外）
    for (const t of TOWER_DEFS) {
      const st = this.state.human.find((h) => h.id === t.id);
      const hp = st ? st.hp : t.hp;
      const destroyed = st ? st.destroyed : false;
      const s: SimStructure = {
        id: t.id,
        name: TOWERS[t.kind].name,
        kind: 'tower',
        towerKind: t.kind,
        x: t.x * 32 + 4,
        y: t.y * 32 + 4,
        w: 56,
        h: 56,
        cx: t.x * 32 + 16,
        cy: t.y * 32 + 16,
        hp,
        maxHp: t.hp,
        destroyed,
        cooldown: 0,
        angle: Math.PI / 2,
      };
      this.structures.set(s.id, s);
      if (!destroyed) this.nav.setRect(t.x, t.y, 2, 2, 60);
    }

    // 人类在战役中新建的塔（id 形如 ai-t3:mg）
    for (const raw of this.state.towersBuilt) {
      const [slotId, kindRaw] = raw.split(':');
      const slot = HUMAN_AI.towerSlots.find((t) => t.id === slotId);
      if (!slot) continue;
      const kind = (kindRaw === 'cannon' ? 'cannon' : 'mg') as TowerKind;
      const def = TOWERS[kind];
      this.structures.set(raw, {
        id: raw,
        name: def.name,
        kind: 'tower',
        towerKind: kind,
        x: slot.x * 32 + 4,
        y: slot.y * 32 + 4,
        w: 56,
        h: 56,
        cx: slot.x * 32 + 16,
        cy: slot.y * 32 + 16,
        hp: def.hp,
        maxHp: def.hp,
        destroyed: false,
        cooldown: 0,
        angle: Math.PI / 2,
      });
      this.nav.setRect(slot.x, slot.y, 2, 2, 60);
    }

    // 亡灵王座与建筑阻挡（单位会绕行）
    this.nav.setRect(78, 100, 5, 4, 60);
    this.state.buildings.forEach((b) => {
      if (!b.destroyed) this.nav.setRect(b.x - 1, b.y - 1, 3, 3, 60);
    });

    // 前线营地（守军由 spawnGarrison 生成）
    for (const n of NODES) {
      this.structures.set(`node-${n.id}`, {
        id: `node-${n.id}`,
        name: n.name,
        kind: 'nodeCamp',
        x: (n.x - 1) * 32,
        y: (n.y - 1) * 32,
        w: 96,
        h: 96,
        cx: n.x * 32,
        cy: n.y * 32,
        hp: 1,
        maxHp: 1,
        destroyed: false,
        cooldown: 0,
        angle: 0,
      });
    }

    // 建立"某格属于哪个建筑"索引
    for (const s of this.structures.values()) {
      if (s.kind === 'nodeCamp') continue;
      const x1 = Math.floor(s.x / 32);
      const y1 = Math.floor(s.y / 32);
      const x2 = Math.ceil((s.x + s.w) / 32);
      const y2 = Math.ceil((s.y + s.h) / 32);
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
          if (s.destroyed) continue;
          this.structAt.set(y * MAP_W + x, s);
        }
      }
    }
  }

  private markWallBlocked(w: { x: number; y: number; len: number; dir: 'h' | 'v' }, blocked: boolean): void {
    const cost = blocked ? 120 : 1;
    if (w.dir === 'h') this.nav.setRect(w.x, w.y, w.len, 1, cost);
    else this.nav.setRect(w.x, w.y, 1, w.len, cost);
  }

  private buildFlow(key: string): void {
    const target = this.objectiveTile(key);
    if (!target) return;
    this.flows.set(key, this.nav.buildFlow(target.x, target.y));
  }

  private objectiveTile(key: string): { x: number; y: number } | null {
    if (key === 'lighthouse') return { x: 84, y: 40 };
    if (key === 'throne') return { x: THRONE.x, y: THRONE.y };
    const s = this.structures.get(key);
    if (!s) return null;
    return { x: Math.floor(s.cx / 32), y: Math.floor(s.cy / 32) };
  }

  private rebuildFlows(): void {
    for (const key of Array.from(this.flows.keys())) this.buildFlow(key);
  }

  /* ---------------- 守军 ---------------- */

  private spawnGarrison(): void {
    const add = (type: HumanUnitType, x: number, y: number, leash: number) => {
      const def = HUMAN_UNITS[type];
      this.units.push(this.makeUnit({
        side: 'human',
        type,
        art: def.art,
        x,
        y,
        hp: def.hp,
        dps: def.dps,
        range: def.range,
        speed: def.speed,
        radius: def.radius,
        siege: 0.5,
        command: 0,
        leash,
        homeX: x,
        homeY: y,
      }));
    };

    // 军营驻军
    for (const f of this.state.human) {
      if (f.destroyed) continue;
      if (f.kind === 'barracks') {
        const cx = (f.x + f.w / 2) * 32;
        const cy = (f.y + f.h / 2) * 32;
        add('infantry', cx - 40, cy + 30, 320);
        add('infantry', cx + 40, cy + 30, 320);
        add('gunner', cx, cy + 60, 260);
      }
    }

    // 荒野守军按预算分配
    let budget = this.state.humanSoldiers;
    const rng = mulberry32(this.state.seed + this.day * 17);
    const posts: { x: number; y: number; type: HumanUnitType }[] = [
      { x: 80, y: 88, type: 'infantry' },
      { x: 72, y: 86, type: 'gunner' },
      { x: 88, y: 86, type: 'gunner' },
      { x: 60, y: 62, type: 'infantry' },
      { x: 104, y: 62, type: 'infantry' },
      { x: 84, y: 60, type: 'sniper' },
      { x: 78, y: 58, type: 'infantry' },
      { x: 90, y: 58, type: 'infantry' },
      { x: 74, y: 48, type: 'paladin' },
      { x: 92, y: 48, type: 'paladin' },
    ];
    let i = 0;
    while (budget > 0 && i < 40) {
      const p = posts[i % posts.length];
      const jitterX = (rng() - 0.5) * 70;
      const jitterY = (rng() - 0.5) * 50;
      add(p.type, p.x * 32 + jitterX, p.y * 32 + jitterY, 260);
      budget--;
      i++;
    }

    // 内城守备
    for (let k = 0; k < 3; k++) {
      add('gunner', 78 * 32 + k * 50, 52 * 32, 200);
      add('infantry', 82 * 32 + k * 40, 50 * 32, 220);
    }
    add('paladin', 84 * 32, 46 * 32, 240);
    add('sniper', 84 * 32, 44 * 32, 160);

    // 前线营地守军
    for (const n of NODES) {
      const territory = this.state.territories.find((t) => t.id === n.id);
      if (!territory || territory.owner === 'undead') continue;
      for (let g = 0; g < n.guards; g++) {
        const a = (g / n.guards) * Math.PI * 2;
        add(g % 2 === 0 ? 'infantry' : 'gunner', n.x * 32 + Math.cos(a) * 60, n.y * 32 + Math.sin(a) * 45, 240);
      }
    }
  }

  private spawnLord(): void {
    const x = THRONE.x * 32;
    const y = (THRONE.y - 2) * 32;
    this.units.push(
      this.makeUnit({
        side: 'undead',
        type: 'lord',
        art: 'lord',
        x,
        y,
        hp: LORD.hp,
        dps: LORD.dps,
        range: LORD.range,
        speed: LORD.speed,
        radius: LORD.radius,
        siege: LORD.siege,
        command: 0,
        leash: 4000,
        homeX: x,
        homeY: y,
      }),
    );
    this.events.push({ t: 'notice', text: '君主化身降临战场' });
  }

  private makeUnit(p: {
    side: Side;
    type: UnitType | HumanUnitType | 'lord';
    art: string;
    x: number;
    y: number;
    hp: number;
    dps: number;
    range: number;
    speed: number;
    radius: number;
    siege: number;
    command: number;
    leash: number;
    homeX: number;
    homeY: number;
  }): SimUnit {
    const unit: SimUnit = {
      id: this.nextId++,
      side: p.side,
      type: p.type,
      art: p.art,
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.hp,
      dps: p.dps,
      range: p.range,
      speed: p.speed,
      radius: p.radius,
      siege: p.siege,
      command: p.command,
      cooldown: 0,
      attackAnim: 0,
      hitFlash: 0,
      facing: 1,
      moving: false,
      dead: false,
      deathT: 0,
      focusId: null,
      focusStructure: null,
      destX: null,
      destY: null,
      homeX: p.homeX,
      homeY: p.homeY,
      leash: p.leash,
      retarget: Math.random() * COMBAT.retargetInterval,
      stuckT: 0,
      lastX: p.x,
      lastY: p.y,
      spawnT: 0,
      targetId: null,
      targetStructure: null,
      skill: 6,
    };
    this.unitById.set(unit.id, unit);
    return unit;
  }

  /* ---------------- 部署 ---------------- */

  canDeploy(type: UnitType, wx: number, wy: number): DeployResult {
    if (this.outcome !== 'ongoing') return { ok: false, count: 0, reason: 'PAUSED', message: '战斗已结束' };
    if (this.reserve[type] <= 0) return { ok: false, count: 0, reason: 'NO_STOCK', message: `${UNITS[type].name}库存不足` };
    if (type === 'boss' && this.state.boss.woundedDay === this.day) {
      return { ok: false, count: 0, reason: 'BOSS_WOUNDED', message: '斧头巨汉正在休整，明日才能出战' };
    }
    const zoneOk = this.zoneAt(wx, wy);
    if (!zoneOk) return { ok: false, count: 0, reason: 'NOT_IN_ZONE', message: '此处不在合法部署区（未被占领或未连通）' };
    if (this.nav.blockedAtWorld(wx, wy) || this.structAt.has(this.tileIndexAt(wx, wy))) {
      return { ok: false, count: 0, reason: 'BLOCKED', message: '该位置被墙体或建筑占据' };
    }
    const cost = UNITS[type].command;
    const cap = this.commandCap();
    let count = Math.min(UNITS[type].batch, this.reserve[type]);
    if (!this.final) {
      const remaining = cap - this.commandUsed;
      count = Math.min(count, Math.floor(remaining / cost));
      if (count <= 0) return { ok: false, count: 0, reason: 'NO_COMMAND', message: `统御不足（需要 ${cost}，剩余 ${Math.max(0, remaining)}）` };
    }
    if (type === 'boss' && this.bossDeployed) {
      return { ok: false, count: 0, reason: 'NO_STOCK', message: '本场已部署过斧头巨汉' };
    }
    return { ok: true, count };
  }

  deploy(type: UnitType, wx: number, wy: number): DeployResult {
    const check = this.canDeploy(type, wx, wy);
    if (!check.ok) return check;
    const count = check.count;
    this.reserve[type] -= count;
    this.deployedTotal[type] += count;
    this.commandUsed += UNITS[type].command * count;
    if (type === 'boss') this.bossDeployed = true;
    const spread = UNITS[type].radius * 2.4 + Math.sqrt(count) * 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const rr = count === 1 ? 0 : spread * Math.sqrt(i / count);
      this.queue.push({
        type,
        x: wx + Math.cos(a) * rr,
        y: wy + Math.sin(a) * rr * 0.6,
        at: this.elapsed + (i / Math.max(1, count)) * TIMING.deploySpreadSeconds,
      });
    }
    return { ok: true, count };
  }

  private commandCap(): number {
    return this.state.throneLevel === 1 ? 180 : this.state.throneLevel === 2 ? 300 : 450;
  }

  zoneAt(wx: number, wy: number): boolean {
    const zones: { x: number; y: number; r: number }[] = [ZONES.throne];
    for (const t of this.state.territories) {
      if (t.owner === 'undead' && t.activeForDeploy) zones.push(ZONES[t.id]);
    }
    for (const z of zones) {
      const dx = wx - z.x * 32;
      const dy = wy - z.y * 32;
      if (Math.hypot(dx, dy * 1.35) <= z.r) return true;
    }
    return false;
  }

  zoneAtTile(tx: number, ty: number): boolean {
    return this.zoneAt(tx * 32 + 16, ty * 32 + 16);
  }

  /* ---------------- 指挥 ---------------- */

  setDestination(ids: number[], wx: number, wy: number): void {
    for (const id of ids) {
      const u = this.units.find((v) => v.id === id && !v.dead);
      if (!u || u.side !== 'undead') continue;
      u.destX = wx;
      u.destY = wy;
      u.focusId = null;
      u.focusStructure = null;
    }
  }

  focusTarget(ids: number[], targetUnitId?: number, targetStructureId?: string): void {
    for (const id of ids) {
      const u = this.units.find((v) => v.id === id && !v.dead);
      if (!u || u.side !== 'undead') continue;
      u.focusId = targetUnitId ?? null;
      u.focusStructure = targetStructureId ?? null;
      u.destX = null;
      u.destY = null;
    }
  }

  /** 选一个合法且未被占据的投放点（用于全军冲锋自动投兵） */
  private pickDeployPoint(): { x: number; y: number } | null {
    const zones = [ZONES.throne, ...this.state.territories.filter((t) => t.owner === 'undead' && t.activeForDeploy).map((t) => ZONES[t.id])];
    for (let attempt = 0; attempt < 30; attempt++) {
      const z = zones[Math.floor(this.rng() * zones.length)];
      const a = this.rng() * Math.PI * 2;
      const r = Math.sqrt(this.rng()) * z.r * 0.85;
      const x = z.x * 32 + Math.cos(a) * r;
      const y = z.y * 32 + Math.sin(a) * r * 0.65;
      if (this.nav.blockedAtWorld(x, y)) continue;
      if (this.structAt.has(this.tileIndexAt(x, y))) continue;
      return { x, y };
    }
    return null;
  }

  /** 全军冲锋：把剩余库存分批自动投入，并解除各单位锁定目标 */
  allOutCharge(): { deployed: number } {
    const order: UnitType[] = ['zombie', 'runner', 'brute', 'spider', 'boss'];
    let total = 0;
    for (const t of order) {
      let guard = 0;
      while (this.reserve[t] > 0 && guard++ < 60) {
        const p = this.pickDeployPoint();
        if (!p) break;
        const r = this.deploy(t, p.x, p.y);
        if (!r.ok || r.count === 0) break;
        total += r.count;
      }
    }
    this.chargeAll();
    return { deployed: total };
  }

  chargeAll(): void {
    for (const u of this.units) {
      if (u.side !== 'undead' || u.dead) continue;
      u.focusId = null;
      u.focusStructure = null;
      u.destX = null;
      u.destY = null;
    }
  }

  /* ---------------- 主循环 ---------------- */

  update(dt: number): void {
    if (this.outcome !== 'ongoing') return;
    this.elapsed += dt;
    this.spawnQueued();
    this.rebuildBuckets();
    const doRetarget = false;

    for (const u of this.units) {
      if (u.dead) {
        if (u.deathT > 0) u.deathT -= dt;
        continue;
      }
      if (u.spawnT > 0) {
        u.spawnT -= dt;
        continue;
      }
      if (u.hitFlash > 0) u.hitFlash -= dt;
      if (u.attackAnim > 0) u.attackAnim -= dt;
      if (u.cooldown > 0) u.cooldown -= dt;
      u.retarget -= dt;
      if (u.retarget <= 0) {
        u.retarget = 0.3 + (u.id % 5) * 0.04;
        if (u.side === 'undead') this.acquireTarget(u);
        else this.acquireHumanTarget(u);
      }
      if (u.side === 'undead') this.updateUndead(u, dt, doRetarget);
      else this.updateHuman(u, dt, doRetarget);
    }

    this.updateTowers(dt);
    this.updateCapture(dt);
    this.cleanup();
    this.checkEnd();
  }

  private spawnQueued(): void {
    while (this.queue.length > 0 && this.queue[0].at <= this.elapsed) {
      const q = this.queue.shift()!;
      const def = q.type === 'lord' ? LORD : UNITS[q.type as UnitType];
      const active = this.activeCount();
      if (active >= this.maxActive) {
        this.queue.unshift({ ...q, at: this.elapsed + 0.5 });
        break;
      }
      const unit = this.makeUnit({
        side: 'undead',
        type: q.type,
        art: q.type === 'lord' ? 'lord' : ART[q.type],
        x: q.x,
        y: q.y,
        hp: def.hp,
        dps: def.dps,
        range: def.range,
        speed: def.speed,
        radius: 'radius' in def ? def.radius : q.type === 'lord' ? LORD.radius : 10,
        siege: def.siege,
        command: 'command' in def ? def.command : 0,
        leash: 6000,
        homeX: q.x,
        homeY: q.y,
      });
      unit.spawnT = 0.15;
      this.units.push(unit);
      this.events.push({ t: 'spawn', x: q.x, y: q.y, side: 'undead' });
    }
  }

  private activeCount(): number {
    let n = 0;
    for (const u of this.units) if (!u.dead) n++;
    return n;
  }

  private updateUndead(u: SimUnit, dt: number, doRetarget: boolean): void {
    // 斧头巨汉：每 22 秒一次蓄力劈砸，对周围建筑造成范围破坏
    if (u.type === 'boss') {
      u.skill -= dt;
      if (u.skill <= 0) {
        let hit = 0;
        for (const s of this.structures.values()) {
          if (s.destroyed || s.kind === 'nodeCamp') continue;
          if (this.distToStructure(u, s) > 150) continue;
          this.damageStructure(s, 420 * u.siege, u);
          hit++;
        }
        if (hit > 0) {
          u.skill = 22;
          u.attackAnim = 0.5;
          this.events.push({ t: 'blast', x: u.x, y: u.y - 20, r: 150 });
          this.events.push({ t: 'notice', text: '斧头巨汉蓄力劈砸！' });
        } else {
          u.skill = 0.5;
        }
      }
    }
    if (doRetarget && u.focusId === null && u.focusStructure === null) this.acquireTarget(u);

    // 攻击判定
    const focusUnit = u.focusId !== null ? this.unitById.get(u.focusId) : null;
    const targetUnit = focusUnit && !focusUnit.dead && focusUnit.side === 'human' ? focusUnit : null;
    const targetStruct = u.focusStructure ? this.structures.get(u.focusStructure) : null;
    const struct = targetStruct && !targetStruct.destroyed ? targetStruct : null;

    if (targetUnit) {
      const d = Math.hypot(targetUnit.x - u.x, targetUnit.y - u.y);
      if (d <= u.range + targetUnit.radius) {
        u.moving = false;
        this.attackUnit(u, targetUnit, dt);
        return;
      }
      this.stepToward(u, targetUnit.x, targetUnit.y, dt);
      return;
    }
    if (struct) {
      const d = this.distToStructure(u, struct);
      if (d <= u.range + 6) {
        u.moving = false;
        this.attackStructure(u, struct, dt);
        return;
      }
      this.stepToward(u, struct.cx, struct.cy, dt);
      return;
    }

    // 自动索敌（近处敌人）
    if (u.targetId !== null) {
      const t0 = this.unitById.get(u.targetId);
      const t = t0 && !t0.dead && t0.side === 'human' ? t0 : null;
      if (t) {
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d <= u.range + t.radius) {
          u.moving = false;
          this.attackUnit(u, t, dt);
          return;
        }
        this.stepToward(u, t.x, t.y, dt);
        return;
      }
    }
    if (u.targetStructure) {
      const s = this.structures.get(u.targetStructure);
      if (s && !s.destroyed) {
        const d = this.distToStructure(u, s);
        if (d <= u.range + 6) {
          u.moving = false;
          this.attackStructure(u, s, dt);
          return;
        }
        this.stepToward(u, s.cx, s.cy, dt);
        return;
      }
    }

    // 玩家指定移动点
    if (u.destX !== null && u.destY !== null) {
      const d = Math.hypot(u.destX - u.x, u.destY - u.y);
      if (d < 24) {
        u.destX = null;
        u.destY = null;
      } else {
        this.stepToward(u, u.destX, u.destY, dt);
        return;
      }
    }

    // 沿流场推进；若前方是墙体/建筑则攻击它
    const flow = this.flows.get('lighthouse');
    if (flow) {
      const tx = Math.floor(u.x / 32);
      const ty = Math.floor(u.y / 32);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) {
        const i = ty * MAP_W + tx;
        const gx = flow.dx[i];
        const gy = flow.dy[i];
        if (gx !== 0 || gy !== 0) {
          const ahead = this.structAt.get((ty + gy) * MAP_W + (tx + gx));
          if (ahead && !ahead.destroyed && this.distToStructure(u, ahead) <= u.range + 16) {
            this.attackStructure(u, ahead, dt);
            return;
          }
        }
        // 已站在障碍旁但无梯度：直接攻击阻挡物
        const here = this.structAt.get(i);
        if (here && !here.destroyed && this.distToStructure(u, here) <= u.range + 6) {
          this.attackStructure(u, here, dt);
          return;
        }
        if (gx !== 0 || gy !== 0) {
          const lane = ((u.id * 37) % 11) - 5;
          const px = -gy * lane * 6;
          const py = gx * lane * 6;
          this.stepToward(u, u.x + gx * 48 + px, u.y + gy * 48 + py, dt);
        }
      }
    }

    // 被阻挡：攻击前方建筑
    if (u.stuckT > 0.6) {
      const ahead = this.structAt.get(this.tileIndexAt(u.x + u.facing * 20, u.y));
      if (ahead && !ahead.destroyed) {
        u.targetStructure = ahead.id;
        u.stuckT = 0;
      }
    }
  }

  private updateHuman(u: SimUnit, dt: number, doRetarget: boolean): void {
    if (doRetarget) this.acquireHumanTarget(u);
    if (u.targetId !== null) {
      const t0 = this.unitById.get(u.targetId);
      const t = t0 && !t0.dead && t0.side === 'undead' ? t0 : null;
      if (t) {
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d <= u.range + t.radius) {
          u.moving = false;
          this.attackUnit(u, t, dt);
          return;
        }
        const fromHome = Math.hypot(t.x - u.homeX, t.y - u.homeY);
        if (fromHome <= u.leash) {
          this.stepToward(u, t.x, t.y, dt);
          return;
        }
      }
    }
    // 回到驻守点
    const dh = Math.hypot(u.homeX - u.x, u.homeY - u.y);
    if (dh > 12) this.stepToward(u, u.homeX, u.homeY, dt);
    else u.moving = false;
  }

  private acquireTarget(u: SimUnit): void {
    let best: SimUnit | null = null;
    let bestScore = Infinity;
    for (const v of this.units) {
      if (v.dead || v.side !== 'human') continue;
      const d = Math.hypot(v.x - u.x, v.y - u.y);
      if (d > COMBAT.aggroRange) continue;
      let score = d;
      if (u.type === 'runner') {
        if (v.type === 'sniper') score *= 0.45;
        else if (v.type === 'gunner') score *= 0.6;
        else if (v.type === 'paladin') score *= 2.2;
      } else if (u.type === 'brute' || u.type === 'boss') {
        score = d * 1.8;
      }
      if (score < bestScore) {
        bestScore = score;
        best = v;
      }
    }
    u.targetId = best ? best.id : null;
    u.targetStructure = null;

    if (!best) {
      // 附近没有活人：寻找可攻击的建筑（重装/巨汉优先）
      if (u.type === 'brute' || u.type === 'boss') {
        let bs: SimStructure | null = null;
        let bd = Infinity;
        for (const s of this.structures.values()) {
          if (s.destroyed || s.kind === 'nodeCamp') continue;
          const d = this.distToStructure(u, s);
          if (d < 220 && d < bd) {
            bd = d;
            bs = s;
          }
        }
        if (bs) u.targetStructure = bs.id;
      } else if (u.type === 'spider') {
        let bs: SimStructure | null = null;
        let bd = Infinity;
        for (const s of this.structures.values()) {
          if (s.destroyed || s.kind !== 'tower') continue;
          const d = this.distToStructure(u, s);
          if (d < 320 && d < bd) {
            bd = d;
            bs = s;
          }
        }
        if (bs) u.targetStructure = bs.id;
      }
    }
  }

  private acquireHumanTarget(u: SimUnit): void {
    let best: SimUnit | null = null;
    let bestD = Infinity;
    const range = u.range + (u.type === 'sniper' ? 120 : 60);
    for (const v of this.units) {
      if (v.dead || v.side !== 'undead') continue;
      const d = Math.hypot(v.x - u.x, v.y - u.y);
      if (d > range) continue;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    u.targetId = best ? best.id : null;
  }

  private distToStructure(u: SimUnit, s: SimStructure): number {
    const nx = Math.max(s.x, Math.min(s.x + s.w, u.x));
    const ny = Math.max(s.y, Math.min(s.y + s.h, u.y));
    return Math.hypot(u.x - nx, u.y - ny);
  }

  private tileIndexAt(wx: number, wy: number): number {
    const tx = Math.floor(wx / 32);
    const ty = Math.floor(wy / 32);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return -1;
    return ty * MAP_W + tx;
  }

  private stepToward(u: SimUnit, tx: number, ty: number, dt: number): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    let vx = (dx / len) * u.speed;
    let vy = (dy / len) * u.speed;
    // 分离力
    const sep = this.separation(u);
    vx += sep.x * u.speed * COMBAT.separationStrength;
    vy += sep.y * u.speed * COMBAT.separationStrength;
    const nx = u.x + vx * dt;
    const ny = u.y + vy * dt;
    if (!this.nav.blockedAtWorld(nx, ny)) {
      u.x = nx;
      u.y = ny;
    } else {
      // 贴墙滑动
      if (!this.nav.blockedAtWorld(nx, u.y)) u.x = nx;
      else if (!this.nav.blockedAtWorld(u.x, ny)) u.y = ny;
      u.stuckT += dt;
    }
    u.moving = true;
    if (Math.abs(vx) > 1) u.facing = vx > 0 ? 1 : -1;
    u.x = Math.max(8, Math.min(MAP_W * 32 - 8, u.x));
    u.y = Math.max(8, Math.min(MAP_H * 32 - 8, u.y));
  }

  private sepBuckets = new Map<number, number[]>();

  private separation(u: SimUnit): { x: number; y: number } {
    const bx = Math.floor(u.x / 64);
    const by = Math.floor(u.y / 64);
    let sx = 0;
    let sy = 0;
    for (let yy = by - 1; yy <= by + 1; yy++) {
      for (let xx = bx - 1; xx <= bx + 1; xx++) {
        const bucket = this.sepBuckets.get(yy * 1000 + xx);
        if (!bucket) continue;
        for (const id of bucket) {
          if (id === u.id) continue;
          const o = this.unitById.get(id);
          if (!o || o.dead) continue;
          const dx = u.x - o.x;
          const dy = u.y - o.y;
          const d2 = dx * dx + dy * dy;
          const min = u.radius + o.radius;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = (min - d) / min;
            sx += (dx / d) * push;
            sy += (dy / d) * push;
          }
        }
      }
    }
    return { x: sx, y: sy };
  }

  private rebuildBuckets(): void {
    this.sepBuckets.clear();
    for (const u of this.units) {
      if (u.dead) continue;
      const bx = Math.floor(u.x / 64);
      const by = Math.floor(u.y / 64);
      const key = by * 1000 + bx;
      let arr = this.sepBuckets.get(key);
      if (!arr) {
        arr = [];
        this.sepBuckets.set(key, arr);
      }
      arr.push(u.id);
    }
  }

  private attackUnit(u: SimUnit, target: SimUnit, dt: number): void {
    if (u.cooldown > 0) return;
    const interval = u.type === 'boss' ? 0.7 : 0.6;
    u.cooldown = interval;
    u.attackAnim = 0.35;
    const dmg = u.dps * interval;
    target.hp -= dmg;
    target.hitFlash = 0.15;
    this.events.push({ t: 'hit', x: target.x, y: target.y - 20, kind: target.side === 'human' ? 'blood' : 'blood' });
    if (target.hp <= 0) this.killUnit(target, u);
    void dt;
  }

  private killUnit(target: SimUnit, killer: SimUnit): void {
    target.dead = true;
    target.deathT = 1.4;
    this.events.push({ t: 'death', x: target.x, y: target.y, side: target.side, art: target.art });
    if (target.side === 'human') {
      this.kills++;
      // 转化判定
      if (this.converted < COMBAT.conversionCap && this.converted < this.kills && this.rng() < COMBAT.conversionChance) {
        this.converted++;
        const def = UNITS.zombie;
        const z = this.makeUnit({
          side: 'undead',
          type: 'zombie',
          art: 'zombie',
          x: target.x,
          y: target.y,
          hp: def.hp,
          dps: def.dps,
          range: def.range,
          speed: def.speed,
          radius: def.radius,
          siege: def.siege,
          command: 0,
          leash: 6000,
          homeX: target.x,
          homeY: target.y,
        });
        z.spawnT = 0.6;
        this.units.push(z);
        this.deployedTotal.zombie += 1;
      }
    } else {
      const t = target.type as UnitType;
      if (t in this.lostTotal) this.lostTotal[t] += 1;
      this.commandUsed = Math.max(0, this.commandUsed - target.command);
      if (t === 'boss') {
        this.state.boss.woundedDay = this.day;
        this.events.push({ t: 'notice', text: '斧头巨汉重伤，明日休整' });
      }
    }
    void killer;
  }

  private attackStructure(u: SimUnit, s: SimStructure, dt: number): void {
    if (u.cooldown > 0) return;
    const interval = u.type === 'boss' ? 2.2 : 0.8;
    u.cooldown = interval;
    u.attackAnim = 0.35;
    const base = u.dps * interval * u.siege;
    this.damageStructure(s, base, u);
    this.events.push({ t: 'hit', x: u.x + u.facing * 14, y: u.y - 22, kind: 'wall' });
    void dt;
  }

  damageStructure(s: SimStructure, dmg: number, source?: SimUnit): void {
    if (s.destroyed) return;
    s.hp -= dmg;
    // 同步回战役状态，便于 UI / 战报 / 次日结算
    if (s.wallId) {
      const w = this.state.walls.find((v) => v.id === s.wallId);
      if (w) w.hp = Math.max(0, s.hp);
    } else {
      const f = this.state.human.find((v) => v.id === s.id);
      if (f) f.hp = Math.max(0, s.hp);
    }
    if (s.facilityKind === 'lighthouse') this.lighthouseDamage = Math.min(s.maxHp, this.lighthouseDamage + dmg);
    if (s.hp <= 0) {
      s.hp = 0;
      s.destroyed = true;
      this.events.push({
        t: 'structureDown',
        x: s.cx,
        y: s.cy,
        name: s.name,
        kind: s.kind,
      });
      if (s.wallId) {
        const wall = this.state.walls.find((w) => w.id === s.wallId);
        if (wall) {
          wall.destroyed = true;
          wall.hp = 0;
          this.markWallBlocked(wall, false);
          for (const [k, v] of this.structAt) if (v.id === s.id) this.structAt.delete(k);
          this.rebuildFlows();
        }
        this.events.push({ t: 'wallBreak', x: s.cx, y: s.cy, name: s.name });
      } else if (s.kind === 'facility' || s.kind === 'tower') {
        // 移除该建筑的格子阻挡
        const x1 = Math.floor(s.x / 32);
        const y1 = Math.floor(s.y / 32);
        const x2 = Math.ceil((s.x + s.w) / 32);
        const y2 = Math.ceil((s.y + s.h) / 32);
        for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) this.nav.setCost(x, y, 1);
        for (const [k, v] of this.structAt) if (v.id === s.id) this.structAt.delete(k);
        this.rebuildFlows();
      }
      if (source) void source;
    }
  }

  private updateTowers(dt: number): void {
    const powerAlive = this.state.human.some((h) => h.kind === 'power' && !h.destroyed && h.hp > 0);
    for (const s of this.structures.values()) {
      if (s.kind !== 'tower' || s.destroyed || !s.towerKind) continue;
      const def = TOWERS[s.towerKind];
      if (s.towerKind === 'holy' && !powerAlive) continue;
      s.cooldown -= dt;
      if (s.cooldown > 0) continue;
      let target: SimUnit | null = null;
      let bestD = Infinity;
      for (const u of this.units) {
        if (u.dead || u.side !== 'undead') continue;
        const d = Math.hypot(u.x - s.cx, u.y - s.cy);
        if (d <= def.range && d < bestD) {
          bestD = d;
          target = u;
        }
      }
      if (!target) continue;
      s.cooldown = def.interval;
      s.angle = Math.atan2(target.y - s.cy, target.x - s.cx);
      let dmg = def.dps * def.interval;
      if (s.towerKind === 'aa') dmg *= 0.5;
      if (s.towerKind === 'holy') dmg *= 1 + this.state.techLevel * 0.1;
      if (s.towerKind === 'cannon') {
        this.events.push({ t: 'shot', x0: s.cx, y0: s.cy - 30, x1: target.x, y1: target.y, kind: 'cannon' });
        this.events.push({ t: 'blast', x: target.x, y: target.y, r: 62 });
        for (const u of this.units) {
          if (u.dead || u.side !== 'undead') continue;
          const d = Math.hypot(u.x - target.x, u.y - target.y);
          if (d <= 62) {
            u.hp -= dmg;
            u.hitFlash = 0.15;
            if (u.hp <= 0) this.killUnit(u, u);
          }
        }
      } else {
        this.events.push({ t: 'shot', x0: s.cx, y0: s.cy - 24, x1: target.x, y1: target.y, kind: s.towerKind === 'holy' ? 'holy' : 'mg' });
        target.hp -= dmg;
        target.hitFlash = 0.12;
        if (target.hp <= 0) this.killUnit(target, target);
      }
    }
  }

  private updateCapture(dt: number): void {
    for (const n of NODES) {
      const t = this.state.territories.find((v) => v.id === n.id);
      if (!t || t.owner === 'undead') continue;
      const hx = n.x * 32;
      const hy = n.y * 32;
      const radius = n.radius * 32;
      let enemy = 0;
      let ally = 0;
      for (const u of this.units) {
        if (u.dead) continue;
        const d = Math.hypot(u.x - hx, u.y - hy);
        if (d > radius) continue;
        if (u.side === 'human') enemy++;
        else ally++;
      }
      if (enemy === 0 && ally > 0) {
        const cur = (this.captureTimers.get(n.id) ?? 0) + dt;
        this.captureTimers.set(n.id, cur);
        if (cur >= TIMING.captureSeconds) {
          t.owner = 'undead';
          t.capturedOnDay = this.day;
          t.activeForDeploy = false;
          this.captured.push(n.id);
          this.state.resources.corpses += n.reward.corpses;
          this.state.resources.essence += n.reward.essence;
          this.events.push({ t: 'capture', node: n.id, name: n.name });
        }
      } else {
        this.captureTimers.set(n.id, Math.max(0, (this.captureTimers.get(n.id) ?? 0) - dt * 1.5));
      }
    }
  }

  private cleanup(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead && u.deathT <= 0) {
        this.units.splice(i, 1);
        this.unitById.delete(u.id);
      }
    }
  }

  private checkEnd(): void {
    const lh = this.structures.get('lighthouse');
    if (lh && lh.hp <= 0) {
      this.outcome = 'victory';
      return;
    }
    if (this.elapsed >= this.timeLimit) {
      this.outcome = this.final ? 'defeat' : 'timeout';
    }
  }

  /* ---------------- 结束与统计 ---------------- */

  retreat(): void {
    if (this.outcome !== 'ongoing') return;
    this.outcome = 'retreat';
  }

  /** 存活单位返还库存 */
  survivors(): UnitStack {
    const out: UnitStack = { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0 };
    if (this.outcome === 'victory' || this.outcome === 'timeout' || this.outcome === 'retreat') {
      for (const u of this.units) {
        if (u.dead || u.side !== 'undead') continue;
        const t = u.type as UnitType;
        if (t in out) out[t] += 1;
      }
    }
    return out;
  }

  facilityHp(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of this.structures.values()) {
      if (s.kind === 'facility' || s.kind === 'tower') out[s.id] = Math.max(0, Math.round(s.hp));
    }
    return out;
  }

  wallHp(): Record<string, { hp: number; destroyed: boolean }> {
    const out: Record<string, { hp: number; destroyed: boolean }> = {};
    for (const s of this.structures.values()) {
      if (s.wallId) out[s.wallId] = { hp: Math.max(0, Math.round(s.hp)), destroyed: s.destroyed };
    }
    return out;
  }

  destroyedStructures(): SimStructure[] {
    return Array.from(this.structures.values()).filter((s) => s.destroyed && s.kind !== 'nodeCamp' && s.kind !== 'wall');
  }

  /** 供 UI 显示：当前统御占用 */
  commandInfo(): { used: number; cap: number } {
    return { used: Math.round(this.commandUsed), cap: this.commandCap() };
  }

  aliveUndead(): number {
    return this.units.filter((u) => !u.dead && u.side === 'undead').length;
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


