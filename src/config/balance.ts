import type { Difficulty, HumanUnitType, NodeId, TowerKind, UndeadBuildKind, UnitType } from '../core/types';

export interface UnitDef {
  key: UnitType;
  name: string;
  en: string;
  hp: number;
  dps: number;
  speed: number;
  range: number;
  radius: number;
  command: number;
  batch: number;
  /** 对建筑与墙体的伤害倍率 */
  siege: number;
  prefer: 'nearest' | 'ranged' | 'structure' | 'tower';
  desc: string;
  art: 'zombie' | 'runner' | 'brute' | 'spider' | 'boss';
}

export const UNITS: Record<UnitType, UnitDef> = {
  zombie: {
    key: 'zombie',
    name: '食尸鬼',
    en: 'Ghoul',
    hp: 60,
    dps: 6,
    speed: 58,
    range: 26,
    radius: 9,
    command: 1,
    batch: 30,
    siege: 1,
    prefer: 'nearest',
    desc: '廉价、成群。以数量淹没防线，也能缓慢拆墙。',
    art: 'zombie',
  },
  runner: {
    key: 'runner',
    name: '疾行者',
    en: 'Runner',
    hp: 45,
    dps: 9,
    speed: 100,
    range: 24,
    radius: 8,
    command: 2,
    batch: 12,
    siege: 0.6,
    prefer: 'ranged',
    desc: '高速突袭，优先撕开远程守军与炮塔。惧怕范围火力。',
    art: 'runner',
  },
  brute: {
    key: 'brute',
    name: '重装感染者',
    en: 'Brute',
    hp: 420,
    dps: 18,
    speed: 34,
    range: 30,
    radius: 16,
    command: 6,
    batch: 4,
    siege: 2.5,
    prefer: 'structure',
    desc: '缓慢的攻城锤。对墙门造成 2.5 倍破坏，能硬吃机枪。',
    art: 'brute',
  },
  spider: {
    key: 'spider',
    name: '蛛行者',
    en: 'Spider',
    hp: 85,
    dps: 11,
    speed: 82,
    range: 24,
    radius: 11,
    command: 3,
    batch: 8,
    siege: 0.8,
    prefer: 'tower',
    desc: '侧翼猎手。优先攀向炮塔与后方设施，正面攻坚较弱。',
    art: 'spider',
  },
  boss: {
    key: 'boss',
    name: '斧头巨汉',
    en: 'Axe Brute',
    hp: 2500,
    dps: 90,
    speed: 40,
    range: 46,
    radius: 26,
    command: 10,
    batch: 1,
    siege: 3.2,
    prefer: 'structure',
    desc: '战争机器。一斧撕开城墙，也能承受成吨火力。',
    art: 'boss',
  },
};

/** 终局君主化身 */
export const LORD = {
  hp: 4200,
  dps: 120,
  speed: 66,
  range: 150,
  radius: 22,
  command: 0,
  siege: 2.4,
  art: 'lord' as const,
};

export interface HumanUnitDef {
  name: string;
  hp: number;
  dps: number;
  speed: number;
  range: number;
  radius: number;
  art: 'infantry' | 'gunner' | 'sniper' | 'paladin';
  leash: number;
}

export const HUMAN_UNITS: Record<HumanUnitType, HumanUnitDef> = {
  infantry: { name: '步兵', hp: 130, dps: 10, speed: 58, range: 42, radius: 9, art: 'infantry', leash: 300 },
  gunner: { name: '机枪兵', hp: 90, dps: 14, speed: 48, range: 190, radius: 9, art: 'gunner', leash: 240 },
  sniper: { name: '狙击手', hp: 70, dps: 26, speed: 42, range: 330, radius: 8, art: 'sniper', leash: 120 },
  paladin: { name: '圣光骑士', hp: 340, dps: 22, speed: 46, range: 48, radius: 11, art: 'paladin', leash: 280 },
};

export interface TowerDef {
  name: string;
  hp: number;
  dps: number;
  range: number;
  /** 每次射击间隔（秒） */
  interval: number;
  /** 单次伤害（覆盖 dps 计算时以 dps×interval 为准） */
  splash?: number;
  art: 'mgtower' | 'cannontower' | 'aatower' | 'holytower';
  desc: string;
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  mg: { name: '机枪塔', hp: 950, dps: 34, range: 250, interval: 0.22, art: 'mgtower', desc: '高射速单体，专杀密集轻装。' },
  cannon: { name: '重炮塔', hp: 1100, dps: 80 / 3.5, range: 330, interval: 3.5, splash: 62, art: 'cannontower', desc: '每 3.5 秒一发范围炮击。' },
  aa: { name: '防空塔', hp: 700, dps: 55, range: 300, interval: 0.3, art: 'aatower', desc: '对空火力；对地面目标效率减半。' },
  holy: { name: '圣光塔', hp: 1100, dps: 30, range: 230, interval: 0.8, art: 'holytower', desc: '压制精锐，需能源站供电。' },
};

export interface EnemyDef {
  name: string;
  hp: number;
  dps: number;
  speed: number;
  range: number;
  radius: number;
  art: 'infantry' | 'gunner' | 'sniper' | 'paladin';
}

export interface BuildingDef {
  name: string;
  desc: string;
  levels: { cost: { corpses: number; essence: number }; produce?: number; command?: number }[];
}

export const BUILDINGS: Record<'brood' | 'throne', BuildingDef> = {
  brood: {
    name: '尸巢',
    desc: '每日孵化食尸鬼。等级越高产量越大，建设次日生效。',
    levels: [
      { cost: { corpses: 30, essence: 0 }, produce: 12 },
      { cost: { corpses: 45, essence: 0 }, produce: 22 },
      { cost: { corpses: 65, essence: 10 }, produce: 35 },
    ],
  },
  throne: {
    name: '亡骸王座',
    desc: '提升单场可部署的统御上限，并在终局化身中提供更强力量。',
    levels: [
      { cost: { corpses: 0, essence: 0 }, command: 180 },
      { cost: { corpses: 70, essence: 12 }, command: 300 },
      { cost: { corpses: 130, essence: 25 }, command: 450 },
    ],
  },
};

export const BUILD_COSTS = {
  mutation: [
    { corpses: 45, essence: 8 },
    { corpses: 70, essence: 15 },
  ],
  altar: [{ corpses: 65, essence: 12 }],
} as const;

export const CONVERT = {
  runner: { zombies: 2, essence: 2, name: '疾行者' },
  brute: { zombies: 4, essence: 4, name: '重装感染者' },
  spider: { zombies: 2, essence: 3, name: '蛛行者' },
} as const;

export const ECONOMY = {
  startCorpses: 80,
  startEssence: 12,
  startInventory: { zombie: 60, runner: 0, brute: 0, spider: 0, boss: 0 },
  throneCorpsesPerDay: 20,
  inventoryCap: 999,
  recruitBatch: 10,
  recruitCost: 30,
  bossEssence: 25,
  essencePerKills: 4,
  essencePerStructure: 3,
  bossRestDays: 1,
};

export const NODE_CAPTURE = {
  holdSeconds: 8,
  rewardCorpses: 30,
  rewardEssence: 2,
};

export const DIFFICULTY: Record<
  Difficulty,
  { name: string; maxDays: number; budget: number; budgetCap: number; baseCharge: number; perStation: number }
> = {
  easy: { name: '简单', maxDays: 12, budget: 22, budgetCap: 60, baseCharge: 7, perStation: 2 },
  normal: { name: '普通', maxDays: 10, budget: 30, budgetCap: 60, baseCharge: 10, perStation: 3 },
  hard: { name: '困难', maxDays: 8, budget: 38, budgetCap: 60, baseCharge: 11, perStation: 4 },
};

export const TIMING = {
  siegeSeconds: 240,
  finalSeconds: 420,
  deploySpreadSeconds: 1.3,
  captureSeconds: 8,
  reportGraceSeconds: 1.2,
};

export const HUMAN_AI = {
  trainPerBarracks: 6,
  trainCost: 1,
  repairCost: 8,
  repairAmount: 420,
  mgCost: 18,
  cannonCost: 24,
  researchCost: 20,
  researchMax: 3,
  towerSlots: [
    { id: 'ai-t1', x: 70, y: 76 },
    { id: 'ai-t2', x: 90, y: 76 },
    { id: 'ai-t3', x: 52, y: 58 },
    { id: 'ai-t4', x: 110, y: 58 },
    { id: 'ai-t5', x: 78, y: 60 },
    { id: 'ai-t6', x: 100, y: 44 },
  ],
};

export const MAX_ACTIVE = { high: 260, low: 180, final: 320, finalLow: 220 };

export const COMBAT = {
  aggroRange: 240,
  retargetInterval: 0.35,
  separationStrength: 0.62,
  projectileSpeed: 900,
  conversionChance: 0.2,
  conversionCap: 15,
  wallXpPerDamage: 1,
};

export const NODE_ORDER: NodeId[] = ['west', 'center', 'east'];

export const BUILD_LABEL: Record<UndeadBuildKind, string> = {
  brood: '尸巢',
  mutation: '变异池',
  altar: '黑暗祭坛',
};
