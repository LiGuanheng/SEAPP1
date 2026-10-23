import { APP_VERSION, SAVE_KEY, SAVE_SCHEMA_VERSION } from '../config/version';
import type { CampaignState } from './types';
import { createCampaign, validateState } from './state';

export interface SaveFile {
  schemaVersion: number;
  savedAt: number;
  appVersion: string;
  state: CampaignState;
}

export interface LoadResult {
  ok: boolean;
  state?: CampaignState;
  reason?: string;
}

export function saveGame(state: CampaignState): boolean {
  try {
    const payload: SaveFile = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: Date.now(),
      appVersion: APP_VERSION,
      state,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadGame(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: '浏览器禁止访问本地存储' };
  }
  if (!raw) return { ok: false, reason: '没有找到存档' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: '存档文件已损坏（JSON 解析失败）' };
  }
  const file = parsed as Partial<SaveFile>;
  if (!file || typeof file !== 'object' || !file.state) {
    return { ok: false, reason: '存档结构缺失' };
  }
  if (file.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: `存档版本不兼容（${file.schemaVersion} ≠ ${SAVE_SCHEMA_VERSION}）` };
  }
  const state = normalizeState(file.state);
  const errs = validateState(state);
  if (errs.length > 0) return { ok: false, reason: `存档校验失败：${errs[0]}` };
  // 战斗中的存档回退到议事厅（战场进度不保存）
  if (state.phase === 'battle') {
    state.phase = 'council';
  }
  return { ok: true, state };
}

/** 兼容旧字段：补齐缺失结构，避免坏档白屏 */
function normalizeState(input: CampaignState): CampaignState {
  const base = createCampaign(input.difficulty ?? 'normal', input.seed ?? 20261024);
  const merged: CampaignState = {
    ...base,
    ...input,
    resources: { ...base.resources, ...(input.resources ?? {}) },
    inventory: { ...base.inventory, ...(input.inventory ?? {}) },
    casualties: { ...base.casualties, ...(input.casualties ?? {}) },
    lighthouse: { ...base.lighthouse, ...(input.lighthouse ?? {}) },
    boss: { ...base.boss, ...(input.boss ?? {}) },
    flags: { ...base.flags, ...(input.flags ?? {}) },
    stats: { ...base.stats, ...(input.stats ?? {}) },
    buildings: Array.isArray(input.buildings) ? input.buildings : base.buildings,
    human: Array.isArray(input.human) ? input.human : base.human,
    walls: Array.isArray(input.walls) ? input.walls : base.walls,
    territories: Array.isArray(input.territories) ? input.territories : base.territories,
    pending: Array.isArray(input.pending) ? input.pending : [],
    ledger: Array.isArray(input.ledger) ? input.ledger : [],
    towersBuilt: Array.isArray(input.towersBuilt) ? input.towersBuilt : [],
  };
  if (merged.phase === 'battle') merged.phase = 'council';
  return merged;
}
