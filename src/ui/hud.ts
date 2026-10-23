import { UNITS } from '../config/balance';
import type { CampaignState, UnitStack, UnitType } from '../core/types';
import { unitIconDataUrl } from '../art/units';
import { el } from './dom';
import { settings } from './settings';
import type { WorldScene } from '../game/WorldScene';

export interface HudCallbacks {
  onRetreat: () => void;
  onExit: () => void;
  onRestart: () => void;
  onContinue?: () => void;
}

const ORDER: UnitType[] = ['zombie', 'runner', 'brute', 'spider', 'boss'];

const ICONS: Record<UnitType, string> = {
  zombie: unitIconDataUrl('zombie'),
  runner: unitIconDataUrl('runner'),
  brute: unitIconDataUrl('brute'),
  spider: unitIconDataUrl('spider'),
  boss: unitIconDataUrl('boss'),
};

export class BattleHUD {
  private root: HTMLElement;
  private state: CampaignState;
  private scene: WorldScene;
  private cb: HudCallbacks;
  private screen: HTMLElement;
  private clock!: HTMLElement;
  private lighthouseBar!: HTMLElement;
  private lighthousePct!: HTMLElement;
  private killVal!: HTMLElement;
  private commandVal!: HTMLElement;
  private aliveVal!: HTMLElement;
  private cards = new Map<UnitType, HTMLElement>();
  private stockNodes = new Map<UnitType, HTMLElement>();
  private logBox!: HTMLElement;
  private selTitle!: HTMLElement;
  private selSub!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private speedBtns: HTMLButtonElement[] = [];
  private pauseBtn!: HTMLButtonElement;
  private minimapTimer = 0;
  private overlay: HTMLElement | null = null;
  private lastLog: string[] = [];

  constructor(root: HTMLElement, state: CampaignState, scene: WorldScene, cb: HudCallbacks) {
    this.root = root;
    this.state = state;
    this.scene = scene;
    this.cb = cb;
    this.screen = el('div', { class: 'hud' });
    this.build();
    this.root.append(this.screen);
    this.bindKeys();
    this.setSpeed(1);
  }

  private build(): void {
    /* ---------- 顶部 ---------- */
    this.clock = el('div', { class: 'hud-clock', text: '4:00' });
    this.killVal = el('div', { class: 'v', text: '0' });
    this.commandVal = el('div', { class: 'v', text: '0 / 180' });
    this.aliveVal = el('div', { class: 'v', text: '0' });
    this.lighthouseBar = el('i');
    this.lighthousePct = el('div', { class: 'v', text: '100%' });

    const top = el('div', { class: 'hud-top' }, [
      el('div', { class: 'hud-stat', style: { borderLeft: 'none' } }, [
        el('div', { class: 'k', text: `第 ${this.state.day} 天 · 攻城` }),
        this.clock,
      ]),
      el('div', { class: 'hud-stat' }, [
        el('div', { class: 'k', text: '灯塔结构' }),
        el('div', { class: 'meter', style: { width: '170px' } }, [this.lighthouseBar]),
        this.lighthousePct,
      ]),
      el('div', { class: 'hud-stat' }, [el('div', { class: 'k', text: '击杀' }), this.killVal]),
      el('div', { class: 'hud-stat' }, [el('div', { class: 'k', text: '统御' }), this.commandVal]),
      el('div', { class: 'hud-stat' }, [el('div', { class: 'k', text: '在场' }), this.aliveVal]),
    ]);

    const speedWrap = el('div', { class: 'hud-speed' });
    for (const s of [1, 2]) {
      const b = el('button', {
        text: `${s}×`,
        on: {
          click: () => {
            this.setSpeed(s);
          },
        },
      });
      this.speedBtns.push(b);
      speedWrap.append(b);
    }
    this.pauseBtn = el('button', {
      text: '暂停',
      on: {
        click: () => {
          this.scene.setPaused(!this.scene.paused);
          this.pauseBtn.textContent = this.scene.paused ? '继续' : '暂停';
        },
      },
    });
    speedWrap.append(this.pauseBtn);

    top.append(
      el('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } }, [
        speedWrap,
        el('button', {
          class: 'hud-btn',
          text: '主军',
          title: '镜头定位到主力（空格）',
          on: { click: () => this.scene.focusAlive() },
        }),
        el('button', { class: 'hud-btn danger', text: '撤退', on: { click: () => this.cb.onRetreat() } }),
      ]),
    );

    /* ---------- 左侧选中信息 ---------- */
    this.selTitle = el('div', { class: 'sel-title', text: '未选择部队' });
    this.selSub = el('div', { class: 'sel-sub', text: '左键点选 / 拖拽框选尸群；右键下达移动或集火命令。' });
    const left = el('div', { class: 'hud-left' }, [
      el('div', { class: 'hud-panel' }, [
        el('h4', { text: '指挥' }),
        this.selTitle,
        this.selSub,
        el('div', { class: 'cmd-row' }, [
          el('button', { class: 'hud-btn', text: '全选', on: { click: () => this.scene.selectAll() } }),
          el('button', {
            class: 'hud-btn',
            text: '冲锋',
            on: {
              click: () => {
                this.scene.sim?.chargeAll();
                this.log('全军冲锋：各单位自行寻找目标', 'gold');
              },
            },
          }),
        ]),
      ]),
    ]);

    /* ---------- 右侧小地图 ---------- */
    this.minimap = document.createElement('canvas');
    this.minimap.width = 190;
    this.minimap.height = 133;
    const right = el('div', { class: 'hud-right' }, [
      el('div', { class: 'minimap-wrap' }, [this.minimap]),
      el('div', { class: 'hud-panel' }, [el('h4', { text: '战场记录' }), (this.logBox = el('div', { class: 'log-box' }))]),
    ]);

    /* ---------- 底部兵种卡 ---------- */
    const cards = el('div', { class: 'unit-cards' });
    ORDER.forEach((type, idx) => {
      const def = UNITS[type];
      const stock = el('div', { class: 'uc', text: `×${this.state.inventory[type]}` });
      const card = el('div', { class: 'unit-card' }, [
        el('img', { attrs: { src: ICONS[type], alt: def.name } }),
        el('div', { class: 'un', text: def.name }),
        stock,
        el('div', { class: 'key', text: String(idx + 1) }),
        el('div', { class: 'cost', text: `统 ${def.command}` }),
      ]);
      card.addEventListener('click', () => this.toggleCard(type));
      this.cards.set(type, card);
      this.stockNodes.set(type, stock);
      cards.append(card);
    });

    const dock = el('div', { class: 'hud-dock' }, [
      cards,
      el('div', {
        class: 'hint-bar',
        text: '1–5 选兵 · 左键投放 · 右键/ESC 取消 · WASD 平移 · 滚轮缩放 · 空格回主军 · P 暂停',
      }),
    ]);

    this.screen.append(top, left, right, dock);
  }

  private bindKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    kb.on('keydown-ESC', () => {
      if (this.scene.deployType) this.scene.setDeployType(null);
    });
  }

  private toggleCard(type: UnitType): void {
    if (this.scene.deployType === type) this.scene.setDeployType(null);
    else this.scene.setDeployType(type);
  }

  private setSpeed(s: number): void {
    this.scene.setSpeed(s);
    this.speedBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === s));
  }

  updateStats(s: { fps: number; units: number; time: number; commandUsed: number; commandCap: number; alive: number }): void {
    const t = Math.max(0, s.time);
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    this.clock.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    this.clock.classList.toggle('warn', t < 45);
    const lh = this.scene.sim?.structures.get('lighthouse');
    const ratio = lh ? Math.max(0, lh.hp / lh.maxHp) : 1;
    this.lighthouseBar.style.width = `${ratio * 100}%`;
    this.lighthouseBar.classList.toggle('warn', ratio < 0.35);
    this.lighthousePct.textContent = `${Math.round(ratio * 100)}%`;
    this.killVal.textContent = String(this.scene.sim?.kills ?? 0);
    this.commandVal.textContent = `${s.commandUsed} / ${s.commandCap}`;
    this.aliveVal.textContent = String(s.alive);

    const sim = this.scene.sim;
    if (sim) {
      for (const type of ORDER) {
        const n = sim.reserve[type];
        this.stockNodes.get(type)?.replaceChildren(document.createTextNode(`×${n}`));
        const card = this.cards.get(type);
        card?.classList.toggle('empty', n <= 0);
        card?.classList.toggle('active', this.scene.deployType === type);
      }
    }

    this.minimapTimer += 0.25;
    if (this.minimapTimer > 0.2) {
      this.minimapTimer = 0;
      this.drawMinimap();
    }
  }

  private drawMinimap(): void {
    const ctx = this.minimap.getContext('2d');
    if (!ctx) return;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const sx = W / (160 * 32);
    const sy = H / (112 * 32);
    ctx.fillStyle = '#0a0e0c';
    ctx.fillRect(0, 0, W, H);
    const data = this.scene.getMinimap();
    // 墙体
    for (const w of data.walls) {
      ctx.fillStyle = w.destroyed ? '#3a2f26' : '#6e7362';
      ctx.fillRect(w.x * sx, w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));
    }
    // 设施
    for (const s of data.structures) {
      ctx.fillStyle = s.destroyed ? '#4a2a22' : s.kind === 'lighthouse' ? '#e8cf8a' : '#8a8f7a';
      ctx.fillRect(s.x * sx - 1, s.y * sy - 1, Math.max(2, s.w * sx), Math.max(2, s.h * sy));
    }
    // 据点
    for (const n of data.nodes) {
      ctx.strokeStyle = n.owner === 'undead' ? '#7dffb0' : '#c9a45c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(n.x * sx, n.y * sy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 单位
    for (const u of data.units) {
      ctx.fillStyle = u.side === 'undead' ? '#7dffb0' : '#f0d190';
      const s = u.art === 'boss' || u.art === 'lord' ? 3 : 1.6;
      ctx.fillRect(u.x * sx - s / 2, u.y * sy - s / 2, s, s);
    }
    // 视野框
    const cam = this.scene.cameras.main;
    ctx.strokeStyle = 'rgba(220,235,225,0.35)';
    ctx.strokeRect(cam.worldView.x * sx, cam.worldView.y * sy, cam.worldView.width * sx, cam.worldView.height * sy);

    this.minimap.onclick = (ev) => {
      const r = this.minimap.getBoundingClientRect();
      const wx = ((ev.clientX - r.left) / r.width) * 160 * 32;
      const wy = ((ev.clientY - r.top) / r.height) * 112 * 32;
      this.scene.centerOn(wx, wy);
    };
  }

  updateSelection(ids: number[], info: string): void {
    if (ids.length === 0) {
      this.selTitle.textContent = '未选择部队';
      this.selSub.textContent = '左键点选 / 拖拽框选尸群；右键下达移动或集火命令。';
      return;
    }
    this.selTitle.textContent = `已选中 ${ids.length} 个单位`;
    this.selSub.textContent = info || '右键地面移动，右键敌人/建筑集火。';
  }

  log(text: string, kind: 'good' | 'bad' | 'gold' | 'info' = 'info'): void {
    if (this.lastLog[this.lastLog.length - 1] === text) return;
    this.lastLog.push(text);
    if (this.lastLog.length > 30) this.lastLog.shift();
    const line = el('div', { class: `li ${kind === 'info' ? '' : kind}`, text });
    this.logBox.prepend(line);
    while (this.logBox.children.length > 9) this.logBox.lastElementChild?.remove();
  }

  showResult(result: {
    ok: boolean;
    title: string;
    lines: { k: string; v: string; tone?: 'good' | 'bad' }[];
    note?: string;
  }): void {
    if (this.overlay) return;
    const lines = el(
      'div',
      { style: { display: 'grid', gap: '4px', margin: '4px 0 14px' } },
      result.lines.map((l) =>
        el('div', { class: 'rp-row' }, [
          el('span', { class: 'k', text: l.k }),
          el('span', { class: `v ${l.tone ?? ''}`, text: l.v }),
        ]),
      ),
    );
    const body = el('div', {}, [
      el('div', {
        style: { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.16em', color: result.ok ? '#d8b978' : '#e8694f' },
        text: result.title,
      }),
      el('div', { style: { height: '10px' } }),
      lines,
      result.note ? el('div', { class: 'rp-note', text: result.note }) : null,
    ]);
    const actions = [
      el('button', { class: 'btn btn-sm', text: '返回主菜单', on: { click: () => this.cb.onExit() } }),
      el('button', {
        class: 'btn btn-sm btn-primary',
        text: result.ok ? '继续' : '再试一次',
        on: {
          click: () => {
            this.closeOverlay();
            if (result.ok && this.cb.onContinue) this.cb.onContinue();
            else this.cb.onRestart();
          },
        },
      }),
    ];
    const back = el('div', { class: 'modal-screen' });
    const card = el('div', { class: 'panel modal-card' }, [
      el('div', { class: 'panel-head' }, [el('h3', { text: '战斗结束' })]),
      el('div', { class: 'panel-body' }, [body]),
      el('div', { class: 'modal-actions' }, actions),
    ]);
    back.append(card);
    this.overlay = back;
    this.root.append(back);
  }

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  destroy(): void {
    this.closeOverlay();
    this.screen.remove();
  }
}

export function stackLine(stack: UnitStack): string {
  return ORDER.filter((t) => stack[t] > 0)
    .map((t) => `${UNITS[t].name} ×${stack[t]}`)
    .join(' · ');
}

export function qualityLabel(): string {
  return settings.quality === 'high' ? '高画质' : '低画质';
}
