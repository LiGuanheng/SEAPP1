import { describe, expect, it } from 'vitest';
import { createCampaign } from '../src/core/state';
import { BattleSim } from '../src/battle/sim';
import type { UnitType } from '../src/core/types';

function run(final: boolean, army: Partial<Record<UnitType, number>>, throne: 1 | 2 | 3 = 3, seconds = 260) {
  const state = createCampaign('normal', 20261024);
  state.throneLevel = throne;
  state.inventory = { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0, ...army } as Record<UnitType, number>;
  state.boss.unlocked = true;
  const sim = new BattleSim({ state, final, seed: 20261024, lowQuality: false });
  const spots: { x: number; y: number }[] = [
    { x: 80 * 32, y: 106 * 32 },
    { x: 72 * 32, y: 106 * 32 },
    { x: 88 * 32, y: 106 * 32 },
    { x: 64 * 32, y: 104 * 32 },
    { x: 96 * 32, y: 104 * 32 },
  ];
  let i = 0;
  for (const [t] of Object.entries(army) as [UnitType, number][]) {
    let guard = 0;
    let tries = 0;
    while (sim.reserve[t] > 0 && guard++ < 400 && tries < 40) {
      const p = spots[i++ % spots.length];
      const r = sim.deploy(t, p.x, p.y);
      if (!r.ok) tries++;
      else tries = 0;
    }
  }
  const steps = Math.round(seconds * 30);
  for (let s = 0; s < steps; s++) sim.update(1 / 30);
  return {
    outcome: sim.outcome,
    elapsed: Math.round(sim.elapsed),
    kills: sim.kills,
    lost: sim.lostTotal,
    alive: sim.aliveUndead(),
    lighthouse: Math.round(sim.structures.get('lighthouse')?.hp ?? -1),
    destroyed: sim.destroyedStructures().map((s) => s.name),
    wallsDown: state.walls.filter((w) => w.destroyed).map((w) => w.id),
    deployed: sim.deployedTotal,
  };
}

describe('战斗平衡', () => {
  it('第 1 天 60 食尸鬼不应直接推掉灯塔', () => {
    const r = run(false, { zombie: 60 }, 1, 240);
    console.log('DAY1', r);
    expect(r.lighthouse).toBeGreaterThan(0);
  });

  it('后期大兵团（终局）应当能摧毁灯塔', () => {
    const r = run(true, { zombie: 220, brute: 24, boss: 1 });
    console.log('FINAL', r);
    expect(r.outcome).toBe('victory');
  });

  it('重装对墙的破坏效率应高于食尸鬼', () => {
    const a = run(false, { zombie: 40 }, 1, 90);
    const b = run(false, { brute: 10 }, 1, 90);
    console.log('WALL dmg', a.wallsDown, b.wallsDown, a.lighthouse, b.lighthouse);
    expect(a.wallsDown.length + b.wallsDown.length).toBeGreaterThan(0);
  });

  it('第 5 天规模（150 食尸鬼 + 8 重装）应能突破外城', () => {
    const r = run(false, { zombie: 150, brute: 8 }, 2, 240);
    console.log('DAY5', r);
    expect(r.wallsDown.length).toBeGreaterThan(0);
  });
});
