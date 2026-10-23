export type Phase = 'menu' | 'council' | 'battle' | 'report' | 'won' | 'lost';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type UnitType = 'zombie' | 'runner' | 'brute' | 'spider' | 'boss';
export type HumanUnitType = 'infantry' | 'gunner' | 'sniper' | 'paladin';
export type TowerKind = 'mg' | 'cannon' | 'aa' | 'holy';
export type UndeadBuildKind = 'brood' | 'mutation' | 'altar';
export type NodeId = 'west' | 'east' | 'center';

export interface UnitStack {
  zombie: number;
  runner: number;
  brute: number;
  spider: number;
  boss: number;
}

export interface UndeadBuilding {
  id: string;
  kind: UndeadBuildKind;
  slotId: string;
  level: number;
  /** 次日生效的目标等级（0 表示新建未完工） */
  pendingLevel: number | null;
  destroyed: boolean;
  x: number;
  y: number;
}

export interface HumanFacilityState {
  id: string;
  kind: 'lighthouse' | 'barracks' | 'arsenal' | 'power' | 'research' | 'medical' | 'tower';
  towerKind?: TowerKind;
  name: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
}

export interface WallState {
  id: string;
  x: number;
  y: number;
  len: number;
  dir: 'h' | 'v';
  kind: 'outer' | 'gate' | 'inner' | 'innerGate';
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface TerritoryState {
  id: NodeId;
  name: string;
  owner: 'human' | 'undead';
  capturedOnDay: number | null;
  activeForDeploy: boolean;
}

export interface BossState {
  unlocked: boolean;
  woundedDay: number | null;
}

export interface GameEvent {
  id: number;
  day: number;
  type:
    | 'produce'
    | 'build'
    | 'upgrade'
    | 'convert'
    | 'deploy'
    | 'return'
    | 'casualty'
    | 'loot'
    | 'human-train'
    | 'charge'
    | 'sacrifice'
    | 'capture'
    | 'recruit'
    | 'note';
  detail: string;
  corpses?: number;
  essence?: number;
  unit?: UnitType;
  count?: number;
}

export interface PendingOrder {
  slotId: string;
  kind: UndeadBuildKind | 'throne';
  targetLevel: number;
}

export interface SacrificePreview {
  inventory: UnitStack;
  broodBonus: number;
  corpseExchange: number;
  essenceExchange: number;
  total: UnitStack;
  throneLevel: number;
  buildings: number;
  corpsesSpent: number;
  essenceSpent: number;
}

export interface CampaignState {
  schemaVersion: number;
  seed: number;
  day: number;
  maxDays: number;
  difficulty: Difficulty;
  phase: Phase;
  resources: { corpses: number; essence: number };
  inventory: UnitStack;
  casualties: UnitStack;
  kills: number;
  converted: number;
  throneLevel: 1 | 2 | 3;
  buildings: UndeadBuilding[];
  human: HumanFacilityState[];
  walls: WallState[];
  territories: TerritoryState[];
  towersBuilt: string[];
  lighthouse: { hp: number; maxHp: number; charge: number };
  humanBudget: number;
  humanSoldiers: number;
  techLevel: number;
  boss: BossState;
  finalAssaultTriggered: boolean;
  finalPreview: SacrificePreview | null;
  pending: PendingOrder[];
  ledger: GameEvent[];
  flags: { dayAdvanced: boolean; introSeen: boolean; lastChance: boolean };
  stats: {
    deployed: number;
    lost: number;
    structuresDestroyed: number;
    daysPlayed: number;
    bestCharge: number;
  };
}

export interface BattleResult {
  outcome: 'victory' | 'timeout' | 'retreat' | 'defeat';
  day: number;
  final: boolean;
  duration: number;
  /** 本场出击数（含 Boss） */
  deployed: UnitStack;
  /** 阵亡 */
  lost: UnitStack;
  /** 返回库存的幸存者 */
  survivors: UnitStack;
  kills: number;
  converted: number;
  structures: { id: string; name: string; kind: string; destroyed: boolean }[];
  wallBreaches: { id: string; kind: string }[];
  captured: NodeId[];
  lighthouseDamage: number;
  chargeBefore: number;
  chargeAfter: number;
  /** 战斗结束后各设施的剩余血量（写回战役） */
  facilityHp: Record<string, number>;
  wallHp: Record<string, { hp: number; destroyed: boolean }>;
  notes: string[];
}
