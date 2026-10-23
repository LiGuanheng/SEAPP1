import { BUILDINGS, BUILD_COSTS, CONVERT, DIFFICULTY, UNITS } from '../config/balance';
import { NODES, SLOTS } from '../config/mapData';
import { unitIconDataUrl } from '../art/units';
import type { CampaignState, UndeadBuildKind, UnitType } from '../core/types';
import {
  buildAt,
  canAfford,
  commandCapacityOf,
  convertUnit,
  equipBoss,
  hasBuilt,
  recruitZombies,
  slotAvailable,
  upgradeStructure,
  upgradeThrone,
  awakenBoss,
} from '../core/economy';
import { canDeclareFinal, predictedFinishDay, previewSacrifice, isLastChance } from '../core/campaign';
import { powerStationsAlive } from '../core/state';
import { el, fmt } from './dom';

export interface CouncilCallbacks {
  onMarch: () => void;
  onFinal: () => void;
  onMenu: () => void;
  onChanged: () => void;
  onToast: (text: string, kind?: 'info' | 'bad' | 'gold') => void;
}

const ICONS: Record<UnitType, string> = {
  zombie: unitIconDataUrl('zombie'),
  runner: unitIconDataUrl('runner'),
  brute: unitIconDataUrl('brute'),
  spider: unitIconDataUrl('spider'),
  boss: unitIconDataUrl('boss'),
};

const ORDER: UnitType[] = ['zombie', 'runner', 'brute', 'spider', 'boss'];

export class CouncilScreen {
  private root: HTMLElement;
  private state: CampaignState;
  private cb: CouncilCallbacks;
  private screen: HTMLElement;
  private leftBody!: HTMLElement;
  private rightBody!: HTMLElement;
  private topbar!: HTMLElement;
  private bottomArmy!: HTMLElement;
  private marchHint!: HTMLElement;
  private modal: HTMLElement | null = null;
  selectedSlot: string | null = null;

  constructor(root: HTMLElement, state: CampaignState, cb: CouncilCallbacks) {
    this.root = root;
    this.state = state;
    this.cb = cb;
    this.screen = el('div', { class: 'screen council-screen' });
    this.build();
    this.root.append(this.screen);
    this.refresh();
  }

  private build(): void {
    this.topbar = el('div', { class: 'topbar' });
    this.leftBody = el('div', { class: 'side-scroll' });
    this.rightBody = el('div', { class: 'side-scroll' });
    this.bottomArmy = el('div', { class: 'army-strip' });
    this.marchHint = el('div', { class: 'rp-note', style: { margin: '6px 0 0', fontSize: '11px' } });

    const left = el('div', { class: 'side' }, [
      el('div', { class: 'panel-head' }, [el('h3', { text: '亡灵腹地' }), el('span', { class: 'tag', text: '建设次日生效' })]),
      this.leftBody,
    ]);
    const right = el('div', { class: 'side right' }, [
      el('div', { class: 'panel-head' }, [el('h3', { text: '城防情报' }), el('span', { class: 'tag', text: '已侦察' })]),
      this.rightBody,
    ]);
    const center = el('div', { class: 'council-center' }, [
      el('div', { class: 'map-hint', text: '点击地图上的幽绿圆环选择建造点 · WASD 平移 · 滚轮缩放' }),
    ]);

    const march = el('button', {
      class: 'btn btn-primary march-btn',
      html: '<span>发起进攻</span>',
      on: { click: () => this.cb.onMarch() },
    });
    const finalBtn = el('button', {
      class: 'btn btn-danger',
      text: '万骸归一',
      title: '献祭所有建筑与资源，发动不可逆的最终总攻',
      on: { click: () => this.confirmFinal() },
    });
    const menuBtn = el('button', {
      class: 'btn btn-sm',
      text: '保存并返回',
      on: {
        click: () => {
          this.cb.onMenu();
        },
      },
    });

    const bottom = el('div', { class: 'bottombar' }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' } }, [
        el('div', { style: { fontSize: '10px', letterSpacing: '0.18em', color: 'var(--text-faint)' }, text: '出征兵力' }),
        el('div', { style: { fontSize: '10.5px', color: 'var(--text-faint)' }, text: '战损跨日保留' }),
      ]),
      this.bottomArmy,
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [march, menuBtn]),
      finalBtn,
    ]);

    this.screen.append(this.topbar, el('div', { class: 'council-body' }, [left, center, right]), bottom);
  }

  selectSlot(slotId: string | null): void {
    this.selectedSlot = slotId;
    this.refresh();
  }

  refresh(): void {
    this.renderTop();
    this.renderLeft();
    this.renderRight();
    this.renderBottom();
    if (this.modal) this.modal.remove();
    this.modal = null;
  }

  private renderTop(): void {
    const s = this.state;
    const cfg = DIFFICULTY[s.difficulty];
    const stations = powerStationsAlive(s);
    const finish = predictedFinishDay(s);
    const charge = s.lighthouse.charge;
    const warn = isLastChance(s);
    this.topbar.innerHTML = '';
    this.topbar.append(
      el('div', { class: 'day', html: `第 ${s.day} 天<small>上限 ${s.maxDays} 天 · ${cfg.name}</small>` }),
      el('div', { class: 'res' }, [el('i', { class: 'ico corpse' }), el('span', { class: 'val', text: fmt(s.resources.corpses) }), el('span', { class: 'lbl', text: '尸骸' })]),
      el('div', { class: 'res' }, [el('i', { class: 'ico essence' }), el('span', { class: 'val', text: fmt(s.resources.essence) }), el('span', { class: 'lbl', text: '精华' })]),
      el('div', { class: 'res' }, [el('span', { class: 'lbl', text: '统御' }), el('span', { class: 'val', text: String(commandCapacityOf(s)) })]),
      el('div', { class: 'res' }, [el('span', { class: 'lbl', text: '守军' }), el('span', { class: 'val', text: String(s.humanSoldiers) })]),
      el('div', { class: 'spacer' }),
      el('div', { class: 'lh-meter' }, [
        el('div', { class: 'lbl', text: '灯塔充能' }),
        el('div', { class: 'meter' }, [el('i', { style: { width: `${charge}%` }, class: charge >= 75 ? 'warn' : '' })]),
        el('div', { class: 'lbl', text: `${Math.round(charge)}%` }),
      ]),
      el('div', {
        class: 'lbl',
        style: { fontSize: '10.5px', color: warn ? '#e8694f' : 'var(--text-faint)', letterSpacing: '0.08em', whiteSpace: 'nowrap' },
        text: warn ? '最后机会：本日必须决战' : `预计第 ${finish} 天充满 · 能源站 ${stations}/2`,
      }),
    );
  }

  private renderLeft(): void {
    const s = this.state;
    const body = this.leftBody;
    body.innerHTML = '';

    // 王座
    const throneCost = BUILDINGS.throne.levels[s.throneLevel]?.cost ?? BUILDINGS.throne.levels[0].cost;
    const throneCard = el('div', { class: 'build-card' }, [
      el('div', { class: 'row1' }, [
        el('span', { class: 'name', text: '亡骸王座' }),
        el('span', { class: 'lv', text: `LV ${s.throneLevel}` }),
      ]),
      el('div', { class: 'desc', text: `统御上限 ${commandCapacityOf(s)} · 终局化身为君主` }),
      el('div', { class: 'acts' }, [
        s.throneLevel < 3
          ? el('button', {
              class: 'mini-btn',
              text: `升至 ${s.throneLevel + 1} 级（${throneCost.corpses} 尸骸 / ${throneCost.essence} 精华）`,
              attrs: canAfford(s, throneCost) ? {} : { disabled: 'true' },
              on: {
                click: () => {
                  const r = upgradeThrone(s);
                  this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                  if (r.ok) {
                    this.cb.onChanged();
                    this.refresh();
                  }
                },
              },
            })
          : el('span', { class: 'desc', text: '已达最高等级' }),
      ]),
    ]);
    body.append(throneCard);

    // 建造点
    for (const slot of SLOTS) {
      const available = slotAvailable(s, slot.id);
      const zoneName = slot.zone === 'rear' ? '腹地' : slot.zone === 'west' ? '西线' : slot.zone === 'east' ? '东线' : '城前';
      const card = el('div', { class: `build-card ${this.selectedSlot === slot.id ? 'selected' : ''}` });
      if (!available) {
        card.append(
          el('div', { class: 'row1' }, [el('span', { class: 'name', text: `${zoneName}建造点` }), el('span', { class: 'lv', text: '锁定' })]),
          el('div', { class: 'desc', text: slot.zone === 'rear' ? '已被占用' : '需占领并连通该前线，次日开放' }),
        );
      } else {
        card.append(
          el('div', { class: 'row1' }, [el('span', { class: 'name', text: `${zoneName}建造点` }), el('span', { class: 'lv', text: '空地' })]),
          el('div', { class: 'desc', text: '在空地上建造建筑，次日生效' }),
          el(
            'div',
            { class: 'acts' },
            (['brood', 'mutation', 'altar'] as UndeadBuildKind[]).map((kind) => {
              const cost = kind === 'brood' ? BUILDINGS.brood.levels[0].cost : kind === 'mutation' ? BUILD_COSTS.mutation[0] : BUILD_COSTS.altar[0];
              const label = kind === 'brood' ? '尸巢' : kind === 'mutation' ? '变异池' : '祭坛';
              return el('button', {
                class: 'mini-btn',
                text: `${label} ${cost.corpses}尸骸${cost.essence ? ` +${cost.essence}精华` : ''}`,
                attrs: canAfford(s, cost) ? {} : { disabled: 'true' },
                on: {
                  click: () => {
                    const r = buildAt(s, slot.id, kind);
                    this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                    if (r.ok) {
                      this.cb.onChanged();
                      this.refresh();
                    }
                  },
                },
              });
            }),
          ),
        );
        card.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).tagName === 'BUTTON') return;
          this.selectSlot(slot.id);
        });
      }
      body.append(card);
    }

    // 已建建筑详情
    for (const b of s.buildings) {
      if (b.destroyed || b.level < 1 || b.kind === 'brood') continue;
      const name = b.kind === 'mutation' ? '变异池' : '黑暗祭坛';
      const card = el('div', { class: 'build-card' }, [
        el('div', { class: 'row1' }, [el('span', { class: 'name', text: name }), el('span', { class: 'lv', text: `LV ${b.level}` })]),
      ]);
      if (b.pendingLevel !== null) card.append(el('div', { class: 'desc', text: '施工中，次日生效' }));
      else if (b.kind === 'mutation') {
        card.append(el('div', { class: 'desc', text: b.level >= 2 ? '可改造全部精锐' : '升级后解锁蛛行者' }));
        if (b.level < 2) {
          const cost = BUILD_COSTS.mutation[b.level];
          card.append(
            el('div', { class: 'acts' }, [
              el('button', {
                class: 'mini-btn',
                text: `升级（${cost.corpses} 尸骸 / ${cost.essence} 精华）`,
                attrs: canAfford(s, cost) ? {} : { disabled: 'true' },
                on: {
                  click: () => {
                    const r = upgradeStructure(s, b.id);
                    this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                    if (r.ok) {
                      this.cb.onChanged();
                      this.refresh();
                    }
                  },
                },
              }),
            ]),
          );
        }
      } else {
        card.append(el('div', { class: 'desc', text: s.boss.unlocked ? (s.boss.woundedDay === s.day ? '巨汉重伤休整中' : '巨汉已唤醒') : '唤醒巨汉需要 25 精华' }));
        card.append(
          el('div', { class: 'acts' }, [
            s.boss.unlocked
              ? el('button', {
                  class: 'mini-btn good',
                  text: s.inventory.boss > 0 ? '已在军中' : '编入出征序列',
                  attrs: s.inventory.boss > 0 ? { disabled: 'true' } : {},
                  on: {
                    click: () => {
                      const r = equipBoss(s);
                      this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                      if (r.ok) {
                        this.cb.onChanged();
                        this.refresh();
                      }
                    },
                  },
                })
              : el('button', {
                  class: 'mini-btn',
                  text: '唤醒斧头巨汉（25 精华）',
                  attrs: canAfford(s, { corpses: 0, essence: 25 }) ? {} : { disabled: 'true' },
                  on: {
                    click: () => {
                      const r = awakenBoss(s);
                      this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                      if (r.ok) {
                        this.cb.onChanged();
                        this.refresh();
                      }
                    },
                  },
                }),
          ]),
        );
      }
      body.append(card);
    }

    // 改造
    if (hasBuilt(s, 'mutation')) {
      const convertCard = el('div', { class: 'build-card' }, [
        el('div', { class: 'row1' }, [el('span', { class: 'name', text: '变异改造' }), el('span', { class: 'lv', text: `精华 ${s.resources.essence}` })]),
      ]);
      for (const type of ['runner', 'brute', 'spider'] as const) {
        const r = CONVERT[type];
        convertCard.append(
          el('div', { class: 'desc', text: `${r.name}：${r.zombies} 食尸鬼 + ${r.essence} 精华` }),
          el(
            'div',
            { class: 'acts' },
            [1, 5].map((n) =>
              el('button', {
                class: 'mini-btn',
                text: `改造 ×${n}`,
                on: {
                  click: () => {
                    const res = convertUnit(s, type, n);
                    this.cb.onToast(res.message, res.ok ? 'gold' : 'bad');
                    if (res.ok) {
                      this.cb.onChanged();
                      this.refresh();
                    }
                  },
                },
              }),
            ),
          ),
        );
      }
      body.append(convertCard);
    }

    // 招募
    body.append(
      el('div', { class: 'build-card' }, [
        el('div', { class: 'row1' }, [el('span', { class: 'name', text: '尸骸招募' }), el('span', { class: 'lv', text: '立即生效' })]),
        el('div', { class: 'desc', text: '30 尸骸 → 10 食尸鬼' }),
        el('div', { class: 'acts' }, [
          el('button', {
            class: 'mini-btn',
            text: '招募 ×10',
            attrs: s.resources.corpses >= 30 ? {} : { disabled: 'true' },
            on: {
              click: () => {
                const r = recruitZombies(s, 1);
                this.cb.onToast(r.message, r.ok ? 'gold' : 'bad');
                if (r.ok) {
                  this.cb.onChanged();
                  this.refresh();
                }
              },
            },
          }),
        ]),
      ]),
    );
  }

  private renderRight(): void {
    const s = this.state;
    const body = this.rightBody;
    body.innerHTML = '';

    body.append(el('div', { style: { fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--text-faint)', margin: '2px 0 4px' }, text: '关键设施' }));
    for (const f of s.human) {
      if (f.kind === 'tower') continue;
      const ratio = Math.max(0, f.hp / f.maxHp);
      const row = el('div', { class: `intel-row ${f.destroyed ? 'dead' : ''}` }, [
        el('span', { class: 'n', text: f.name }),
        el('span', { class: 'v', text: f.destroyed ? '已摧毁' : `${Math.round(f.hp)}` }),
        el('div', { class: 'bar' }, [el('i', { style: { width: `${ratio * 100}%`, background: f.kind === 'power' ? '#7fc9d8' : '#8c6b3f' } })]),
      ]);
      body.append(row);
    }

    const towers = s.human.filter((f) => f.kind === 'tower');
    body.append(
      el('div', { style: { fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--text-faint)', margin: '10px 0 4px' }, text: `防御塔 ${towers.filter((t) => !t.destroyed).length}/${towers.length}` }),
    );
    for (const t of towers) {
      body.append(
        el('div', { class: `intel-row ${t.destroyed ? 'dead' : ''}` }, [
          el('span', { class: 'n', text: t.name }),
          el('span', { class: 'v', text: t.destroyed ? '已摧毁' : `${Math.round(t.hp)}` }),
        ]),
      );
    }

    const wallsDown = s.walls.filter((w) => w.destroyed);
    body.append(
      el('div', { style: { fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--text-faint)', margin: '10px 0 4px' }, text: `城墙缺口 ${wallsDown.length}/${s.walls.length}` }),
    );
    body.append(
      el('div', { class: 'desc', style: { fontSize: '11px', color: 'var(--text-faint)', lineHeight: '1.7' }, text: wallsDown.length ? `已打开：${wallsDown.map((w) => (w.kind === 'gate' ? '外城门' : w.kind === 'innerGate' ? '内城门' : w.kind === 'inner' ? '内墙' : '外墙')).join('、')}` : '城防完整，需先破墙才能进入外城' }),
    );

    body.append(el('div', { style: { fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--text-faint)', margin: '10px 0 4px' }, text: '前线据点' }));
    for (const n of NODES) {
      const t = s.territories.find((v) => v.id === n.id)!;
      const ours = t.owner === 'undead';
      body.append(
        el('div', { class: 'intel-row' }, [
          el('span', { class: 'n', text: n.name }),
          el('span', { class: 'v', style: { color: ours ? '#7dffb0' : '#c9a45c' }, text: ours ? (t.activeForDeploy ? '已控制 · 可出兵' : '已占领 · 次日生效') : '人类控制' }),
        ]),
      );
    }

    body.append(
      el('div', { class: 'rp-note', style: { marginTop: '10px', fontSize: '11px' }, text: `人口：食尸鬼 ${s.inventory.zombie} · 疾行者 ${s.inventory.runner} · 重装 ${s.inventory.brute} · 蛛行者 ${s.inventory.spider} · 巨汉 ${s.inventory.boss}` }),
    );
  }

  private renderBottom(): void {
    const s = this.state;
    this.bottomArmy.innerHTML = '';
    for (const t of ORDER) {
      const n = s.inventory[t];
      const chip = el('div', { class: `army-chip ${n === 0 ? 'dim' : ''}`, style: n === 0 ? { opacity: '0.35' } : {} }, [
        el('img', { attrs: { src: ICONS[t], alt: UNITS[t].name } }),
        el('span', { class: 'nm', text: UNITS[t].name }),
        el('span', { class: 'c', text: `×${n}` }),
      ]);
      this.bottomArmy.append(chip);
    }
    this.bottomArmy.append(
      el('div', { style: { marginLeft: 'auto', fontSize: '11px', color: 'var(--text-faint)', alignSelf: 'center' }, text: `统御 ${commandCapacityOf(s)} · 出征时按此上限投放` }),
    );
    const finalBtn = this.screen.querySelector('.btn-danger') as HTMLButtonElement | null;
    if (finalBtn) {
      const available = canDeclareFinal(s);
      finalBtn.disabled = !available;
      finalBtn.title = available
        ? `献祭 ${previewSacrifice(s).buildings} 座建筑，总兵力 ${previewSacrifice(s).total.zombie + previewSacrifice(s).total.runner + previewSacrifice(s).total.brute + previewSacrifice(s).total.spider + previewSacrifice(s).total.boss}`
        : '需要王座 II 或进入最后机会';
    }
    void this.marchHint;
  }

  private confirmFinal(): void {
    if (!canDeclareFinal(this.state)) {
      this.cb.onToast('需要王座 II 级，或进入最后机会', 'bad');
      return;
    }
    const p = previewSacrifice(this.state);
    const total = p.total.zombie + p.total.runner + p.total.brute + p.total.spider + p.total.boss;
    const body = el('div', {}, [
      el('div', { text: '发动后：所有建筑崩塌、资源清零，不再有下一天。全部资产将转化为一次性总攻兵力。' }),
      el('div', { class: 'rp-row', style: { marginTop: '10px' } }, [el('span', { class: 'k', text: '现有库存' }), el('span', { class: 'v', text: `${p.inventory.zombie + p.inventory.runner + p.inventory.brute + p.inventory.spider + p.inventory.boss}` })]),
      el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: '尸巢献祭' }), el('span', { class: 'v', text: `+${p.broodBonus} 食尸鬼` })]),
      el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: '尸骸兑换' }), el('span', { class: 'v', text: `+${p.corpseExchange} 食尸鬼（消耗 ${p.corpsesSpent}）` })]),
      el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: '精华重塑' }), el('span', { class: 'v', text: `+${p.essenceExchange} 重装（消耗 ${p.essenceSpent}）` })]),
      el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: '王座化身' }), el('span', { class: 'v', text: `等级 ${p.throneLevel}` })]),
      el('div', { class: 'rp-row' }, [el('span', { class: 'k', text: '终局总兵力' }), el('span', { class: 'v good', text: String(total) })]),
    ]);
    const back = el('div', { class: 'modal-screen' });
    const card = el('div', { class: 'panel modal-card' }, [
      el('div', { class: 'panel-head' }, [el('h3', { text: '万骸归一 · 不可逆' })]),
      el('div', { class: 'panel-body' }, [body]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-sm', text: '再等等', on: { click: () => back.remove() } }),
        el('button', {
          class: 'btn btn-sm btn-danger',
          text: '献祭一切，开始总攻',
          on: {
            click: () => {
              back.remove();
              this.cb.onFinal();
            },
          },
        }),
      ]),
    ]);
    back.append(card);
    this.modal = back;
    this.root.append(back);
  }

  destroy(): void {
    this.modal?.remove();
    this.screen.remove();
  }
}
