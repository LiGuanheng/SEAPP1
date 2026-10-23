import { el } from './dom';

interface Beat {
  kicker: string;
  title: string;
  text: string;
  hold: number;
}

const BEATS: Beat[] = [
  {
    kicker: 'I · 黑蚀纪元',
    title: '灯塔亮起的那一夜，世界死了。',
    text: '黑蚀自地底涌出，吞噬了田野与城镇。人类烧掉森林、填平河流，最后退守到一座军事化的孤城——曙光城。',
    hold: 5200,
  },
  {
    kicker: 'II · 中央灯塔',
    title: '他们用光，把死者钉在土里。',
    text: '城心的灯塔以净化之能驱散黑蚀。只要它仍在燃烧，亡者便无法越过城墙；只要它完成充能，所有苏醒的死者都将再度长眠。',
    hold: 5200,
  },
  {
    kicker: 'III · 亡骸王座',
    title: '但王座之下，有东西睁开了眼。',
    text: '阿兹拉克，被遗忘的亡骸君主，从千年古墓中坐起。幽绿的魂火沿着骸骨攀爬，荒原上每一具尸体都开始抽搐、起身、朝同一个方向跪伏。',
    hold: 5600,
  },
  {
    kicker: 'IV · 万骸归一',
    title: '「让那盏灯，熄灭。」',
    text: '你统帅的不是军队，是死亡本身。攻破外墙，踏平兵营，拆掉为灯塔供能的每一座能源站；或在最后一日献祭整个王国，倾尽所有，一次埋葬黎明。',
    hold: 5600,
  },
];

export function showIntro(root: HTMLElement, onDone: () => void, onSkip?: () => void): void {
  const screen = el('div', { class: 'screen intro-screen vignette' });
  const bg = el('img', { class: 'intro-art', attrs: { src: 'assets/art/keyart.jpg', alt: '' } });
  bg.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.72;animation:intro-zoom 22s ease-out both;filter:saturate(0.95) contrast(1.05)';
  const shade = el('div');
  shade.style.cssText =
    'position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,5,5,0.94) 0%,rgba(3,5,5,0.72) 38%,rgba(3,5,5,0.12) 70%,rgba(3,5,5,0.45) 100%),radial-gradient(90% 80% at 60% 45%,transparent 30%,rgba(0,0,0,0.6) 100%)';
  const copy = el('div', { class: 'intro-copy' });

  const skip = el('button', {
    class: 'intro-skip',
    text: '跳过 ▸',
    on: {
      click: () => {
        if (stopped) return;
        finish();
        if (onSkip) onSkip();
        else onDone();
      },
    },
  });
  const bar = el('div', { class: 'intro-bar' }, [el('i')]);
  screen.append(bg, shade, copy, skip, bar);
  root.append(screen);

  const fill = bar.firstElementChild as HTMLElement;
  let idx = -1;
  let stopped = false;
  const timers: number[] = [];

  const showBeat = (i: number) => {
    if (stopped) return;
    idx = i;
    if (i >= BEATS.length) {
      finish();
      onDone();
      return;
    }
    copy.style.opacity = '0';
    copy.style.transform = 'translateY(12px)';
    window.setTimeout(() => {
      if (stopped) return;
      const b = BEATS[i];
      copy.innerHTML = '';
      copy.append(
        el('div', { class: 'kicker', text: b.kicker }),
        el('h1', { text: b.title }),
        el('p', { text: b.text }),
      );
      copy.style.opacity = '1';
      copy.style.transform = 'translateY(0)';
      timers.push(window.setTimeout(() => showBeat(i + 1), b.hold));
    }, 520);
  };

  const start = performance.now();
  const tick = () => {
    if (stopped) return;
    const total = BEATS.reduce((a, b) => a + b.hold + 520, 0);
    const p = Math.min(1, (performance.now() - start) / total);
    fill.style.width = `${p * 100}%`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const finish = () => {
    stopped = true;
    for (const t of timers) window.clearTimeout(t);
    screen.style.transition = 'opacity 0.6s ease';
    screen.style.opacity = '0';
    window.setTimeout(() => screen.remove(), 620);
  };

  showBeat(0);
  void idx;
}
