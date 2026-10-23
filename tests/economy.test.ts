import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaign, validateState } from '../src/core/state';
import {
  buildAt,
  commandCapacityOf,
  convertUnit,
  produceForDay,
  recruitZombies,
  upgradeBrood,
  upgradeThrone,
} from '../src/core/economy';
import type { CampaignState } from '../src/core/types';

function fresh(): CampaignState {
  return createCampaign('normal', 1234);
}

describe('经济与建造', () => {
  let state: CampaignState;
  beforeEach(() => {
    state = fresh();
  });

  it('开局资源与库存符合基线', () => {
    expect(state.inventory.zombie).toBe(60);
    expect(state.resources.corpses).toBe(80);
    expect(state.resources.essence).toBe(8);
    expect(state.buildings.length).toBe(1);
    expect(state.throneLevel).toBe(1);
    expect(commandCapacityOf(state)).toBe(180);
  });

  it('建造尸巢立即扣资源，但当日不产兵，次日才生效', () => {
    const before = state.resources.corpses;
    const r = buildAt(state, 'slot-r1', 'brood');
    expect(r.ok).toBe(true);
    expect(state.resources.corpses).toBe(before - 30);
    const built = state.buildings.find((b) => b.slotId === 'slot-r1')!;
    expect(built.level).toBe(0);
    expect(built.pendingLevel).toBe(1);

    // 未到次日时，新建筑不产兵（level 仍为 0）
    expect(built.level).toBe(0);
    // 次日生产：施工转正后才开始产兵 → 12（原有）+ 12（新建）= 24
    const nextDay = produceForDay(state);
    expect(nextDay.zombies).toBe(24);
    expect(built.level).toBe(1);
    // 再下一天：两座 Lv1 尸巢
    expect(produceForDay(state).zombies).toBe(24);
    expect(validateState(state)).toEqual([]);
  });

  it('资源不足时无法建造或升级，且不会产生负数', () => {
    state.resources.corpses = 10;
    const r = buildAt(state, 'slot-r1', 'brood');
    expect(r.ok).toBe(false);
    expect(state.resources.corpses).toBe(10);
    expect(state.buildings.length).toBe(1);

    state.resources.corpses = 0;
    state.resources.essence = 0;
    const up = upgradeThrone(state);
    expect(up.ok).toBe(false);
    expect(state.throneLevel).toBe(1);
    expect(validateState(state)).toEqual([]);
  });

  it('尸巢升级与产量：I→II→III 分别为 12/22/35', () => {
    const brood = state.buildings[0];
    state.resources.corpses = 500;
    state.resources.essence = 100;
    expect(produceForDay(state).zombies).toBe(12);
    expect(upgradeBrood(state, brood.id).ok).toBe(true);
    expect(produceForDay(state).zombies).toBe(22);
    expect(brood.level).toBe(2);
    expect(upgradeBrood(state, brood.id).ok).toBe(true);
    expect(produceForDay(state).zombies).toBe(35);
    expect(brood.level).toBe(3);
    // 满级后不能再升
    expect(upgradeBrood(state, brood.id).ok).toBe(false);
  });

  it('王座升级提升统御上限并扣除资源', () => {
    state.resources.corpses = 200;
    state.resources.essence = 40;
    expect(upgradeThrone(state).ok).toBe(true);
    expect(state.throneLevel).toBe(2);
    expect(commandCapacityOf(state)).toBe(300);
    expect(state.resources.corpses).toBe(130);
    expect(upgradeThrone(state).ok).toBe(true);
    expect(commandCapacityOf(state)).toBe(450);
    expect(upgradeThrone(state).ok).toBe(false);
  });

  it('没有变异池时不能改造；有变异池时必须真实扣除食尸鬼与精华', () => {
    const bad = convertUnit(state, 'runner', 2);
    expect(bad.ok).toBe(false);
    expect(state.inventory.runner).toBe(0);

    state.resources.corpses = 100;
    state.resources.essence = 40;
    expect(buildAt(state, 'slot-r1', 'mutation').ok).toBe(true);
    produceForDay(state); // 生效
    const beforeZ = state.inventory.zombie;
    const beforeE = state.resources.essence;
    const r = convertUnit(state, 'runner', 3);
    expect(r.ok).toBe(true);
    expect(state.inventory.runner).toBe(3);
    expect(state.inventory.zombie).toBe(beforeZ - 6);
    expect(state.resources.essence).toBe(beforeE - 6);

    // 食尸鬼不足时拒绝
    state.inventory.zombie = 3;
    const fail = convertUnit(state, 'runner', 3);
    expect(fail.ok).toBe(false);
    expect(state.inventory.runner).toBe(3);
    expect(validateState(state)).toEqual([]);
  });

  it('蛛行者需要 2 级变异池', () => {
    state.resources.corpses = 200;
    state.resources.essence = 80;
    buildAt(state, 'slot-r1', 'mutation');
    produceForDay(state);
    expect(convertUnit(state, 'spider', 1).ok).toBe(false);
    const mut = state.buildings.find((b) => b.kind === 'mutation')!;
    mut.level = 2;
    expect(convertUnit(state, 'spider', 1).ok).toBe(true);
    expect(state.inventory.spider).toBe(1);
  });

  it('招募受资源与库存上限约束', () => {
    state.resources.corpses = 100;
    const z0 = state.inventory.zombie;
    expect(recruitZombies(state, 1).ok).toBe(true);
    expect(state.inventory.zombie).toBe(z0 + 10);
    expect(state.resources.corpses).toBe(70);
    state.resources.corpses = 10;
    expect(recruitZombies(state, 1).ok).toBe(false);
    expect(state.resources.corpses).toBe(10);
  });
});
