import { DIFFICULTY, ECONOMY, TOWERS as TOWER_STATS } from '../config/balance';
import { FACILITIES, NODES, TOWERS, WALLS } from '../config/mapData';
import { SAVE_SCHEMA_VERSION } from '../config/version';
import type { CampaignState, Difficulty, GameEvent, HumanFacilityState, TerritoryState, UnitStack, WallState } from './types';

export function emptyStack(): UnitStack {
  return { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0 };
}

export function createCampaign(difficulty: Difficulty, seed = 20261024): CampaignState {
  const cfg = DIFFICULTY[difficulty];
  const walls: WallState[] = WALLS.map((w) => ({
    id: w.id,
    x: w.x,
    y: w.y,
    len: w.len,
    dir: w.dir,
    kind: w.kind,
    hp: w.hp,
    maxHp: w.hp,
    destroyed: false,
  }));

  const human: HumanFacilityState[] = [
    ...FACILITIES.map((f) => ({
      id: f.id,
      kind: f.kind,
      name: f.name,
      hp: f.hp,
      maxHp: f.hp,
      destroyed: false,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      level: 1,
    })),
    ...TOWERS.map((t) => ({
      id: t.id,
      kind: 'tower' as const,
      towerKind: t.kind,
      name: TOWER_STATS[t.kind].name,
      hp: t.hp,
      maxHp: t.hp,
      destroyed: false,
      x: t.x,
      y: t.y,
      w: 2,
      h: 2,
      level: 1,
    })),
  ];

  const territories: TerritoryState[] = NODES.map((n) => ({
    id: n.id,
    name: n.name,
    owner: 'human',
    capturedOnDay: null,
    activeForDeploy: false,
  }));

  const state: CampaignState = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    seed,
    day: 1,
    maxDays: cfg.maxDays,
    difficulty,
    phase: 'council',
    resources: { corpses: ECONOMY.startCorpses, essence: ECONOMY.startEssence },
    inventory: { ...ECONOMY.startInventory },
    casualties: emptyStack(),
    kills: 0,
    converted: 0,
    throneLevel: 1,
    buildings: [
      {
        id: 'brood-start',
        kind: 'brood',
        slotId: 'slot-r3',
        level: 1,
        pendingLevel: null,
        destroyed: false,
        x: 80,
        y: 96,
      },
    ],
    human,
    walls,
    territories,
    towersBuilt: [],
    lighthouse: { hp: 12000, maxHp: 12000, charge: 0 },
    humanBudget: 0,
    humanSoldiers: 14,
    techLevel: 0,
    boss: { unlocked: false, woundedDay: null },
    finalAssaultTriggered: false,
    finalPreview: null,
    pending: [],
    ledger: [],
    flags: { dayAdvanced: false, introSeen: false, lastChance: false },
    stats: { deployed: 0, lost: 0, structuresDestroyed: 0, daysPlayed: 0, bestCharge: 0 },
  };
  pushEvent(state, { type: 'note', detail: '亡骸君主于古墓中苏醒，尸潮开始集结' });
  return state;
}

let eventId = 1;
export function pushEvent(state: CampaignState, e: Omit<GameEvent, 'id' | 'day'>): void {
  state.ledger.push({ ...e, id: eventId++, day: state.day });
  if (state.ledger.length > 400) state.ledger.splice(0, state.ledger.length - 400);
}

export function aliveFacilities(state: CampaignState): HumanFacilityState[] {
  return state.human.filter((f) => !f.destroyed && f.hp > 0);
}

export function powerStationsAlive(state: CampaignState): number {
  return state.human.filter((f) => f.kind === 'power' && !f.destroyed && f.hp > 0).length;
}

/** 不变量校验：用于存档读取与测试 */
export function validateState(state: CampaignState): string[] {
  const errs: string[] = [];
  if (!state || typeof state !== 'object') return ['state 不是对象'];
  if (state.schemaVersion !== SAVE_SCHEMA_VERSION) errs.push(`schemaVersion=${state.schemaVersion} 不受支持`);
  if (!Number.isFinite(state.day) || state.day < 1) errs.push('day 非法');
  for (const [k, v] of Object.entries(state.resources ?? {})) {
    if (!Number.isFinite(v) || v < 0) errs.push(`资源 ${k} 非法: ${v}`);
  }
  for (const [k, v] of Object.entries(state.inventory ?? {})) {
    if (!Number.isFinite(v) || v < 0) errs.push(`库存 ${k} 非法: ${v}`);
  }
  if (!Number.isFinite(state.lighthouse.charge) || state.lighthouse.charge < 0 || state.lighthouse.charge > 100) {
    errs.push('灯塔充能越界');
  }
  if (state.lighthouse.hp < 0 || state.lighthouse.hp > state.lighthouse.maxHp) errs.push('灯塔 HP 越界');
  for (const w of state.walls ?? []) {
    if (w.destroyed && w.hp > 0) errs.push(`墙段 ${w.id} 状态矛盾`);
  }
  if (!Array.isArray(state.ledger)) errs.push('账本缺失');
  return errs;
}

export function commandCapacity(state: CampaignState): number {
  return state.throneLevel === 1 ? 180 : state.throneLevel === 2 ? 300 : 450;
}

export function totalUnits(stack: UnitStack): number {
  return stack.zombie + stack.runner + stack.brute + stack.spider + stack.boss;
}
