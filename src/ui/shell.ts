import { APP_VERSION, GAME_SUBTITLE, GAME_TITLE, SAVE_KEY } from '../config/version';
import { clear, el } from './dom';
import { settings, setSettings } from './settings';
import { showIntro } from './intro';
import { GameHost } from '../game/host';
import { createCampaign } from '../core/state';
import { BattleSim } from '../battle/sim';

export type ScreenName = 'menu' | 'intro' | 'council' | 'battle' | 'report' | 'ending';

const CREST = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="menu-crest">
  <path d="M32 6l5 9 10 2-7 8 2 11-10-5-10 5 2-11-7-8 10-2z" fill="#16241d" stroke="#d8b978" stroke-width="1.2"/>
  <path d="M32 13c-6 0-10 5-10 11 0 7 4 12 10 12s10-5 10-12c0-6-4-11-10-11z" fill="#c9d3c4" opacity="0.9"/>
  <path d="M26 25c0-4 2-7 6-7s6 3 6 7" stroke="#0b0e0d" stroke-width="1.4"/>
  <circle cx="28.5" cy="27" r="2" fill="#8cff5a"/>
  <circle cx="35.5" cy="27" r="2" fill="#8cff5a"/>
  <path d="M29 34h6M30 34v4M34 34v4" stroke="#0b0e0d" stroke-width="1.2"/>
  <path d="M18 40l-4 12 8-4 4 6 6-10M46 40l4 12-8-4-4 6-6-10" stroke="#3f9a6b" stroke-width="1" opacity="0.7"/>
</svg>`;

export class Shell {
  readonly root: HTMLElement;
  private host: HTMLDivElement;
  private overlay: HTMLDivElement;
  private toastWrap: HTMLDivElement;
  current: ScreenName = 'menu';
  private escHandler: ((ev: KeyboardEvent) => void) | null = null;
  private gameHost = new GameHost();
  private demoSim: BattleSim | null = null;

  constructor() {
    this.root = document.getElementById('ui-root') as HTMLElement;
    this.host = el('div', { class: 'screen-host', style: { position: 'absolute', inset: '0' } });
    this.overlay = el('div', { class: 'overlay-host', style: { position: 'absolute', inset: '0' } });
    this.toastWrap = el('div', { class: 'toast-wrap' });
    clear(this.root);
    this.root.append(this.host, this.overlay, this.toastWrap);
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  clearScreen(): void {
    clear(this.host);
    if (this.escHandler) {
      window.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }

  mount(node: HTMLElement): void {
    this.clearScreen();
    this.host.append(node);
  }

  onEscape(fn: () => void): void {
    if (this.escHandler) window.removeEventListener('keydown', this.escHandler);
    this.escHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') fn();
    };
    window.addEventListener('keydown', this.escHandler);
  }

  toast(text: string, kind: 'info' | 'bad' | 'gold' = 'info', ms = 2400): void {
    const t = el('div', { class: `toast ${kind === 'info' ? '' : kind}`, text });
    this.toastWrap.append(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, ms);
    while (this.toastWrap.children.length > 4) this.toastWrap.firstElementChild?.remove();
  }

  modal(title: string, body: HTMLElement, actions: HTMLElement[] = []): HTMLElement {
    const back = el('div', { class: 'modal-screen' });
    const card = el('div', { class: 'panel modal-card' }, [
      el('div', { class: 'panel-head' }, [el('h3', { text: title }), el('span', { class: 'tag', text: 'ESC 关闭' })]),
      el('div', { class: 'panel-body' }, [body]),
      el('div', { class: 'modal-actions' }, actions),
    ]);
    back.append(card);
    back.addEventListener('click', (ev) => {
      if (ev.target === back) close();
    });
    const close = () => {
      back.remove();
      window.removeEventListener('keydown', onKey);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    this.overlay.append(back);
    return back;
  }

  confirm(title: string, text: string, okText: string, onOk: () => void, danger = false): void {
    const body = el('div', { text });
    const actions = [
      el('button', { class: 'btn btn-sm', text: '取消', on: { click: () => back.remove() } }),
      el('button', {
        class: `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`,
        text: okText,
        on: {
          click: () => {
            back.remove();
            onOk();
          },
        },
      }),
    ];
    const back = this.modal(title, body, actions);
  }

  showMenu(): void {
    this.current = 'menu';
    const hasSave = this.hasSave();
    const screen = el('div', { class: 'screen menu-screen vignette' });

    const left = el('div', { class: 'menu-left' }, [
      el('div', { html: CREST }),
      el('h1', { class: 'menu-title', html: `<span class="t1">${GAME_TITLE}</span><span class="t2">${GAME_SUBTITLE}</span>` }),
      el('div', {
        class: 'menu-tag',
        text: '黑蚀吞没了世界，人类退守最后的曙光城。你是从古墓中苏醒的亡骸君主——以尸潮为剑，在灯塔净化完成之前，熄灭这最后的光。',
      }),
      el('div', { class: 'menu-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          html: '<span>开始新战役</span><small>NEW CAMPAIGN</small>',
          on: { click: () => this.onStart() },
        }),
        el('button', {
          class: 'btn',
          html: '<span>继续战役</span><small>CONTINUE</small>',
          attrs: hasSave ? {} : { disabled: 'true' },
          title: hasSave ? '读取本地存档' : '暂无存档',
          on: { click: () => this.onContinue() },
        }),
        el('button', {
          class: 'btn',
          html: '<span>操作说明</span><small>CONTROLS</small>',
          on: { click: () => this.showHelp() },
        }),
        el('button', {
          class: 'btn',
          html: '<span>设置</span><small>SETTINGS</small>',
          on: { click: () => this.showSettings() },
        }),
        el('button', {
          class: 'btn',
          html: '<span>制作信息</span><small>CREDITS</small>',
          on: { click: () => this.showCredits() },
        }),
      ]),
    ]);

    const art = el('div', { class: 'menu-art' }, [
      el('img', { class: 'art-img', attrs: { src: 'assets/art/keyart.jpg', alt: '' } }),
      el('div', { class: 'menu-art-caption', html: 'THE LAST LIGHT<br/>SHALL BE DEVOURED' }),
    ]);

    const foot = el('div', {
      class: 'menu-foot',
      html: `v${APP_VERSION} · 软件工程课程项目 · <a href="https://github.com/LiGuanheng/SEAPP1" target="_blank" rel="noreferrer" style="color:#9c8558">GitHub 源码</a>`,
    });

    screen.append(left, art, foot);
    this.mount(screen);
  }

  protected onStart(): void {
    this.showIntro(() => void this.startDemoBattle());
  }

  protected showIntro(onDone: () => void): void {
    showIntro(this.hostLayer(), onDone);
  }

  private hostLayer(): HTMLElement {
    return this.root;
  }

  /** M1 视觉样板：在地图上自动投放一支尸潮，验证地图/单位/塔防/特效/镜头 */
  async startDemoBattle(): Promise<void> {
    const state = createCampaign('normal');
    const sim = new BattleSim({ state, final: false, seed: state.seed, lowQuality: settings.quality === 'low' });
    sim.deploy('zombie', 80 * 32, 106 * 32);
    sim.deploy('zombie', 76 * 32, 104 * 32);
    sim.deploy('zombie', 84 * 32, 105 * 32);
    this.demoSim = sim;

    const screen = el('div', { class: 'screen', style: { pointerEvents: 'none' } });
    const badge = el('div', { class: 'demo-badge', html: '<b>视觉样板</b> · 尸潮自动推进 · WASD 平移 / 滚轮缩放' });
    screen.append(badge);
    this.mount(screen);

    await this.gameHost.mount(
      state,
      {
        onLog: (text: string, kind?: 'good' | 'bad' | 'gold') =>
          this.toast(text, kind === 'bad' ? 'bad' : kind === 'gold' ? 'gold' : 'info', 1800),
        onStats: (s: { fps: number; units: number; time: number; alive: number }) => {
          badge.innerHTML = `<b>视觉样板</b> · 剩余 ${Math.ceil(s.time)}s · 在场 ${s.alive} · FPS ${s.fps}`;
        },
        onBattleEnd: () => {
          this.toast('战斗结束（样板）', 'gold');
        },
      },
      'battle',
      sim,
    );
    this.onEscape(() => {
      this.demoSim?.retreat();
    });
  }

  protected onContinue(): void {
    this.toast('待接入：读档（M3 里程碑）', 'bad');
  }

  showHelp(): void {
    const body = el('div', {}, [
      el('h4', { text: '目标' }),
      el('div', { text: '在灯塔充能达到 100% 之前攻破曙光城。每日可发动一次攻城，战果跨天保留。' }),
      el('h4', { text: '议事厅' }),
      el('div', { text: '建造与升级建筑、改造精锐、决定当日配兵。所有建设在下一个战役日生效，会消耗尸骸与变异精华。' }),
      el('h4', { text: '战场操作' }),
      el('div', {
        class: 'keys',
        html: `
          <div><kbd>1</kbd>–<kbd>5</kbd></div><div>选择兵种部署卡（进入部署模式）</div>
          <div><kbd>左键</kbd></div><div>选卡后在合法区域投放一批；空手时选择单位或拖拽框选</div>
          <div><kbd>右键</kbd></div><div>命令选中部队移动 / 攻击目标；部署模式下取消</div>
          <div><kbd>Esc</kbd></div><div>取消部署模式 / 取消选择</div>
          <div><kbd>WASD</kbd></div><div>平移镜头</div>
          <div><kbd>滚轮</kbd></div><div>缩放镜头</div>
          <div><kbd>空格</kbd></div><div>镜头回到主军</div>
          <div><kbd>P</kbd></div><div>暂停 / 继续</div>
          <div><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd></div><div>君主技能（M3 后逐步开放）</div>
          <div><kbd>F</kbd></div><div>终局：全军冲锋</div>
        `,
      }),
      el('h4', { text: '胜负' }),
      el('div', { text: '灯塔生命值归零立即胜利；日终充能达到 100%、超过最大天数或终局失败即失败。' }),
    ]);
    const back = this.modal('操作说明', body, [
      el('button', { class: 'btn btn-sm btn-primary', text: '知道了', on: { click: () => back.remove() } }),
    ]);
    void back;
  }

  showSettings(): void {
    const muteBtn = el('button', {
      class: `btn btn-sm ${settings.muted ? '' : 'btn-primary'}`,
      text: settings.muted ? '音效：关闭' : '音效：开启',
      on: {
        click: (ev) => {
          setSettings({ muted: !settings.muted });
          const b = ev.currentTarget as HTMLButtonElement;
          b.textContent = settings.muted ? '音效：关闭' : '音效：开启';
          b.className = `btn btn-sm ${settings.muted ? '' : 'btn-primary'}`;
        },
      },
    });
    const qBtn = el('button', {
      class: 'btn btn-sm',
      text: settings.quality === 'high' ? '画质：高（完整特效）' : '画质：低（省性能）',
      on: {
        click: (ev) => {
          setSettings({ quality: settings.quality === 'high' ? 'low' : 'high' });
          (ev.currentTarget as HTMLButtonElement).textContent =
            settings.quality === 'high' ? '画质：高（完整特效）' : '画质：低（省性能）';
        },
      },
    });
    const body = el('div', {}, [
      el('h4', { text: '音频' }),
      el('div', { style: { display: 'flex', gap: '8px' } }, [muteBtn]),
      el('h4', { text: '性能' }),
      el('div', { style: { display: 'flex', gap: '8px' } }, [qBtn]),
      el('div', { style: { 'margin-top': '10px', 'font-size': '11.5px', color: '#63706b' }, text: '低画质会关闭部分粒子与光晕，并降低同屏特效密度。' }),
    ]);
    const back = this.modal('设置', body, [
      el('button', { class: 'btn btn-sm', text: '关闭', on: { click: () => back.remove() } }),
    ]);
    void back;
  }

  showCredits(): void {
    const body = el('div', {}, [
      el('h4', { text: '《丧尸围城：亡骸君主》' }),
      el('div', { text: '一款暗黑奇幻像素风的单人攻城策略游戏，软件工程课程项目。' }),
      el('h4', { text: '技术' }),
      el('div', { text: 'Phaser 3 · TypeScript · Vite · Vitest · GitHub Actions / Pages' }),
      el('h4', { text: '美术与音频' }),
      el('div', { text: '战场像素素材、地形、建筑、特效均由项目内程序化绘制（原创）。界面与图标为原创 SVG/CSS。关键视觉由 AI 图像模型生成后人工筛选，详见 docs/ASSET_LICENSES.md。' }),
      el('h4', { text: '声明' }),
      el('div', { text: '本作角色、城邦与剧情均为原创，不含任何《Overlord》或其他商业 IP 的角色、名称与素材。' }),
    ]);
    const back = this.modal('制作信息', body, [
      el('button', { class: 'btn btn-sm', text: '关闭', on: { click: () => back.remove() } }),
    ]);
    void back;
  }
}
