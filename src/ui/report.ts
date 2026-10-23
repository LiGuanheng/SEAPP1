import { UNITS } from '../config/balance';
import type { CampaignState, UnitStack } from '../core/types';
import type { DayReport } from '../core/campaign';
import { el, fmt } from './dom';

function stackText(s: UnitStack): string {
  const parts: string[] = [];
  for (const k of ['zombie', 'runner', 'brute', 'spider', 'boss'] as const) {
    if (s[k] > 0) parts.push(`${UNITS[k].name} ×${s[k]}`);
  }
  return parts.join(' · ') || '无';
}

export function showReport(root: HTMLElement, state: CampaignState, report: DayReport, onNext: () => void): void {
  const back = el('div', { class: 'modal-screen' });
  const title =
    report.outcome === 'victory' ? '灯塔陨落' : report.outcome === 'retreat' ? '主动撤退' : report.final ? '总攻失败' : '时间耗尽';

  const block = (h: string, rows: [string, string, ('good' | 'bad')?][]) =>
    el('div', { class: 'rp-block' }, [
      el('h3', { text: h }),
      ...rows.map(([k, v, tone]) =>
        el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: k }), el('span', { class: `v ${tone ?? ''}`, text: v })]),
      ),
    ]);

  const chargeTone = report.chargeAfter >= 75 ? 'bad' : undefined;
  const body = el('div', { class: 'report-body' }, [
    block('兵力', [
      ['出征', stackText(report.deployed)],
      ['阵亡', String(report.casualties), 'bad'],
      ['战后库存', stackText(report.survivors), 'good'],
      ['击杀守军', String(report.kills), 'good'],
      ['战中转化', `+${state.converted}`, state.converted > 0 ? 'good' : undefined],
    ]),
    block('城防', [
      ['摧毁设施', report.destroyedFacilities.join('、') || '无', report.destroyedFacilities.length ? 'good' : undefined],
      ['城墙缺口', `${report.breaches} 段`, report.breaches ? 'good' : undefined],
      ['占领据点', report.captured.length ? report.captured.map((c) => (c === 'west' ? '西侧哨站' : c === 'east' ? '东侧补给站' : '城门前哨')).join('、') : '无', report.captured.length ? 'good' : undefined],
      ['灯塔受损', `${fmt(report.lighthouseDamage)}`, report.lighthouseDamage > 0 ? 'good' : undefined],
      ['战利品精华', `+${report.essenceLoot}`, report.essenceLoot > 0 ? 'good' : undefined],
    ]),
    block('灯塔', [
      ['战前充能', `${Math.round(report.chargeBefore)}%`],
      [`日终充能 +${report.chargeDelta}%`, `${Math.round(report.chargeAfter)}%`, chargeTone],
      ['剩余结构', `${Math.max(0, Math.round(state.lighthouse.hp))} / ${state.lighthouse.maxHp}`, state.lighthouse.hp < state.lighthouse.maxHp * 0.4 ? 'bad' : undefined],
      ['存续能源站', `${state.human.filter((f) => f.kind === 'power' && !f.destroyed).length} / 2`],
    ]),
    block('人类反应', report.humanActions.length ? report.humanActions.map((a, i) => [`行动 ${i + 1}`, a] as [string, string]) : [['行动', '未采取行动']]),
    block('次日生产', [
      ['尸巢孵化', `+${report.production.zombies} 食尸鬼`, 'good'],
      ['王座凝聚', `+${report.production.corpses} 尸骸`, 'good'],
      ...(report.production.notes.length ? ([['备注', report.production.notes.join('；')]] as [string, string][]) : []),
    ]),
    el('div', {
      class: 'rp-note',
      text:
        report.reason ||
        (report.outcome === 'victory'
          ? '灯塔结构归零，净化之光熄灭。'
          : report.lighthouseDamage > 0
            ? '这次攻势真正伤到了灯塔——但还不够。调整配兵，下一次会更接近。'
            : '城墙承受了冲击，但核心防线仍然完整。也许该换一条路线，或先拆掉能源站。'),
    }),
  ]);

  const card = el('div', { class: 'panel report' }, [
    el('div', { class: 'report-head' }, [
      el('h2', { text: `第 ${report.day} 天战报` }),
      el('div', { class: 'sub', text: `${title} · ${report.outcome === 'victory' ? '胜利' : '未达成目标'}` }),
    ]),
    body,
    el('div', { class: 'report-foot' }, [
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn-primary', text: state.phase === 'won' ? '查看结局' : `进入第 ${state.day} 天`, on: { click: () => { back.remove(); onNext(); } } }),
    ]),
  ]);
  back.append(card);
  root.append(back);
}

export interface EndingInfo {
  victory: boolean;
  title: string;
  kicker: string;
  text: string;
  stats: { k: string; v: string }[];
}

export function showEnding(root: HTMLElement, info: EndingInfo, onRestart: () => void, onMenu: () => void): void {
  const screen = el('div', { class: `ending-screen ${info.victory ? 'win' : 'lose'}` });
  const bg = el('div', { class: 'end-bg' });
  bg.style.backgroundImage = `url(assets/art/${info.victory ? 'ending-victory' : 'ending-defeat'}.jpg)`;
  const inner = el('div', { class: 'ending-inner' }, [
    el('div', { class: 'ending-kicker', text: info.kicker }),
    el('h1', { text: info.title }),
    el('p', { text: info.text }),
    el(
      'div',
      { class: 'ending-stats' },
      info.stats.map((s) => el('div', {}, [el('div', { class: 'k', text: s.k }), el('div', { class: 'v', text: s.v })])),
    ),
    el('div', { class: 'ending-actions' }, [
      el('button', { class: 'btn', text: '返回主菜单', on: { click: onMenu } }),
      el('button', { class: 'btn btn-primary', text: '再来一局', on: { click: onRestart } }),
    ]),
  ]);
  screen.append(bg, inner);
  root.append(screen);
}
