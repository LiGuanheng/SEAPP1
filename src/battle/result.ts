import type { BattleSim } from './sim';
import type { BattleResult, CampaignState } from '../core/types';

export function makeBattleResult(sim: BattleSim, state: CampaignState, final: boolean): BattleResult {
  const survivors = sim.survivors();
  const wallHp: BattleResult['wallHp'] = {};
  const breaches: BattleResult['wallBreaches'] = [];
  for (const w of state.walls) {
    wallHp[w.id] = { hp: w.hp, destroyed: w.destroyed };
    if (w.destroyed) breaches.push({ id: w.id, kind: w.kind });
  }
  const structures = Array.from(sim.structures.values())
    .filter((s) => s.kind !== 'nodeCamp')
    .map((s) => ({ id: s.id, name: s.name, kind: s.kind, destroyed: s.destroyed }));
  return {
    outcome: sim.outcome === 'ongoing' ? 'timeout' : sim.outcome,
    day: state.day,
    final,
    duration: Math.round(sim.elapsed),
    deployed: { ...sim.deployedTotal },
    lost: { ...sim.lostTotal },
    survivors,
    remaining: { ...sim.reserve },
    kills: sim.kills,
    converted: sim.converted,
    structures,
    wallBreaches: breaches,
    captured: [...sim.captured],
    lighthouseDamage: Math.round(sim.lighthouseDamage),
    chargeBefore: state.lighthouse.charge,
    chargeAfter: state.lighthouse.charge,
    facilityHp: sim.facilityHp(),
    wallHp,
    notes: [],
  };
}
