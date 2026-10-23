import { describe, expect, it } from 'vitest';
import { createCampaign } from '../src/core/state';
import {
  advanceDay,
  applyBattleResult,
  canDeclareFinal,
  executeSacrifice,
  isLastChance,
  previewSacrifice,
  totalStack,
} from '../src/core/campaign';
import type { BattleResult, CampaignState } from '../src/core/types';

function makeResult(state: CampaignState, patch: Partial<BattleResult> = {}): BattleResult {
  return {
    outcome: 'timeout',
    day: state.day,
    final: false,
    duration: 240,
    deployed: { zombie: 30, runner: 0, brute: 0, spider: 0, boss: 0 },
    lost: { zombie: 10, runner: 0, brute: 0, spider: 0, boss: 0 },
    survivors: { zombie: 20, runner: 0, brute: 0, spider: 0, boss: 0 },
    remaining: { zombie: 30, runner: 0, brute: 0, spider: 0, boss: 0 },
    kills: 5,
    converted: 2,
    structures: [],
    wallBreaches: [],
    captured: [],
    lighthouseDamage: 0,
    chargeBefore: 0,
    chargeAfter: 0,
    facilityHp: {},
    wallHp: {},
    notes: [],
    ...patch,
  };
}

describe('战役日流程', () => {
  it('库存 = 未出战 + 幸存 + 转化', () => {
    const state = createCampaign('normal', 7);
    applyBattleResult(state, makeResult(state));
    expect(state.inventory.zombie).toBe(30 + 20 + 2);
    expect(state.kills).toBe(5);
    expect(state.casualties.zombie).toBe(10);
  });

  it('灯塔充能：2 座能源站 +16%，1 座 +13%，0 座 +10%', () => {
    const state = createCampaign('normal', 7);
    const r1 = advanceDay(state, makeResult(state));
    expect(r1.chargeDelta).toBe(16);
    expect(state.lighthouse.charge).toBe(16);

    const state2 = createCampaign('normal', 7);
    state2.human.find((f) => f.id === 'powerA')!.destroyed = true;
    const r2 = advanceDay(state2, makeResult(state2));
    expect(r2.chargeDelta).toBe(13);

    const state3 = createCampaign('normal', 7);
    state3.human.find((f) => f.id === 'powerA')!.destroyed = true;
    state3.human.find((f) => f.id === 'powerB')!.destroyed = true;
    const r3 = advanceDay(state3, makeResult(state3));
    expect(r3.chargeDelta).toBe(10);
  });

  it('充能达到 100% 立即失败，且不再进入下一天', () => {
    const state = createCampaign('normal', 7);
    state.lighthouse.charge = 90;
    const adv = advanceDay(state, makeResult(state));
    expect(state.lighthouse.charge).toBe(100);
    expect(adv.lost).toBe(true);
    expect(state.phase).toBe('lost');
    expect(state.day).toBe(1);
  });

  it('被摧毁的墙段跨日保持缺口，不会被修好', () => {
    const state = createCampaign('normal', 7);
    const wall = state.walls[0];
    wall.destroyed = true;
    wall.hp = 0;
    advanceDay(state, makeResult(state, { wallHp: { [wall.id]: { hp: 0, destroyed: true } } }));
    expect(state.walls[0].destroyed).toBe(true);
    expect(state.walls[0].hp).toBe(0);
  });

  it('军营被摧毁后不再补充士兵', () => {
    const state = createCampaign('normal', 7);
    state.human.filter((f) => f.kind === 'barracks').forEach((f) => {
      f.destroyed = true;
      f.hp = 0;
    });
    const soldiers = state.humanSoldiers;
    const actions = advanceDay(state, makeResult(state)).report.humanActions;
    expect(state.humanSoldiers).toBe(soldiers);
    expect(actions.some((a) => a.includes('军营尽毁'))).toBe(true);
  });

  it('能源站当日被毁，当日充能立即降低', () => {
    const state = createCampaign('normal', 7);
    const power = state.human.find((f) => f.id === 'powerA')!;
    power.destroyed = true;
    power.hp = 0;
    const adv = advanceDay(state, makeResult(state, { facilityHp: { powerA: 0 } }));
    expect(adv.chargeDelta).toBe(13);
  });

  it('占领据点次日才开放部署', () => {
    const state = createCampaign('normal', 7);
    advanceDay(state, makeResult(state, { captured: ['center'] }));
    const t = state.territories.find((v) => v.id === 'center')!;
    expect(t.owner).toBe('undead');
    expect(t.activeForDeploy).toBe(true); // advanceDay 推进到第 2 天后激活
  });
});

describe('万骸归一', () => {
  it('预览不重复计算：库存 + 尸巢 + 尸骸兑换', () => {
    const state = createCampaign('normal', 7);
    state.resources.corpses = 200; // 200/20*5 = 50
    const p = previewSacrifice(state);
    expect(p.inventory.zombie).toBe(60);
    expect(p.broodBonus).toBe(15); // 1 座 Lv1 尸巢
    expect(p.corpseExchange).toBe(50);
    expect(p.total.zombie).toBe(60 + 15 + 50);
  });

  it('只能发动一次，且建筑全部崩塌', () => {
    const state = createCampaign('normal', 7);
    state.throneLevel = 2;
    expect(canDeclareFinal(state)).toBe(true);
    const first = executeSacrifice(state);
    expect(first.ok).toBe(true);
    expect(state.finalAssaultTriggered).toBe(true);
    expect(state.buildings.every((b) => b.destroyed)).toBe(true);
    const second = executeSacrifice(state);
    expect(second.ok).toBe(false);
    expect(state.inventory.zombie).toBe(first.preview.total.zombie);
  });

  it('未到王座 II 且不是最后机会时不能发动', () => {
    const state = createCampaign('normal', 7);
    expect(canDeclareFinal(state)).toBe(false);
    state.day = state.maxDays;
    expect(isLastChance(state)).toBe(true);
    expect(canDeclareFinal(state)).toBe(true);
  });

  it('献祭后总兵力守恒（不凭空增加）', () => {
    const state = createCampaign('normal', 7);
    state.throneLevel = 2;
    state.resources.corpses = 100;
    state.resources.essence = 40;
    const before = totalStack(state.inventory) + Math.floor(state.resources.corpses / 20) * 5 + Math.floor(state.resources.essence / 8);
    const r = executeSacrifice(state);
    expect(totalStack(r.preview.total)).toBe(before + 15);
  });
});
