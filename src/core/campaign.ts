import { DIFFICULTY, HUMAN_AI, TIMING } from '../config/balance';
import { NODES } from '../config/mapData';
import type { BattleResult, CampaignState, NodeId, SacrificePreview, UnitStack } from './types';
import { emptyStack, powerStationsAlive, pushEvent } from './state';
import { produceForDay } from './economy';

export interface DayReport {
  day: number;
  final: boolean;
  outcome: BattleResult['outcome'];
  kills: number;
  casualties: number;
  survivors: UnitStack;
  deployed: UnitStack;
  destroyedFacilities: string[];
  breaches: number;
  captured: NodeId[];
  lighthouseDamage: number;
  chargeBefore: number;
  chargeAfter: number;
  chargeDelta: number;
  humanActions: string[];
  production: { zombies: number; corpses: number; notes: string[] };
  reason: string;
}

export function totalStack(s: UnitStack): number {
  return s.zombie + s.runner + s.brute + s.spider + s.boss;
}

/** 战斗结果写回战役状态（幂等：只在结算时调用一次） */
export function applyBattleResult(state: CampaignState, result: BattleResult): void {
  // 库存 = 未出战的部分 + 幸存返回 + 战中转化
  state.inventory = addStack(result.survivors, result.remaining);
  state.inventory.zombie += result.converted;
  state.casualties = addStack(state.casualties, result.lost);
  state.kills += result.kills;
  state.converted += result.converted;
  state.stats.deployed += totalStack(result.deployed);
  state.stats.lost += totalStack(result.lost);
  state.stats.structuresDestroyed += result.structures.filter((s) => s.destroyed).length;

  state.lighthouse.hp = Math.max(0, state.lighthouse.hp - result.lighthouseDamage);

  for (const f of state.human) {
    const hp = result.facilityHp[f.id];
    if (hp === undefined) continue;
    f.hp = Math.min(f.maxHp, hp);
    f.destroyed = f.hp <= 0;
  }
  for (const w of state.walls) {
    const st = result.wallHp[w.id];
    if (!st) continue;
    w.hp = st.hp;
    w.destroyed = st.destroyed;
    if (w.destroyed) w.hp = 0;
  }
  for (const node of result.captured) {
    const t = state.territories.find((v) => v.id === node);
    if (t && t.owner !== 'undead') {
      t.owner = 'undead';
      t.capturedOnDay = state.day;
      t.activeForDeploy = false;
      const def = NODES.find((n) => n.id === node)!;
      pushEvent(state, {
        type: 'capture',
        detail: `占领 ${def.name}`,
        corpses: def.reward.corpses,
        essence: def.reward.essence,
      });
    }
  }
  pushEvent(state, {
    type: 'casualty',
    detail: `第 ${state.day} 天战损：${totalStack(result.lost)}`,
    count: totalStack(result.lost),
  });
}

function addStack(a: UnitStack, b: UnitStack): UnitStack {
  return {
    zombie: a.zombie + b.zombie,
    runner: a.runner + b.runner,
    brute: a.brute + b.brute,
    spider: a.spider + b.spider,
    boss: a.boss + b.boss,
  };
}

/** 人类发展：预算约束下的修复 / 补兵 / 建塔 / 研究 */
export function humanTurn(state: CampaignState): string[] {
  const actions: string[] = [];
  const cfg = DIFFICULTY[state.difficulty];
  state.humanBudget = Math.min(cfg.budgetCap, state.humanBudget + cfg.budget);
  let budget = state.humanBudget;

  // 1) 修复受损未毁墙段
  const damaged = state.walls.filter((w) => !w.destroyed && w.hp < w.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  let repaired = 0;
  for (const w of damaged) {
    if (repaired >= 2) break;
    if (budget < HUMAN_AI.repairCost) break;
    budget -= HUMAN_AI.repairCost;
    w.hp = Math.min(w.maxHp, w.hp + HUMAN_AI.repairAmount);
    repaired++;
  }
  if (repaired > 0) actions.push(`修复 ${repaired} 段城墙（-${repaired * HUMAN_AI.repairCost}）`);

  // 2) 军营补兵（军营被毁则不产）
  const barracks = state.human.filter((f) => f.kind === 'barracks' && !f.destroyed);
  let trained = 0;
  for (let i = 0; i < barracks.length; i++) {
    for (let k = 0; k < HUMAN_AI.trainPerBarracks; k++) {
      if (budget < HUMAN_AI.trainCost) break;
      budget -= HUMAN_AI.trainCost;
      trained++;
    }
  }
  state.humanSoldiers += trained;
  if (trained > 0) actions.push(`征兵 ${trained} 人（-${trained}）`);
  else if (barracks.length === 0) actions.push('军营尽毁，无法补充守军');

  // 3) 建塔（需兵工厂）
  const arsenalAlive = state.human.some((f) => f.kind === 'arsenal' && !f.destroyed);
  if (arsenalAlive) {
    for (const slot of HUMAN_AI.towerSlots) {
      const id = slot.id;
      if (state.towersBuilt.some((t) => t.startsWith(id))) continue;
      const kind = budget >= HUMAN_AI.cannonCost ? 'cannon' : budget >= HUMAN_AI.mgCost ? 'mg' : null;
      if (!kind) break;
      const cost = kind === 'cannon' ? HUMAN_AI.cannonCost : HUMAN_AI.mgCost;
      budget -= cost;
      state.towersBuilt.push(`${id}:${kind}`);
      state.human.push({
        id: `${id}:${kind}`,
        kind: 'tower',
        towerKind: kind,
        name: kind === 'cannon' ? '重炮塔' : '机枪塔',
        hp: kind === 'cannon' ? 1100 : 950,
        maxHp: kind === 'cannon' ? 1100 : 950,
        destroyed: false,
        x: slot.x,
        y: slot.y,
        w: 2,
        h: 2,
        level: 1,
      });
      actions.push(`新建${kind === 'cannon' ? '重炮塔' : '机枪塔'}（-${cost}）`);
    }
  } else {
    actions.push('兵工厂已被摧毁，无法新建炮塔');
  }

  // 4) 研究
  if (state.techLevel < HUMAN_AI.researchMax && budget >= HUMAN_AI.researchCost) {
    budget -= HUMAN_AI.researchCost;
    state.techLevel++;
    actions.push(`防御科技提升至 ${state.techLevel} 级（-${HUMAN_AI.researchCost}）`);
  }

  state.humanBudget = Math.max(0, budget);
  pushEvent(state, { type: 'human-train', detail: actions.join('；') || '人类按兵不动', count: trained });
  return actions;
}

export function predictedFinishDay(state: CampaignState): number {
  const cfg = DIFFICULTY[state.difficulty];
  const stations = powerStationsAlive(state);
  const delta = cfg.baseCharge + cfg.perStation * stations;
  if (delta <= 0) return 99;
  return state.day + Math.ceil((100 - state.lighthouse.charge) / delta);
}

export function isLastChance(state: CampaignState): boolean {
  const cfg = DIFFICULTY[state.difficulty];
  const stations = powerStationsAlive(state);
  const delta = cfg.baseCharge + cfg.perStation * stations;
  return state.lighthouse.charge + delta >= 100 || state.day >= state.maxDays;
}

export interface DayAdvance {
  chargeDelta: number;
  chargeAfter: number;
  lost: boolean;
  lostReason: string;
  report: DayReport;
}

/** 战后完整结算：写回 → 人类发展 → 充能 → 生产 → 次日 */
export function advanceDay(state: CampaignState, result: BattleResult): DayAdvance {
  const chargeBefore = state.lighthouse.charge;
  applyBattleResult(state, result);
  const humanActions = humanTurn(state);
  state.stats.daysPlayed = state.day;

  const cfg = DIFFICULTY[state.difficulty];
  const stations = powerStationsAlive(state);
  const chargeDelta = cfg.baseCharge + cfg.perStation * stations;
  state.lighthouse.charge = Math.min(100, state.lighthouse.charge + chargeDelta);
  state.stats.bestCharge = Math.max(state.stats.bestCharge, state.lighthouse.charge);
  pushEvent(state, { type: 'charge', detail: `灯塔充能 +${chargeDelta}%（能源站 ${stations} 座）` });

  let lost = false;
  let lostReason = '';
  if (state.lighthouse.hp <= 0) {
    state.phase = 'won';
  } else if (state.lighthouse.charge >= 100) {
    lost = true;
    lostReason = '灯塔完成净化，白金光束吞没了尸潮。';
    state.phase = 'lost';
  } else if (state.day >= state.maxDays) {
    lost = true;
    lostReason = '最后期限已到，曙光城撑到了净化完成。';
    state.phase = 'lost';
  }

  let production = { zombies: 0, corpses: 0, notes: [] as string[] };
  if (!lost && state.phase !== 'won') {
    state.day += 1;
    state.flags.dayAdvanced = false;
    production = produceForDay(state);
    // 前线据点次日激活
    for (const t of state.territories) {
      if (t.owner === 'undead' && t.capturedOnDay !== null && t.capturedOnDay < state.day) {
        t.activeForDeploy = true;
      }
    }
    state.flags.lastChance = isLastChance(state);
    state.phase = 'council';
    pushEvent(state, { type: 'note', detail: `第 ${state.day} 天开始` });
  }

  const report: DayReport = {
    day: result.day,
    final: result.final,
    outcome: result.outcome,
    kills: result.kills,
    casualties: totalStack(result.lost),
    survivors: addStack(result.survivors, result.remaining),
    deployed: result.deployed,
    destroyedFacilities: result.structures.filter((s) => s.destroyed).map((s) => s.name),
    breaches: result.wallBreaches.length,
    captured: result.captured,
    lighthouseDamage: Math.round(result.lighthouseDamage),
    chargeBefore,
    chargeAfter: state.lighthouse.charge,
    chargeDelta,
    humanActions,
    production,
    reason: lostReason,
  };
  return { chargeDelta, chargeAfter: state.lighthouse.charge, lost, lostReason, report };
}

/* ---------------- 万骸归一 ---------------- */

export function previewSacrifice(state: CampaignState): SacrificePreview {
  const inv: UnitStack = { ...state.inventory };
  let broodBonus = 0;
  let buildings = 0;
  for (const b of state.buildings) {
    if (b.destroyed) continue;
    buildings++;
    if (b.kind === 'brood' && b.pendingLevel === null) {
      broodBonus += b.level === 1 ? 15 : b.level === 2 ? 25 : b.level === 3 ? 45 : 0;
    }
  }
  const corpseExchange = Math.min(200, Math.floor(state.resources.corpses / 20) * 5);
  const essenceExchange = Math.min(20, Math.floor(state.resources.essence / 8));
  const total: UnitStack = {
    zombie: inv.zombie + broodBonus + corpseExchange,
    runner: inv.runner,
    brute: inv.brute + essenceExchange,
    spider: inv.spider,
    boss: state.boss.unlocked && state.boss.woundedDay !== state.day ? Math.max(1, inv.boss) : inv.boss,
  };
  return {
    inventory: inv,
    broodBonus,
    corpseExchange,
    essenceExchange,
    total,
    throneLevel: state.throneLevel,
    buildings,
    corpsesSpent: Math.floor(state.resources.corpses / 20) * 20,
    essenceSpent: essenceExchange * 8,
  };
}

export function executeSacrifice(state: CampaignState): { ok: boolean; message: string; preview: SacrificePreview } {
  if (state.finalAssaultTriggered) {
    return { ok: false, message: '万骸归一已经发动', preview: previewSacrifice(state) };
  }
  const preview = previewSacrifice(state);
  state.inventory = { ...preview.total };
  state.resources.corpses = Math.max(0, state.resources.corpses - preview.corpsesSpent);
  state.resources.essence = Math.max(0, state.resources.essence - preview.essenceSpent);
  for (const b of state.buildings) b.destroyed = true;
  state.finalAssaultTriggered = true;
  state.finalPreview = preview;
  pushEvent(state, {
    type: 'sacrifice',
    detail: `万骸归一：献祭 ${preview.buildings} 座建筑，总兵力 ${totalStack(preview.total)}`,
    count: totalStack(preview.total),
  });
  return { ok: true, message: '万骸归一', preview };
}

/** 终局战斗的结算报告（没有下一天） */
export function makeFinalReport(state: CampaignState, result: BattleResult): DayReport {
  return {
    day: state.day,
    final: true,
    outcome: result.outcome,
    kills: result.kills,
    casualties: totalStack(result.lost),
    survivors: addStack(result.survivors, result.remaining),
    deployed: result.deployed,
    destroyedFacilities: result.structures.filter((s) => s.destroyed).map((s) => s.name),
    breaches: result.wallBreaches.length,
    captured: result.captured,
    lighthouseDamage: Math.round(result.lighthouseDamage),
    chargeBefore: state.lighthouse.charge,
    chargeAfter: state.lighthouse.charge,
    chargeDelta: 0,
    humanActions: [],
    production: { zombies: 0, corpses: 0, notes: [] },
    reason: result.outcome === 'victory' ? '灯塔在最后的总攻中崩塌。' : '最后一批亡灵倒在了城墙下，灯塔完成了净化。',
  };
}

export function canDeclareFinal(state: CampaignState): boolean {
  return !state.finalAssaultTriggered && (state.throneLevel >= 2 || isLastChance(state));
}

export function siegeSeconds(): number {
  return TIMING.siegeSeconds;
}

export function emptyUnitStack(): UnitStack {
  return emptyStack();
}
