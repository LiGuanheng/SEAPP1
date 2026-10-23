import { P } from './palette';
import { Pix, mulberry32 } from './pixel';

export type FacilityArt =
  | 'throne'
  | 'brood1'
  | 'brood2'
  | 'brood3'
  | 'mutation'
  | 'altar'
  | 'lighthouse'
  | 'barracks'
  | 'arsenal'
  | 'power'
  | 'research'
  | 'medical'
  | 'mgtower'
  | 'cannontower'
  | 'aatower'
  | 'holytower';

interface Art {
  w: number;
  h: number;
  draw: (p: Pix, rng: () => number) => void;
}

/* ---------- 通用构件 ---------- */

function bricks(p: Pix, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string, rng: () => number): void {
  p.rect(x, y, w, h, base);
  const rowH = 7;
  for (let ry = 0; ry < h; ry += rowH) {
    const off = (Math.floor(ry / rowH) % 2) * 7;
    p.rect(x, y + ry, w, 1, dark);
    for (let rx = -off; rx < w; rx += 14) {
      p.rect(x + rx, y + ry, 1, rowH, dark);
      if (rx > 0 && rx < w - 1) p.rect(x + rx + 1, y + ry + 1, 1, rowH - 2, lit);
    }
  }
  for (let i = 0; i < w * h * 0.02; i++) {
    p.px(x + rng() * w, y + rng() * h, rng() < 0.5 ? lit : dark);
  }
}

function glowWindow(p: Pix, x: number, y: number, w: number, h: number, color: string): void {
  p.rect(x, y, w, h, '#141814');
  p.rect(x + 1, y + 1, w - 2, h - 2, color);
  p.rect(x + 1, y + 1, w - 2, 1, '#fff8dc');
  p.px(x + 1, y + h - 2, '#ffffff');
}

function shadowBase(p: Pix, cx: number, y: number, rx: number): void {
  p.ellipse(cx, y, rx, 4, 'rgba(0,0,0,0.42)');
}

function banner(p: Pix, x: number, y: number, h: number, color: string, lit: string): void {
  p.rect(x, y - 2, 2, h + 2, '#2a2118');
  p.poly(
    [
      [x + 2, y],
      [x + 11, y + 2],
      [x + 8, y + h * 0.45],
      [x + 11, y + h * 0.8],
      [x + 2, y + h],
    ],
    color,
  );
  p.poly(
    [
      [x + 3, y + 1],
      [x + 9, y + 3],
      [x + 7, y + h * 0.45],
      [x + 9, y + h * 0.75],
      [x + 3, y + h - 2],
    ],
    lit,
  );
  p.rect(x + 4, y + h * 0.35, 4, 4, P.gold);
}

function ruin(p: Pix, rng: () => number, cx: number, baseY: number, w: number): void {
  shadowBase(p, cx, baseY, w * 0.45);
  for (let i = 0; i < 10; i++) {
    const x = cx - w * 0.4 + rng() * w * 0.8;
    const h = 4 + rng() * 16;
    p.rect(x, baseY - h, 5 + rng() * 8, h, '#31342c');
    p.rect(x, baseY - h, 5, 1, '#474b3f');
  }
  p.rect(cx - w * 0.42, baseY - 4, w * 0.84, 4, '#262922');
  for (let i = 0; i < 14; i++) p.px(cx - w * 0.4 + rng() * w * 0.8, baseY - rng() * 8, '#5a5545');
}

/* ---------- 亡灵建筑 ---------- */

const UNDEAD_ART: Record<string, Art> = {
  throne: {
    w: 120,
    h: 108,
    draw: (p, rng) => {
      shadowBase(p, 60, 104, 44);
      // 台阶
      p.rect(14, 92, 92, 8, '#20261f');
      p.rect(14, 92, 92, 1, '#39412f');
      p.rect(22, 84, 76, 8, '#262d24');
      p.rect(22, 84, 76, 1, '#414a35');
      // 黑曜石台座
      p.poly(
        [
          [34, 84],
          [86, 84],
          [80, 52],
          [40, 52],
        ],
        '#1b211a',
      );
      p.poly(
        [
          [34, 84],
          [48, 84],
          [52, 52],
          [40, 52],
        ],
        '#2a3226',
      );
      // 椅背
      p.poly(
        [
          [44, 56],
          [76, 56],
          [80, 20],
          [68, 10],
          [52, 10],
          [40, 20],
        ],
        '#242b21',
      );
      p.poly(
        [
          [46, 54],
          [60, 54],
          [58, 18],
          [52, 14],
          [44, 22],
        ],
        '#333d2c',
      );
      // 骨刺
      for (let i = 0; i < 6; i++) {
        const x = 40 + i * 8;
        p.poly(
          [
            [x, 20],
            [x + 2, 4 + (i % 3) * 4],
            [x + 5, 20],
          ],
          P.boneDark,
        );
        p.px(x + 2, 8 + (i % 3) * 4, P.bone);
      }
      // 扶手
      p.rect(30, 54, 8, 30, '#20261d');
      p.rect(82, 54, 8, 30, '#20261d');
      p.rect(30, 54, 8, 2, '#3b4532');
      p.rect(82, 54, 8, 2, '#3b4532');
      p.rect(28, 50, 12, 6, P.boneDark);
      p.rect(80, 50, 12, 6, P.boneDark);
      // 座垫
      p.rect(44, 58, 32, 8, '#3a2a3c');
      p.rect(44, 58, 32, 2, '#553f57');
      // 魂火
      p.ellipse(60, 46, 7, 10, P.soulDeep);
      p.ellipse(60, 44, 4, 7, P.soulMid);
      p.ellipse(60, 42, 2, 4, P.soul);
      p.glow(60, 44, 26, 'rgba(125,255,160,0.4)', 0.9);
      // 地面刻纹
      for (let i = 0; i < 3; i++) {
        p.line(24 + i * 4, 100, 96 - i * 4, 100, 1, '#3b4a33');
      }
      p.outline('#0a0d0a');
      for (let i = 0; i < 20; i++) p.px(20 + rng() * 80, 60 + rng() * 40, '#4c5a3e');
    },
  },
  brood1: { w: 72, h: 64, draw: (p, rng) => brood(p, rng, 1) },
  brood2: { w: 82, h: 72, draw: (p, rng) => brood(p, rng, 2) },
  brood3: { w: 92, h: 80, draw: (p, rng) => brood(p, rng, 3) },
  mutation: {
    w: 84,
    h: 72,
    draw: (p, rng) => {
      shadowBase(p, 42, 68, 28);
      p.ellipse(42, 52, 28, 14, '#20261c');
      p.ellipse(42, 48, 24, 12, '#2c3524');
      // 池液
      p.ellipse(42, 46, 19, 9, P.soulDeep);
      p.ellipse(42, 45, 14, 6, '#2f8a58');
      p.ellipse(40, 44, 7, 3, '#68d894');
      for (let i = 0; i < 5; i++) {
        const bx = 28 + rng() * 28;
        const by = 42 + rng() * 6;
        p.ellipse(bx, by, 2, 2, P.soul);
        p.px(bx, by - 1, '#e8ffe0');
      }
      // 骨环
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        p.rect(42 + Math.cos(a) * 25 - 1, 52 + Math.sin(a) * 11 - 1, 3, 5, P.boneDark);
      }
      // 管道
      p.rect(12, 30, 8, 26, '#2a2a22');
      p.rect(16, 30, 2, 22, '#4a4a38');
      p.rect(64, 28, 8, 28, '#2a2a22');
      p.rect(66, 28, 2, 24, '#4a4a38');
      p.rect(72, 46, 10, 6, '#33301f');
      p.glow(42, 46, 26, 'rgba(125,255,160,0.45)', 0.8);
      p.outline('#0a0d0a');
    },
  },
  altar: {
    w: 88,
    h: 96,
    draw: (p, rng) => {
      shadowBase(p, 44, 92, 30);
      // 基座
      p.rect(18, 82, 52, 10, '#1e231b');
      p.rect(18, 82, 52, 1, '#3a4230');
      p.rect(24, 72, 40, 10, '#252c21');
      p.rect(24, 72, 40, 1, '#414a35');
      // 石柱
      p.block(22, 34, 9, 40, '#2b3227', '#454f38', '#151a12');
      p.block(57, 34, 9, 40, '#2b3227', '#454f38', '#151a12');
      // 顶部横梁
      p.rect(18, 28, 52, 8, '#232a1f');
      p.rect(18, 28, 52, 2, '#3d4733');
      // 头骨装饰
      for (let i = 0; i < 3; i++) {
        const x = 26 + i * 14;
        p.ellipse(x, 34, 4, 4, P.boneMid);
        p.rect(x - 2, 35, 2, 2, P.ink);
        p.rect(x + 1, 35, 2, 2, P.ink);
        p.px(x - 2, 35, P.soul);
        p.px(x + 2, 35, P.soul);
      }
      // 祭坛台面
      p.rect(28, 56, 32, 6, '#1a2018');
      p.rect(28, 56, 32, 1, '#47523a');
      // 魂火盆
      p.ellipse(44, 50, 8, 9, P.soulDeep);
      p.ellipse(44, 48, 5, 6, P.soulMid);
      p.ellipse(44, 45, 2, 4, P.soul);
      p.glow(44, 46, 34, 'rgba(125,255,160,0.42)', 0.95);
      // 符文
      for (let i = 0; i < 4; i++) p.line(30 + i * 8, 66, 33 + i * 8, 70, 1, '#3f7a52');
      p.outline('#0a0d0a');
      for (let i = 0; i < 16; i++) p.px(20 + rng() * 50, 60 + rng() * 28, '#3e4a32');
    },
  },
};

function brood(p: Pix, rng: () => number, level: number): void {
  const cx = p.w / 2;
  const baseY = p.h - 4;
  shadowBase(p, cx, baseY, 24 + level * 4);
  // 肉巢
  p.ellipse(cx, baseY - 8, 22 + level * 3, 12 + level * 2, '#2a2018');
  p.ellipse(cx, baseY - 10, 19 + level * 3, 10 + level * 2, '#3b2a1e');
  p.ellipse(cx, baseY - 12, 15 + level * 3, 8 + level * 2, '#4a3222');
  // 巢口
  p.ellipse(cx, baseY - 14, 9 + level * 2, 5 + level, '#120e0a');
  p.ellipse(cx, baseY - 14, 7 + level * 2, 4 + level, P.soulDeep);
  p.ellipse(cx, baseY - 15, 4 + level, 2 + level * 0.5, '#3f9a63');
  p.glow(cx, baseY - 15, 22 + level * 4, 'rgba(125,255,160,0.42)', 0.85);
  // 肋骨环
  const ribs = 8 + level * 2;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const rx = 21 + level * 3;
    const ry = 11 + level * 2;
    const x = cx + Math.cos(a) * rx;
    const y = baseY - 8 + Math.sin(a) * ry;
    p.line(x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 5 - 4, 2, P.boneDark);
    p.px(x + Math.cos(a) * 3, y + Math.sin(a) * 4 - 3, P.boneMid);
  }
  // 高等级：肉瘤与尖刺
  for (let i = 0; i < level * 3; i++) {
    const a = rng() * Math.PI * 2;
    const x = cx + Math.cos(a) * (14 + rng() * 10);
    const y = baseY - 10 + Math.sin(a) * (7 + rng() * 4);
    p.ellipse(x, y, 3, 2.5, '#5a3a28');
    p.px(x, y, '#7a5136');
  }
  for (let i = 0; i < level + 1; i++) {
    p.poly(
      [
        [cx - 16 + i * 14, baseY - 20],
        [cx - 13 + i * 14, baseY - 30 - level * 2],
        [cx - 10 + i * 14, baseY - 20],
      ],
      P.boneDark,
    );
  }
  p.outline('#0a0d0a');
  for (let i = 0; i < 14; i++) p.px(cx - 18 + rng() * 36, baseY - 20 + rng() * 18, '#241a12');
}

/* ---------- 人类建筑 ---------- */

const HUMAN_ART: Record<string, Art> = {
  lighthouse: {
    w: 112,
    h: 184,
    draw: (p, rng) => {
      shadowBase(p, 56, 180, 40);
      // 基座
      p.rect(26, 160, 60, 20, '#3a3d36');
      p.rect(26, 160, 60, 2, '#565b4e');
      p.rect(32, 152, 48, 10, '#43473e');
      p.rect(32, 152, 48, 2, '#616657');
      // 塔身（上窄下宽）
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const w = 44 - t * 18;
        const x = 56 - w / 2;
        const y = 40 + i * 22.5;
        bricks(p, x, y, w, 23, i % 2 === 0 ? '#3c4038' : '#43473d', '#5c6154', '#262a23', rng);
        // 金饰带
        p.rect(x, y + 20, w, 2, P.goldDark);
        p.rect(x, y + 20, w, 1, P.gold);
        // 窗
        if (i < 3) glowWindow(p, 56 - 3, y + 8, 6, 9, '#ffdf9a');
      }
      // 支撑扶壁
      for (const dir of [-1, 1]) {
        const x = 56 + dir * 20;
        p.poly(
          [
            [x, 148],
            [x + dir * 8, 156],
            [x + dir * 4, 120],
            [x, 120],
          ],
          '#33372f',
        );
        p.line(x, 122, x + dir * 3, 118, 1, '#4e5348');
      }
      // 观景台
      p.rect(30, 34, 52, 8, '#4a4f44');
      p.rect(30, 34, 52, 2, '#6d7365');
      p.rect(26, 30, 60, 5, '#3c4137');
      // 灯室
      p.rect(36, 14, 40, 18, '#2c3029');
      glowWindow(p, 40, 16, 32, 14, '#ffe7a8');
      p.rect(46, 16, 20, 14, '#fff6d8');
      p.rect(52, 18, 8, 10, '#ffffff');
      // 玻璃格
      for (let i = 0; i < 4; i++) p.rect(38 + i * 9, 14, 1, 18, '#1d2019');
      // 顶
      p.poly(
        [
          [34, 12],
          [56, 0],
          [78, 12],
        ],
        '#4a4f44',
      );
      p.poly(
        [
          [38, 11],
          [56, 3],
          [74, 11],
        ],
        P.goldDark,
      );
      p.rect(55, 0, 2, 10, P.gold);
      p.px(56, 0, P.goldLit);
      // 光晕
      p.glow(56, 24, 46, 'rgba(255,240,180,0.55)', 0.85);
      // 门
      p.poly(
        [
          [48, 180],
          [48, 164],
          [56, 158],
          [64, 164],
          [64, 180],
        ],
        '#241d15',
      );
      p.poly(
        [
          [50, 180],
          [50, 165],
          [56, 160],
          [62, 165],
          [62, 180],
        ],
        '#3e2f1f',
      );
      p.rect(55, 166, 1, 14, P.goldDark);
      p.outline('#0a0d0a');
      // 苔痕
      for (let i = 0; i < 24; i++) p.px(34 + rng() * 44, 80 + rng() * 100, '#3e4a38');
    },
  },
  barracks: {
    w: 112,
    h: 88,
    draw: (p, rng) => {
      shadowBase(p, 56, 84, 44);
      bricks(p, 16, 38, 80, 44, '#3d4038', '#5b6052', '#262a23', rng);
      // 屋顶
      p.poly(
        [
          [10, 38],
          [56, 14],
          [102, 38],
        ],
        '#3a3f36',
      );
      p.poly(
        [
          [14, 37],
          [56, 17],
          [98, 37],
        ],
        '#4b5145',
      );
      // 屋脊瓦
      for (let i = 0; i < 9; i++) p.rect(20 + i * 8, 36 - Math.abs(i - 4) * 4, 7, 2, '#3a3f36');
      // 门
      p.poly(
        [
          [46, 82],
          [46, 62],
          [56, 54],
          [66, 62],
          [66, 82],
        ],
        '#221b13',
      );
      p.poly(
        [
          [48, 82],
          [48, 63],
          [56, 56],
          [64, 63],
          [64, 82],
        ],
        '#4a3623',
      );
      p.rect(55, 60, 1, 22, P.goldDark);
      // 窗
      glowWindow(p, 28, 48, 8, 10, '#ffd88a');
      glowWindow(p, 76, 48, 8, 10, '#ffd88a');
      // 旗帜
      banner(p, 20, 42, 26, '#5a2a24', '#8e3a2f');
      banner(p, 92, 42, 26, '#5a2a24', '#8e3a2f');
      // 武器架
      p.rect(70, 74, 20, 2, '#3a2c1e');
      for (let i = 0; i < 4; i++) p.line(72 + i * 5, 74, 74 + i * 5, 62, 1, P.iron);
      p.outline('#0a0d0a');
    },
  },
  arsenal: {
    w: 112,
    h: 88,
    draw: (p, rng) => {
      shadowBase(p, 56, 84, 44);
      bricks(p, 14, 42, 84, 40, '#383c34', '#54594b', '#22251f', rng);
      // 厂房顶
      p.rect(10, 34, 92, 10, '#2e332b');
      p.rect(10, 34, 92, 2, '#4b5145');
      // 烟囱
      p.block(22, 6, 12, 30, '#3a332c', '#5a5142', '#1f1b16');
      p.rect(20, 4, 16, 5, '#4a4238');
      p.rect(20, 4, 16, 1, '#6b6252');
      p.ellipse(28, 2, 7, 3, 'rgba(120,120,120,0.25)');
      p.block(78, 12, 10, 24, '#3a332c', '#5a5142', '#1f1b16');
      p.rect(76, 10, 14, 5, '#4a4238');
      // 齿轮标志
      p.ellipse(56, 48, 11, 11, '#4b5145');
      p.ellipse(56, 48, 8, 8, '#2a2e26');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.rect(56 + Math.cos(a) * 12 - 1, 48 + Math.sin(a) * 12 - 1, 3, 3, '#5c6254');
      }
      p.ellipse(56, 48, 3, 3, P.goldDark);
      // 门
      p.rect(44, 66, 24, 16, '#1e1a14');
      p.rect(45, 67, 22, 14, '#3a2c1e');
      for (let i = 0; i < 4; i++) p.rect(46, 69 + i * 3, 20, 1, '#241b12');
      // 木箱
      p.rect(84, 72, 12, 10, '#4a3826');
      p.rect(84, 72, 12, 1, '#6b5136');
      p.rect(84, 78, 12, 1, '#2e2318');
      p.outline('#0a0d0a');
    },
  },
  power: {
    w: 88,
    h: 100,
    draw: (p, rng) => {
      shadowBase(p, 44, 96, 34);
      // 主厂房
      bricks(p, 16, 54, 56, 40, '#363b3a', '#525a58', '#212624', rng);
      p.rect(12, 48, 64, 8, '#2c3130');
      p.rect(12, 48, 64, 2, '#495150');
      // 线圈塔
      for (const dx of [0, 26]) {
        const x = 22 + dx;
        p.rect(x, 22, 10, 26, '#2b3134');
        p.rect(x, 22, 2, 26, '#49545a');
        for (let i = 0; i < 5; i++) p.rect(x - 2, 24 + i * 5, 14, 2, '#5a6a72');
        p.ellipse(x + 5, 20, 6, 4, '#7f98a4');
        p.glow(x + 5, 20, 10, 'rgba(150,220,255,0.6)', 0.8);
        // 电弧
        p.line(x + 5, 18, x + 5 + (dx === 0 ? 10 : -10), 26, 1, '#cfefff');
      }
      // 玻璃窗
      glowWindow(p, 30, 64, 10, 12, '#9fe4ff');
      glowWindow(p, 50, 64, 10, 12, '#9fe4ff');
      // 门
      p.rect(40, 78, 12, 16, '#1a2022');
      p.rect(41, 79, 10, 14, '#33454c');
      p.outline('#0a0d0a');
    },
  },
  research: {
    w: 96,
    h: 88,
    draw: (p, rng) => {
      shadowBase(p, 48, 84, 36);
      bricks(p, 18, 46, 60, 38, '#3b3f3d', '#585e59', '#232724', rng);
      // 圆顶
      p.ellipse(48, 46, 28, 22, '#3f4541');
      p.ellipse(48, 44, 25, 18, '#525a54');
      p.ellipse(46, 40, 16, 11, '#67716a');
      p.ellipse(44, 38, 9, 6, '#7d8a81');
      // 穹顶缝
      for (let i = -2; i <= 2; i++) {
        p.line(48 + i * 10, 30, 48 + i * 12, 58, 1, '#343a36');
      }
      // 天线
      p.rect(47, 8, 2, 20, '#5b6660');
      p.ellipse(48, 7, 4, 4, '#8fd8ff');
      p.glow(48, 7, 12, 'rgba(140,220,255,0.6)', 0.8);
      // 窗
      glowWindow(p, 28, 60, 9, 11, '#c8f0ff');
      glowWindow(p, 60, 60, 9, 11, '#c8f0ff');
      // 门
      p.rect(42, 70, 12, 14, '#1b1f1d');
      p.rect(43, 71, 10, 12, '#2f3a35');
      p.outline('#0a0d0a');
    },
  },
  medical: {
    w: 88,
    h: 76,
    draw: (p, rng) => {
      shadowBase(p, 44, 72, 34);
      bricks(p, 16, 36, 56, 36, '#4a4b44', '#6b6c60', '#2b2c27', rng);
      p.poly(
        [
          [10, 36],
          [44, 18],
          [78, 36],
        ],
        '#5a5a50',
      );
      p.poly(
        [
          [14, 35],
          [44, 21],
          [74, 35],
        ],
        '#6d6e61',
      );
      // 十字标志
      p.rect(39, 40, 10, 26, '#e8e2cf');
      p.rect(30, 49, 28, 9, '#e8e2cf');
      p.rect(41, 42, 6, 22, '#c8b06a');
      p.rect(32, 51, 24, 5, '#c8b06a');
      // 门
      p.rect(38, 62, 12, 10, '#20241f');
      p.rect(39, 63, 10, 9, '#3c463c');
      p.outline('#0a0d0a');
    },
  },
  mgtower: {
    w: 64,
    h: 96,
    draw: (p, rng) => {
      shadowBase(p, 32, 92, 22);
      bricks(p, 14, 34, 36, 58, '#3d4038', '#5b6052', '#262a23', rng);
      // 垛口
      for (let i = 0; i < 4; i++) p.rect(12 + i * 10, 28, 7, 8, '#43473e');
      p.rect(12, 34, 40, 3, '#5c6154');
      // 射击孔
      p.rect(26, 50, 12, 4, '#12150f');
      // 机枪
      p.rect(38, 46, 14, 3, '#2a2f2c');
      p.rect(38, 46, 14, 1, '#59615c');
      p.rect(50, 45, 4, 5, '#1d211e');
      // 沙袋
      for (let i = 0; i < 4; i++) {
        p.ellipse(14 + i * 10, 90, 7, 4, '#5a5342');
        p.ellipse(14 + i * 10, 89, 5, 3, '#6d6550');
      }
      // 旗
      p.rect(50, 20, 2, 16, '#2a2118');
      p.rect(52, 20, 8, 5, '#7e3a2f');
      p.outline('#0a0d0a');
    },
  },
  cannontower: {
    w: 64,
    h: 100,
    draw: (p, rng) => {
      shadowBase(p, 32, 96, 24);
      bricks(p, 12, 40, 40, 56, '#3a3d35', '#575c4e', '#24271f', rng);
      p.rect(10, 34, 44, 8, '#464a40');
      p.rect(10, 34, 44, 2, '#63685a');
      // 重炮
      p.rect(24, 12, 10, 26, '#2c2f2b');
      p.rect(24, 12, 10, 3, '#5d6259');
      p.rect(22, 6, 14, 8, '#3a3e38');
      p.rect(20, 4, 18, 4, '#4d5349');
      p.ellipse(32, 8, 4, 3, '#1a1d19');
      // 炮架
      p.rect(18, 34, 28, 5, '#3a332a');
      p.rect(18, 34, 28, 1, '#5a5142');
      // 弹药
      p.ellipse(52, 90, 4, 3, '#2a2f2c');
      p.ellipse(52, 89, 3, 2, '#5d6259');
      p.outline('#0a0d0a');
    },
  },
  aatower: {
    w: 56,
    h: 92,
    draw: (p, rng) => {
      shadowBase(p, 28, 88, 18);
      bricks(p, 12, 36, 32, 52, '#3c4038', '#585d4f', '#252822', rng);
      p.rect(10, 30, 36, 8, '#464a40');
      // 双管高射
      p.rect(20, 14, 4, 18, '#2a2e2a');
      p.rect(32, 14, 4, 18, '#2a2e2a');
      p.rect(18, 10, 20, 6, '#3c413a');
      p.rect(18, 10, 20, 1, '#5d6259');
      p.ellipse(28, 12, 5, 3, '#1a1d19');
      p.outline('#0a0d0a');
    },
  },
  holytower: {
    w: 56,
    h: 100,
    draw: (p, rng) => {
      shadowBase(p, 28, 96, 20);
      bricks(p, 14, 40, 28, 56, '#4a4d46', '#6f7268', '#2c2f29', rng);
      // 尖顶
      p.poly(
        [
          [14, 40],
          [28, 8],
          [42, 40],
        ],
        '#5a5d54',
      );
      p.poly(
        [
          [18, 39],
          [28, 13],
          [38, 39],
        ],
        P.goldDark,
      );
      p.rect(27, 2, 2, 10, P.gold);
      p.rect(23, 6, 10, 2, P.gold);
      p.ellipse(28, 44, 6, 8, P.holy);
      p.glow(28, 44, 20, 'rgba(255,240,190,0.55)', 0.85);
      p.outline('#0a0d0a');
    },
  },
};

export function buildFacilityCanvases(): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();
  const all: Record<string, Art> = { ...UNDEAD_ART, ...HUMAN_ART };
  for (const [key, art] of Object.entries(all)) {
    const p = new Pix(art.w, art.h);
    const rng = mulberry32(key.length * 131 + 17);
    art.draw(p, rng);
    out.set(`facility:${key}`, p.canvas);
  }
  return out;
}

export function buildRuinCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const p = new Pix(w, h);
  ruin(p, mulberry32(seed), w / 2, h - 2, w);
  return p.canvas;
}

/* ---------- 墙段 ---------- */

/** 水平墙贴图（32×56，可平铺）：垛口在上方，砖石主体向下 */
export function buildWallTile(vertical = false): HTMLCanvasElement {
  const p = new Pix(32, 56);
  const rng = mulberry32(vertical ? 77 : 42);
  // 墙体基座
  p.rect(0, 10, 32, 46, '#3f4238');
  p.rect(0, 10, 32, 2, '#5c6053');
  // 大块石料（两排）
  for (let row = 0; row < 4; row++) {
    const y = 14 + row * 9;
    const off = row % 2 === 0 ? 0 : -8;
    for (let i = -1; i < 3; i++) {
      const x = i * 16 + off;
      const shade = rng();
      const base = shade < 0.33 ? '#4a4d42' : shade < 0.66 ? '#545849' : '#43463c';
      p.rect(x + 1, y + 1, 14, 7, base);
      p.rect(x + 1, y + 1, 14, 1, '#6e7362');
      p.rect(x + 1, y + 7, 14, 1, '#282b23');
      p.px(x + 2, y + 2, '#7d8271');
    }
    p.rect(0, y + 8, 32, 1, '#2a2d25');
  }
  // 壁柱：每 32px 一根，让平铺看起来是建筑而非贴图
  p.rect(0, 8, 5, 48, '#4e5246');
  p.rect(0, 8, 2, 48, '#6b7060');
  p.rect(4, 8, 1, 48, '#31352c');
  p.rect(0, 8, 5, 2, '#767b68');
  // 垛口
  p.rect(0, 0, 32, 9, '#44473c');
  p.rect(0, 0, 32, 2, '#6f7462');
  p.rect(0, 7, 32, 2, '#2a2d25');
  p.rect(6, 0, 4, 8, '#2f322a');
  p.rect(21, 0, 4, 8, '#2f322a');
  // 底部阴影与苔痕
  p.rect(0, 52, 32, 4, '#20231c');
  p.rect(0, 52, 32, 1, '#12140f');
  for (let i = 0; i < 16; i++) {
    p.px(rng() * 32, 14 + rng() * 38, rng() < 0.5 ? '#3a4a32' : '#5a5e4e');
  }
  if (vertical) {
    const v = new Pix(56, 32);
    v.ctx.save();
    v.ctx.translate(28, 16);
    v.ctx.rotate(Math.PI / 2);
    v.ctx.drawImage(p.canvas, -16, -28);
    v.ctx.restore();
    return v.canvas;
  }
  return p.canvas;
}

export function buildGateCanvas(w: number): HTMLCanvasElement {
  const p = new Pix(w, 64);
  const rng = mulberry32(9);
  bricks(p, 0, 18, w, 44, '#45473f', '#686b5d', '#2a2c26', rng);
  // 门洞
  const cx = w / 2;
  p.poly(
    [
      [cx - 22, 62],
      [cx - 22, 34],
      [cx, 20],
      [cx + 22, 34],
      [cx + 22, 62],
    ],
    '#1d1710',
  );
  // 铁门
  p.rect(cx - 20, 36, 40, 26, '#3a332a');
  for (let i = 0; i < 6; i++) p.rect(cx - 20 + i * 7, 36, 2, 26, '#221d16');
  p.rect(cx - 20, 36, 40, 2, '#5d5142');
  for (let i = 0; i < 3; i++) p.rect(cx - 20, 40 + i * 8, 40, 2, '#4a4034');
  // 门钉
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) p.px(cx - 16 + x * 8, 42 + y * 8, '#7a6e58');
  // 城楼
  p.rect(0, 0, w, 20, '#4a4c44');
  for (let i = 0; i < Math.floor(w / 16); i++) {
    p.rect(i * 16 + 3, 0, 10, 8, '#4a4c44');
    p.rect(i * 16 + 3, 0, 10, 2, '#717466');
  }
  p.rect(0, 18, w, 2, '#2a2c26');
  // 旗帜
  for (const bx of [10, w - 22]) {
    p.rect(bx, 4, 2, 14, '#2a2118');
    p.poly(
      [
        [bx + 2, 4],
        [bx + 12, 6],
        [bx + 9, 10],
        [bx + 12, 14],
        [bx + 2, 14],
      ],
      '#7e3a2f',
    );
  }
  p.outline('#0a0d0a');
  return p.canvas;
}

/** 选中的部署圈 */
export function buildZoneRing(radius: number, color: string): HTMLCanvasElement {
  const size = Math.ceil(radius * 2 + 8);
  const p = new Pix(size, size);
  const cx = size / 2;
  const cy = size / 2;
  for (let a = 0; a < Math.PI * 2; a += 0.012) {
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius * 0.62;
    p.px(x, y, color);
    if (Math.floor(a * 20) % 4 === 0) p.px(x, y - 1, color);
  }
  return p.canvas;
}
