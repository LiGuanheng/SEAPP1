import { BUILDINGS, BUILD_COSTS, CONVERT, ECONOMY, UNITS } from '../config/balance';
import { SLOTS } from '../config/mapData';
import type { CampaignState, UndeadBuildKind, UnitType } from '../core/types';
import { pushEvent } from './state';

export interface Cost {
  corpses: number;
  essence: number;
}

export function canAfford(state: CampaignState, cost: Cost): boolean {
  return state.resources.corpses >= cost.corpses && state.resources.essence >= cost.essence;
}

export function spend(state: CampaignState, cost: Cost, detail: string): boolean {
  if (!canAfford(state, cost)) return false;
  state.resources.corpses -= cost.corpses;
  state.resources.essence -= cost.essence;
  pushEvent(state, {
    type: 'note',
    detail,
    corpses: -cost.corpses,
    essence: -cost.essence,
  });
  return true;
}

export function slotById(slotId: string) {
  return SLOTS.find((s) => s.id === slotId);
}

export function buildingAtSlot(state: CampaignState, slotId: string) {
  return state.buildings.find((b) => b.slotId === slotId && !b.destroyed);
}

export function slotAvailable(state: CampaignState, slotId: string): boolean {
  const slot = slotById(slotId);
  if (!slot) return false;
  if (slot.zone !== 'rear') {
    const t = state.territories.find((v) => v.id === slot.zone);
    if (!t || t.owner !== 'undead' || !t.activeForDeploy) return false;
  }
  return !state.buildings.some((b) => b.slotId === slotId && !b.destroyed);
}

export function buildCost(kind: UndeadBuildKind): Cost {
  if (kind === 'brood') return BUILDINGS.brood.levels[0].cost;
  if (kind === 'mutation') return BUILD_COSTS.mutation[0];
  return BUILD_COSTS.altar[0];
}

export function buildAt(state: CampaignState, slotId: string, kind: UndeadBuildKind): { ok: boolean; message: string } {
  if (!slotAvailable(state, slotId)) return { ok: false, message: '该位置不能建造（未占领或已有建筑）' };
  const cost = buildCost(kind);
  if (!canAfford(state, cost)) return { ok: false, message: '资源不足' };
  const slot = slotById(slotId)!;
  spend(state, cost, `建造${kind === 'brood' ? '尸巢' : kind === 'mutation' ? '变异池' : '黑暗祭坛'}`);
  state.buildings.push({
    id: `${kind}-${slotId}-${state.day}`,
    kind,
    slotId,
    level: 0,
    pendingLevel: 1,
    destroyed: false,
    x: slot.x,
    y: slot.y,
  });
  return { ok: true, message: '已开工，次日生效' };
}

export function upgradeBrood(state: CampaignState, buildingId: string): { ok: boolean; message: string } {
  const b = state.buildings.find((v) => v.id === buildingId);
  if (!b || b.kind !== 'brood' || b.destroyed) return { ok: false, message: '建筑不存在' };
  if (b.pendingLevel !== null) return { ok: false, message: '该建筑正在施工' };
  if (b.level >= 3) return { ok: false, message: '已是最高等级' };
  const cost = BUILDINGS.brood.levels[b.level].cost;
  if (!canAfford(state, cost)) return { ok: false, message: '资源不足' };
  spend(state, cost, `升级尸巢至 ${b.level + 1} 级`);
  b.pendingLevel = b.level + 1;
  return { ok: true, message: '升级中，次日生效' };
}

export function upgradeThrone(state: CampaignState): { ok: boolean; message: string } {
  if (state.throneLevel >= 3) return { ok: false, message: '王座已满级' };
  const cost = BUILDINGS.throne.levels[state.throneLevel].cost;
  if (!canAfford(state, cost)) return { ok: false, message: '资源不足' };
  spend(state, cost, `升级亡骸王座至 ${state.throneLevel + 1} 级`);
  state.throneLevel = (state.throneLevel + 1) as 1 | 2 | 3;
  return { ok: true, message: `王座升至 ${state.throneLevel} 级，统御上限提升` };
}

export function upgradeStructure(state: CampaignState, buildingId: string): { ok: boolean; message: string } {
  const b = state.buildings.find((v) => v.id === buildingId);
  if (!b || b.destroyed) return { ok: false, message: '建筑不存在' };
  if (b.pendingLevel !== null) return { ok: false, message: '正在施工' };
  if (b.kind === 'brood') return upgradeBrood(state, buildingId);
  if (b.kind === 'mutation') {
    if (b.level >= 2) return { ok: false, message: '变异池已满级' };
    const cost = BUILD_COSTS.mutation[b.level];
    if (!canAfford(state, cost)) return { ok: false, message: '资源不足' };
    spend(state, cost, '升级变异池');
    b.pendingLevel = b.level + 1;
    return { ok: true, message: '升级中，次日生效' };
  }
  if (b.kind === 'altar') {
    if (b.level >= 2) return { ok: false, message: '祭坛已满级' };
    const cost = { corpses: 80, essence: 20 };
    if (!canAfford(state, cost)) return { ok: false, message: '资源不足' };
    spend(state, cost, '升级黑暗祭坛');
    b.pendingLevel = b.level + 1;
    return { ok: true, message: '升级中，次日生效' };
  }
  return { ok: false, message: '不可升级' };
}

export function hasBuilt(state: CampaignState, kind: UndeadBuildKind, minLevel = 1): boolean {
  return state.buildings.some((b) => b.kind === kind && !b.destroyed && b.level >= minLevel);
}

export function convertUnit(state: CampaignState, type: 'runner' | 'brute' | 'spider', count: number): { ok: boolean; message: string } {
  const recipe = CONVERT[type];
  if (!hasBuilt(state, 'mutation')) return { ok: false, message: '需要先建造变异池' };
  if (type === 'spider' && !hasBuilt(state, 'mutation', 2)) return { ok: false, message: '蛛行者需要 2 级变异池' };
  const n = Math.floor(count);
  if (n <= 0) return { ok: false, message: '数量无效' };
  const zombiesNeeded = recipe.zombies * n;
  const essenceNeeded = recipe.essence * n;
  if (state.inventory.zombie < zombiesNeeded) return { ok: false, message: `食尸鬼不足（需要 ${zombiesNeeded}）` };
  if (state.resources.essence < essenceNeeded) return { ok: false, message: `精华不足（需要 ${essenceNeeded}）` };
  state.inventory.zombie -= zombiesNeeded;
  state.resources.essence -= essenceNeeded;
  state.inventory[type] += n;
  pushEvent(state, {
    type: 'convert',
    detail: `改造 ${recipe.name} ×${n}`,
    unit: type,
    count: n,
    essence: -essenceNeeded,
  });
  return { ok: true, message: `改造 ${recipe.name} ×${n}` };
}

export function recruitZombies(state: CampaignState, batches = 1): { ok: boolean; message: string } {
  const n = ECONOMY.recruitBatch * batches;
  const cost = { corpses: ECONOMY.recruitCost * batches, essence: 0 };
  if (!canAfford(state, cost)) return { ok: false, message: '尸骸不足' };
  spend(state, cost, `招募食尸鬼 ×${n}`);
  state.inventory.zombie = Math.min(ECONOMY.inventoryCap, state.inventory.zombie + n);
  pushEvent(state, { type: 'recruit', detail: `招募食尸鬼 ×${n}`, unit: 'zombie', count: n });
  return { ok: true, message: `招募食尸鬼 ×${n}` };
}

export function awakenBoss(state: CampaignState): { ok: boolean; message: string } {
  if (!hasBuilt(state, 'altar')) return { ok: false, message: '需要先建造黑暗祭坛' };
  if (state.boss.unlocked) return { ok: false, message: '斧头巨汉已唤醒' };
  const cost = { corpses: 0, essence: ECONOMY.bossEssence };
  if (!canAfford(state, cost)) return { ok: false, message: `精华不足（需要 ${cost.essence}）` };
  spend(state, cost, '唤醒斧头巨汉');
  state.boss.unlocked = true;
  return { ok: true, message: '斧头巨汉已响应召唤' };
}

export function equipBoss(state: CampaignState): { ok: boolean; message: string } {
  if (!state.boss.unlocked) return { ok: false, message: '尚未唤醒斧头巨汉' };
  if (state.boss.woundedDay === state.day) return { ok: false, message: '巨汉正在休整' };
  if (state.inventory.boss > 0) return { ok: false, message: '巨汉已在军中' };
  state.inventory.boss = 1;
  return { ok: true, message: '巨汉加入出征序列' };
}

/** 每日生产：先升级转正，再产兵 */
export function produceForDay(state: CampaignState): { zombies: number; corpses: number; notes: string[] } {
  const notes: string[] = [];
  for (const b of state.buildings) {
    if (b.pendingLevel !== null && !b.destroyed) {
      b.level = b.pendingLevel;
      b.pendingLevel = null;
      notes.push(`${b.kind === 'brood' ? '尸巢' : b.kind === 'mutation' ? '变异池' : '祭坛'} 等级提升至 ${b.level}`);
    }
  }
  let zombies = 0;
  for (const b of state.buildings) {
    if (b.kind !== 'brood' || b.destroyed || b.level < 1) continue;
    const slot = slotById(b.slotId);
    if (slot && slot.zone !== 'rear') {
      const t = state.territories.find((v) => v.id === slot.zone);
      if (!t || t.owner !== 'undead') {
        notes.push('前线尸巢因据点失守暂停产兵');
        continue;
      }
    }
    const per = BUILDINGS.brood.levels[b.level - 1].produce ?? 0;
    zombies += per;
  }
  const room = ECONOMY.inventoryCap - state.inventory.zombie;
  const actual = Math.min(room, zombies);
  state.inventory.zombie += actual;
  if (actual > 0) {
    pushEvent(state, { type: 'produce', detail: `尸巢孵化食尸鬼 ×${actual}`, unit: 'zombie', count: actual });
  }
  const corpses = state.day >= 1 ? ECONOMY.throneCorpsesPerDay : 0;
  state.resources.corpses += corpses;
  pushEvent(state, { type: 'produce', detail: `王座凝聚尸骸 +${corpses}`, corpses });
  return { zombies: actual, corpses, notes };
}

export function commandCapacityOf(state: CampaignState): number {
  return BUILDINGS.throne.levels[state.throneLevel - 1].command ?? 180;
}

export function unitName(type: UnitType): string {
  return UNITS[type].name;
}
