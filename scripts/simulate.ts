/**
 * 命令行战斗模拟器（headless，不需要浏览器）。
 *
 * 用途：在改动数值 / AI / 寻路之后，用同一套口径快速回归「这一版能不能赢、代价是多少」，
 * 而不必打开游戏手动打一场。它与 tests/battle.balance.test.ts 共用同一个 BattleSim。
 *
 * 用法：
 *   npm run sim                                   # 第 1 天，默认兵力（开局库存）
 *   npm run sim -- --final                        # 终局总攻（自动把王座拉到 III、解锁巨汉）
 *   npm run sim -- --army zombie:180,brute:20,boss:1 --final
 *   npm run sim -- --day 5 --army zombie:150,brute:8
 *   npm run sim -- --difficulty hard --seed 7 --json   # seed 同时决定地图抖动与战斗随机
 *   npm run sim -- --stagger 4                    # 分 4 波投入（每波间隔 30 秒）
 *   npm run sim -- --scatter                      # 随机散点投放（模拟真实玩家乱点，通常更差）
 *   npm run sim -- --throne 2                     # 指定王座等级（影响统御上限）
 *
 * 注意：这是**逻辑层**模拟，不含渲染。它验证不了帧率，只验证战斗结果与耗时。
 */
import { BattleSim } from '../src/battle/sim';
import { createCampaign } from '../src/core/state';
import { DIFFICULTY } from '../src/config/balance';
import type { CampaignState, Difficulty, UnitType } from '../src/core/types';

interface Args {
  difficulty: Difficulty;
  final: boolean;
  day: number;
  army: Partial<Record<UnitType, number>>;
  seed: number;
  json: boolean;
  stagger: number;
  maxSeconds: number;
  scatter: boolean;
  throne: 1 | 2 | 3;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const difficulty = (get('difficulty') ?? 'normal') as Difficulty;
  if (!DIFFICULTY[difficulty]) throw new Error(`未知难度：${difficulty}（easy | normal | hard）`);

  const armyRaw = get('army');
  const army: Partial<Record<UnitType, number>> = {};
  if (armyRaw) {
    for (const part of armyRaw.split(',')) {
      const [k, v] = part.split(':').map((s) => s.trim());
      if (!k || !v) throw new Error(`--army 格式应为 zombie:120,brute:20，收到：${part}`);
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`--army 数量非法：${part}`);
      army[k as UnitType] = n;
    }
  }

  return {
    difficulty,
    final: has('final'),
    day: Number(get('day') ?? 1),
    army,
    seed: Number(get('seed') ?? 20261024),
    json: has('json'),
    stagger: Math.max(1, Number(get('stagger') ?? 1)),
    maxSeconds: Number(get('max') ?? 600),
    scatter: has('scatter'),
    throne: (Math.min(3, Math.max(1, Number(get('throne') ?? 1))) as 1 | 2 | 3),
  };
}

function run(a: Args) {
  const state: CampaignState = createCampaign(a.difficulty, a.seed);
  state.day = Math.max(1, a.day);

  state.throneLevel = a.throne;
  if (a.final) {
    // 终局：王座 III、解锁巨汉、建筑视为已献祭
    state.throneLevel = 3;
    state.boss.unlocked = true;
    for (const b of state.buildings) b.destroyed = true;
    state.finalAssaultTriggered = true;
  }
  if (Object.keys(a.army).length > 0) {
    state.inventory = { zombie: 0, runner: 0, brute: 0, spider: 0, boss: 0, ...a.army };
  }

  const sim = new BattleSim({
    state,
    final: a.final,
    seed: a.seed,
    lowQuality: false,
  });

  const dt = 1 / 30;
  const waveInterval = 30;
  const pending: Partial<Record<UnitType, number>> = { ...sim.reserve };
  const totalUnits = Object.values(pending).reduce((s, n) => s + (n ?? 0), 0);

  // 分波投放：把库存按波次切分，每波调用一次 deploy（内部按 batch 批量落点）
  const perWave: Partial<Record<UnitType, number>> =
    a.stagger > 1
      ? Object.fromEntries(
          Object.entries(pending).map(([k, v]) => [k, Math.ceil((v ?? 0) / a.stagger)]),
        )
      : pending;

  // 默认使用 5 条固定投放通道（与 tests/battle.balance.test.ts 同一口径，便于交叉对比）；
  // --scatter 改为在部署区内随机取点，用来观察"投放位置"对结果的影响。
  const lanes: [number, number][] = [
    [80, 106],
    [72, 106],
    [88, 106],
    [64, 104],
    [96, 104],
  ];

  let nextWaveAt = 0;
  let waveIndex = 0;
  let laneIndex = 0;

  while (sim.outcome === 'ongoing' && sim.elapsed < a.maxSeconds) {
    if (waveIndex < a.stagger && sim.elapsed >= nextWaveAt) {
      for (const [type, want] of Object.entries(perWave) as [UnitType, number][]) {
        let remaining = Math.min(want, pending[type] ?? 0);
        let guard = 0;
        while (remaining > 0 && guard++ < 40) {
          const spot = a.scatter
            ? sim.pickDeploySpot()
            : { x: lanes[laneIndex % lanes.length][0] * 32, y: lanes[laneIndex++ % lanes.length][1] * 32 };
          if (!spot) break;
          const r = sim.deploy(type, spot.x, spot.y);
          if (!r.ok || r.count === 0) break;
          remaining -= r.count;
          pending[type] = (pending[type] ?? 0) - r.count;
        }
      }
      waveIndex++;
      nextWaveAt = sim.elapsed + waveInterval;
    }
    sim.update(dt);
  }

  const wallsDown = state.walls.filter((w) => w.destroyed).map((w) => w.id);
  const lighthouse = sim.structures.get('lighthouse');
  const survivors = sim.survivors();
  const lost = Object.values(sim.lostTotal).reduce((s, n) => s + n, 0);

  return {
    difficulty: a.difficulty,
    day: a.day,
    final: a.final,
    seed: a.seed,
    outcome: sim.outcome,
    elapsedSeconds: Math.round(sim.elapsed),
    timeLimit: sim.timeLimit,
    deployed: totalUnits,
    kills: sim.kills,
    converted: sim.converted,
    lost,
    survivors: Object.entries(survivors)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}:${n}`)
      .join(', ') || '无',
    captured: sim.captured,
    wallsDown,
    destroyedStructures: sim.destroyedStructures().map((s) => s.name),
    lighthouseHp: lighthouse ? Math.round(lighthouse.hp) : null,
    lighthouseMaxHp: lighthouse?.maxHp ?? null,
    lighthouseDamage: Math.round(sim.lighthouseDamage),
    commandPeak: sim.commandInfo().used,
  };
}

const args = parseArgs(process.argv.slice(2));
const result = run(args);

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const rows: [string, string][] = [
    ['难度 / 天数', `${DIFFICULTY[result.difficulty].name} / 第 ${result.day} 天${result.final ? '（终局总攻）' : ''}`],
    ['结果', `${result.outcome}（${result.elapsedSeconds}s / 上限 ${result.timeLimit}s）`],
    ['投入 / 阵亡', `${result.deployed} / ${result.lost}`],
    ['击杀 / 转化', `${result.kills} / ${result.converted}`],
    ['幸存', result.survivors],
    ['灯塔', result.lighthouseHp === null ? '—' : `${result.lighthouseHp} / ${result.lighthouseMaxHp}（累计伤害 ${result.lighthouseDamage}）`],
    ['倒塌墙段', result.wallsDown.length ? `${result.wallsDown.length} 段：${result.wallsDown.join(', ')}` : '无'],
    ['摧毁结构（含墙段）', result.destroyedStructures.join('、') || '无'],
    ['占领据点', result.captured.join(', ') || '无'],
  ];
  const width = Math.max(...rows.map((r) => [...r[0]].length * 2));
  console.log('');
  console.log('  《丧尸围城：亡骸君主》战斗模拟');
  console.log('  ' + '-'.repeat(width + 40));
  for (const [k, v] of rows) console.log(`  ${k.padEnd(width / 2)}  ${v}`);
  console.log('');
}
