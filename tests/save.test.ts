import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaign, validateState } from '../src/core/state';
import { clearSave, hasSave, loadGame, saveGame } from '../src/core/save';
import { SAVE_KEY } from '../src/config/version';
import { buildAt, produceForDay } from '../src/core/economy';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('存档系统', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  it('保存后可完整读回（天数/资源/建筑/墙段）', () => {
    const state = createCampaign('normal', 99);
    state.day = 3;
    state.resources.corpses = 123;
    state.inventory.zombie = 77;
    state.walls[0].hp = 100;
    state.walls[1].destroyed = true;
    state.walls[1].hp = 0;
    expect(saveGame(state)).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    const s = loaded.state!;
    expect(s.day).toBe(3);
    expect(s.resources.corpses).toBe(123);
    expect(s.inventory.zombie).toBe(77);
    expect(s.walls[0].hp).toBe(100);
    expect(s.walls[1].destroyed).toBe(true);
    expect(validateState(s)).toEqual([]);
  });

  it('坏档不会抛异常，返回可读原因', () => {
    localStorage.setItem(SAVE_KEY, '{ not json');
    const r = loadGame();
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('损坏');
  });

  it('缺失字段会被归一化补齐', () => {
    const state = createCampaign('normal', 5);
    const broken = { ...state, ledger: undefined, territories: undefined, walls: undefined } as unknown;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: Date.now(), appVersion: '1.0.0', state: broken }));
    const r = loadGame();
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.state!.walls)).toBe(true);
    expect(Array.isArray(r.state!.territories)).toBe(true);
  });

  it('版本不匹配时拒绝读取', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 999, state: createCampaign('normal') }));
    const r = loadGame();
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('版本');
  });

  it('战斗中的存档回退到议事厅', () => {
    const state = createCampaign('normal');
    state.phase = 'battle';
    saveGame(state);
    const r = loadGame();
    expect(r.ok).toBe(true);
    expect(r.state!.phase).toBe('council');
  });

  it('无存档时 hasSave 为 false，清档后恢复', () => {
    expect(hasSave()).toBe(false);
    const state = createCampaign('normal');
    saveGame(state);
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
  });

  it('读档后可继续经营，不会重复日结算', () => {
    const state = createCampaign('normal', 3);
    buildAt(state, 'slot-r1', 'brood');
    const before = produceForDay(state);
    expect(before.zombies).toBe(24); // 次日两座 Lv1 尸巢
    state.day = 2;
    saveGame(state);
    const loaded = loadGame().state!;
    expect(loaded.inventory.zombie).toBe(state.inventory.zombie);
    expect(loaded.buildings.length).toBe(2);
  });
});

describe('状态不变量', () => {
  it('检测负资源与非法充能', () => {
    const s = createCampaign('normal');
    s.resources.corpses = -1;
    s.lighthouse.charge = 120;
    const errs = validateState(s);
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });

  it('新开局满足全部不变量', () => {
    expect(validateState(createCampaign('easy'))).toEqual([]);
    expect(validateState(createCampaign('normal'))).toEqual([]);
    expect(validateState(createCampaign('hard'))).toEqual([]);
  });
});
