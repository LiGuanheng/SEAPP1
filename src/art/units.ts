import { P } from './palette';
import { Pix, mulberry32, type Pt } from './pixel';

export type PoseKind = 'idle' | 'walk' | 'attack' | 'hit' | 'death';
export type UnitArtType = 'zombie' | 'runner' | 'brute' | 'spider' | 'boss' | 'lord' | 'infantry' | 'gunner' | 'sniper' | 'paladin';

export interface Pose {
  kind: PoseKind;
  i: number;
}

interface HumanoidCfg {
  w: number;
  h: number;
  ground: number;
  hipY: number;
  shoulderY: number;
  headY: number;
  headR: number;
  shoulderW: number;
  hipW: number;
  hunch: number;
  skin: string;
  skinLit: string;
  skinDark: string;
  cloth: string;
  clothLit: string;
  clothDark: string;
  armor?: string;
  armorLit?: string;
  armorDark?: string;
  eye: string;
  helmet?: 'steel' | 'cap' | 'hood' | 'crown' | 'horned' | 'white' | 'skull';
  weapon: 'claw' | 'axe' | 'rifle' | 'longrifle' | 'sword' | 'hammer' | 'staff' | 'club';
  shield?: boolean;
  spikes?: boolean;
  ribs?: boolean;
  cape?: boolean;
}

/* ---------------- 通用绘制 ---------------- */

/** 带高光与暗部的粗折线（用于四肢） */
function limb(p: Pix, pts: Pt[], t: number, base: string, lit: string, dark: string): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    p.line(x0 + 1, y0, x1 + 1, y1, t, dark);
    p.line(x0, y0, x1, y1, t, base);
    p.line(x0, y0 - 1, x1, y1 - 1, Math.max(1, t - 2), lit);
  }
}

/** 躯干：上宽下窄的梯形，带三点明暗 */
function torso(p: Pix, c: HumanoidCfg, cx: number, lean: number): void {
  const sy = c.shoulderY + lean;
  const sx = cx + c.hunch * 2;
  const topL = sx - c.shoulderW;
  const topR = sx + c.shoulderW;
  const waistY = c.shoulderY + (c.hipY - c.shoulderY) * 0.62 + lean;
  const waistW = c.hipW * 0.84;
  const botL = cx - c.hipW;
  const botR = cx + c.hipW;

  // 胸腔
  p.poly(
    [
      [cx - waistW, waistY],
      [cx + waistW, waistY],
      [topR, sy],
      [topL, sy],
    ],
    c.skin,
  );
  // 腹部
  p.poly(
    [
      [botL, c.hipY],
      [botR, c.hipY],
      [cx + waistW, waistY],
      [cx - waistW, waistY],
    ],
    c.skin,
  );
  // 右侧暗面
  p.poly(
    [
      [cx + c.hipW * 0.15, c.hipY],
      [botR, c.hipY],
      [topR, sy],
      [cx + c.shoulderW * 0.35, sy],
    ],
    c.skinDark,
  );
  // 左侧受光
  p.line(topL + 1, sy + 1, cx - waistW + 1, waistY - 1, 2, c.skinLit);
  p.line(cx - c.hipW + 1, waistY + 1, cx - c.hipW + 1, c.hipY - 1, 2, c.skinLit);
  // 胸骨中线
  p.line(cx, sy + 3, cx, waistY - 2, 1, c.skinDark);

  // 颈
  p.rect(cx - 2.5, sy - 4, 5, 5, c.skinDark);
  p.rect(cx - 1, sy - 4, 3, 4, c.skin);
  p.px(cx - 1, sy - 3, c.skinLit);

  if (c.ribs) {
    // 单侧肋骨，打破对称
    for (let i = 0; i < 3; i++) {
      const y = sy + 6 + i * 3.2;
      p.rect(cx - c.shoulderW * 0.6, y, 4, 1, c.skinLit);
      p.rect(cx - c.shoulderW * 0.6, y + 1, 4, 1, c.skinDark);
    }
    p.rect(cx + 1, sy + 10, 2, 1, P.boneDark);
    p.px(cx + 2, sy + 11, P.boneMid);
  }

  if (c.armor) {
    const plateBottom = sy + Math.min(10, (waistY - sy) * 0.85);
    p.poly(
      [
        [topL + 1, sy + 1],
        [topR - 1, sy + 1],
        [topR - 2, plateBottom],
        [topL + 2, plateBottom],
      ],
      c.armorDark ?? c.armor,
    );
    p.poly(
      [
        [topL + 2, sy + 2],
        [topR - 2, sy + 2],
        [topR - 3, sy + 6],
        [topL + 3, sy + 6],
      ],
      c.armor ?? '#888',
    );
    p.line(topL + 3, sy + 2, topR - 4, sy + 2, 1, c.armorLit ?? c.armor);
    p.line(cx, sy + 3, cx, plateBottom - 1, 1, c.armorLit ?? c.armor);
    if (c.shoulderW > 16) {
      // 巨大胸甲上的骨徽与金边
      p.rect(topL + 3, sy + 2, topR - topL - 6, 1, P.goldDark);
      p.rect(topL + 3, plateBottom - 2, topR - topL - 6, 1, P.goldDark);
      p.ellipse(cx, sy + 8, 4, 4, P.boneDark);
      p.ellipse(cx, sy + 8, 2, 2, P.ink);
      p.px(cx - 2, sy + 7, P.gold);
      p.px(cx + 2, sy + 7, P.gold);
    }
    // 肩甲
    p.block(topL - 2, sy - 2, 7, 6, c.armor, c.armorLit ?? c.armor, c.armorDark ?? c.armor);
    p.block(topR - 5, sy - 2, 7, 6, c.armor, c.armorLit ?? c.armor, c.armorDark ?? c.armor);
    p.rect(topL - 1, sy + 3, 5, 1, c.armorDark ?? c.armor);
    p.rect(topR - 4, sy + 3, 5, 1, c.armorDark ?? c.armor);
  } else if (c.hunch > 0.6) {
    // 单肩破布，增加剪影不对称
    p.poly(
      [
        [topL, sy],
        [topL + 5, sy - 1],
        [topL + 4, sy + 7],
        [topL - 1, sy + 5],
      ],
      c.cloth,
    );
    p.line(topL, sy + 1, topL + 4, sy, 1, c.clothLit);
  }

  // 腰带 / 破布
  p.rect(botL - 1, c.hipY - 2, c.hipW * 2 + 2, 4, c.cloth);
  p.rect(botL - 1, c.hipY - 2, c.hipW * 2 + 2, 1, c.clothLit);
  p.rect(botL - 1, c.hipY + 1, c.hipW * 2 + 2, 1, c.clothDark);
  for (let i = 0; i < 4; i++) {
    const x = botL + 1 + i * ((c.hipW * 2) / 4);
    const len = 2 + ((i * 7) % 3);
    p.rect(x, c.hipY + 2, 2, len, c.cloth);
    p.px(x, c.hipY + 2 + len, c.clothDark);
  }

  if (c.spikes) {
    for (let i = 0; i < 3; i++) {
      const bx = topL + 2 + i * (c.shoulderW - 2);
      p.poly(
        [
          [bx, sy - 1],
          [bx + 2, sy - 8],
          [bx + 4, sy - 1],
        ],
        P.boneDark,
      );
      p.px(bx + 2, sy - 7, P.bone);
    }
  }
}

function skullHead(p: Pix, c: HumanoidCfg, hx: number, hy: number, r: number): void {
  // 颅骨
  p.ellipse(hx, hy, r, r - 0.5, c.skin);
  p.ellipse(hx - 1, hy - 1.5, r - 1.6, r - 2.2, c.skinLit);
  // 右缘暗部
  for (let y = -Math.floor(r); y <= Math.floor(r * 0.4); y++) {
    const half = Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))) * r;
    p.rect(hx + half - 1, hy + y, 2, 1, c.skinDark);
  }
  // 眉骨投影
  p.rect(hx - r + 1, hy + 0.5, r * 2 - 2, 1, c.skinDark);
  // 眼窝
  const ex = Math.round(r * 0.42);
  p.rect(hx - ex - 1, hy + 1, 3, 3, P.ink);
  p.rect(hx + ex - 2, hy + 1, 3, 3, P.ink);
  p.px(hx - ex, hy + 2, c.eye);
  p.px(hx + ex, hy + 2, c.eye);
  p.px(hx - ex, hy + 3, c.eye);
  p.px(hx + ex, hy + 3, c.eye);
  // 鼻腔
  p.rect(hx - 0.5, hy + 4, 2, 2, P.ink);
  // 颧骨与下颌
  p.rect(hx - r + 1, hy + r - 3, 2, 2, c.skinDark);
  p.rect(hx + r - 2, hy + r - 3, 2, 2, c.skinDark);
  p.rect(hx - r + 2, hy + r - 1, r * 2 - 4, Math.max(2, r * 0.35), c.skinDark);
  // 牙
  for (let i = 0; i < 4; i++) {
    p.rect(hx - 3 + i * 2, hy + r - 1, 1, 2, P.bone);
  }
  // 颅顶骨缝
  p.line(hx, hy - r + 1, hx, hy - r + 4, 1, c.skinDark);
}

function helmetHead(p: Pix, c: HumanoidCfg, hx: number, hy: number, r: number): void {
  if (c.helmet === 'hood') {
    p.ellipse(hx, hy, r + 1, r + 1, '#3a3a45');
    p.ellipse(hx, hy + 1.5, r - 1, r - 1, '#212129');
    p.rect(hx - 2, hy, 1, 1, '#cfe0cf');
    p.rect(hx + 2, hy, 1, 1, '#cfe0cf');
    p.rect(hx - r - 1, hy + 2, r * 2 + 2, 2, '#2c2c35');
    return;
  }
  if (c.helmet === 'cap') {
    p.ellipse(hx, hy + 1, r - 1, r - 1, c.skin);
    p.ellipse(hx, hy - 1, r + 1, r - 1, '#3f4d38');
    p.rect(hx - r - 1, hy, r * 2 + 2, 1, '#526346');
    p.rect(hx - r - 2, hy, r * 2 + 4, 2, '#2f3a29');
    p.rect(hx - 2, hy + 1, 1, 1, '#20261d');
    p.rect(hx + 2, hy + 1, 1, 1, '#20261d');
    return;
  }
  if (c.helmet === 'skull') {
    skullHead(p, c, hx, hy, r);
    return;
  }

  const white = c.helmet === 'white';
  const base = white ? '#dfe8e8' : P.steel;
  const lit = white ? '#ffffff' : P.steelLit;
  const dark = white ? '#9aa8ac' : P.steelDark;

  // 面部
  p.ellipse(hx, hy + 2, r - 1, r - 2, c.skin);
  p.rect(hx - 2, hy + 1, 1, 1, '#231d18');
  p.rect(hx + 2, hy + 1, 1, 1, '#231d18');
  p.rect(hx - 1, hy + 3, 3, 1, c.skinDark);
  // 头盔主体
  p.ellipse(hx, hy - 1, r + 1, r, base);
  p.ellipse(hx - 0.5, hy - 2, r - 1, r - 2, lit);
  p.rect(hx - r - 1, hy + 1, r * 2 + 2, 2, base);
  p.rect(hx - r - 1, hy + 3, r * 2 + 2, 1, dark);
  // 护鼻
  p.rect(hx - 1, hy, 2, 4, base);
  p.px(hx - 1, hy, lit);
  // 顶脊
  p.rect(hx - 1, hy - r - 2, 2, 3, dark);
  p.px(hx - 1, hy - r - 2, lit);

  if (c.helmet === 'horned') {
    p.poly(
      [
        [hx - r - 1, hy - 2],
        [hx - r - 7, hy - 10],
        [hx - r + 1, hy - 6],
      ],
      P.boneDark,
    );
    p.poly(
      [
        [hx + r + 1, hy - 2],
        [hx + r + 7, hy - 10],
        [hx + r - 1, hy - 6],
      ],
      P.boneDark,
    );
    p.line(hx - r - 5, hy - 8, hx - r - 2, hy - 4, 1, P.bone);
    p.line(hx + r + 5, hy - 8, hx + r + 2, hy - 4, 1, P.bone);
  }
  if (c.helmet === 'white') {
    p.rect(hx - 1, hy - r - 3, 2, 6, P.gold);
    p.rect(hx - 3, hy - r - 1, 6, 2, P.gold);
    p.px(hx - 1, hy - r - 2, P.holy);
  }
  if (c.helmet === 'crown') {
    p.poly([[hx - 6, hy - 4], [hx - 8, hy - 13], [hx - 3, hy - 7]], P.goldDark);
    p.poly([[hx - 1, hy - 7], [hx, hy - 16], [hx + 2, hy - 7]], P.gold);
    p.poly([[hx + 6, hy - 4], [hx + 8, hy - 13], [hx + 3, hy - 7]], P.goldDark);
    p.px(hx, hy - 15, P.goldLit);
  }
}

function drawWeapon(p: Pix, c: HumanoidCfg, hx: number, hy: number, raised: boolean): void {
  const swing = raised ? 1 : 0;
  const s = Math.max(1, c.w / 48);
  switch (c.weapon) {
    case 'claw': {
      for (let i = -1; i <= 1; i++) {
        p.line(hx + i * 2, hy + 1, hx + i * 2 - 1, hy + 4, 1, P.boneMid);
        p.px(hx + i * 2 - 1, hy + 4, P.bone);
      }
      break;
    }
    case 'club': {
      const ty = hy - 13 * s - swing * 6;
      p.line(hx, hy + 2, hx + 3 * s, ty, Math.round(3 * s), P.woodDark);
      p.line(hx, hy + 2, hx + 3 * s, ty, Math.max(1, Math.round(s)), P.wood);
      p.ellipse(hx + 3 * s, ty - 3 * s, 5.5 * s, 6.5 * s, '#2a2016');
      p.ellipse(hx + 3 * s, ty - 4 * s, 4.5 * s, 5.5 * s, '#4a3a26');
      p.rect(hx + 2 * s, ty - 6 * s, 2 * s, 2 * s, P.boneMid);
      p.rect(hx + 6 * s, ty - 2 * s, s, 2 * s, P.boneDark);
      break;
    }
    case 'axe': {
      const ty = hy - 30 * s - swing * 10;
      p.line(hx, hy + 8, hx + 2 * s, ty, Math.round(4 * s), '#1d150e');
      p.line(hx, hy + 8, hx + 2 * s, ty, Math.max(1, Math.round(1.6 * s)), '#6b5136');
      // 巨斧刃：上缘亮，下缘暗
      p.poly(
        [
          [hx + 2 * s, ty + 4 * s],
          [hx + 11 * s, ty - 7 * s],
          [hx + 14 * s, ty + 2 * s],
          [hx + 12 * s, ty + 13 * s],
          [hx + 4 * s, ty + 12 * s],
        ],
        '#3f4a4e',
      );
      p.poly(
        [
          [hx + 3 * s, ty + 4 * s],
          [hx + 10 * s, ty - 4 * s],
          [hx + 12 * s, ty + 2 * s],
          [hx + 7 * s, ty + 9 * s],
        ],
        '#87949a',
      );
      p.line(hx + 10 * s, ty - 5 * s, hx + 12.5 * s, ty + 11 * s, 1, '#d3dee2');
      // 背面尖刺
      p.poly(
        [
          [hx + 1 * s, ty + 5 * s],
          [hx - 5 * s, ty - 2 * s],
          [hx - 2 * s, ty + 9 * s],
        ],
        '#2e3539',
      );
      p.rect(hx + 1 * s, ty + 5 * s, 4 * s, 9 * s, '#33261a');
      p.rect(hx + 1 * s, ty + 5 * s, 4 * s, s, '#5a4630');
      break;
    }
    case 'rifle': {
      p.rect(hx - 5 * s, hy, 13 * s, 2 * s, P.ironDark);
      p.rect(hx - 5 * s, hy, 13 * s, Math.max(1, s), P.iron);
      p.rect(hx + 8 * s, hy + s, 4 * s, Math.max(1, s), '#22282b');
      p.rect(hx - 6 * s, hy + s, 3 * s, 3 * s, P.wood);
      p.rect(hx + 3 * s, hy + 2 * s, s, s, P.gold);
      break;
    }
    case 'longrifle': {
      p.rect(hx - 7 * s, hy, 20 * s, 2 * s, P.ironDark);
      p.rect(hx - 7 * s, hy, 20 * s, Math.max(1, s), P.iron);
      p.rect(hx + 10 * s, hy - s, 5 * s, Math.max(1, s), '#c9d8c9');
      p.rect(hx - 8 * s, hy + s, 4 * s, 3 * s, P.wood);
      p.rect(hx + 2 * s, hy - 3 * s, 4 * s, Math.max(1, s), '#3c464a');
      break;
    }
    case 'sword': {
      p.line(hx, hy + 3, hx + 1, hy + 9, 2, P.goldDark);
      p.rect(hx - 3, hy + 2, 6, 1, P.gold);
      p.rect(hx - 1, hy + 3, 2, 2, P.cloth);
      const tipY = hy - 13;
      p.line(hx + 1, hy, hx + 2, tipY, 3, P.steelDark);
      p.line(hx + 1, hy, hx + 2, tipY, 2, P.steel);
      p.line(hx + 1, hy - 1, hx + 2, tipY, 1, P.steelLit);
      break;
    }
    case 'hammer': {
      p.line(hx, hy + 4, hx + 1, hy - 11, 3, '#3a2c1c');
      p.line(hx, hy + 4, hx + 1, hy - 11, 1, '#70593a');
      p.rect(hx - 5, hy - 17, 13, 7, P.goldDark);
      p.rect(hx - 4, hy - 16, 11, 4, P.gold);
      p.rect(hx - 2, hy - 15, 5, 2, P.holy);
      p.px(hx + 1, hy - 14, '#ffffff');
      break;
    }
    case 'staff': {
      const ty = hy - 26 * s;
      p.line(hx, hy + 8, hx + 1, ty, 3, '#1d1710');
      p.line(hx, hy + 8, hx + 1, ty, 1, '#6a5334');
      p.ellipse(hx + 1, ty - 4, 5 * s, 6 * s, P.soulDeep);
      p.ellipse(hx + 1, ty - 4, 3 * s, 4 * s, P.soulMid);
      p.ellipse(hx + 1, ty - 4, 1.5 * s, 2.5 * s, P.soul);
      p.px(hx + 1, ty - 5, '#f0ffe0');
      p.glow(hx + 1, ty - 4, 10 * s, 'rgba(140,255,120,0.5)', 0.85);
      break;
    }
  }
}

function drawCape(p: Pix, c: HumanoidCfg, cx: number): void {
  const sy = c.shoulderY;
  p.poly(
    [
      [cx - c.shoulderW + 1, sy + 1],
      [cx + c.shoulderW - 1, sy + 1],
      [cx + c.shoulderW + 3, c.ground - 4],
      [cx + 1, c.ground - 8],
      [cx - c.shoulderW - 4, c.ground - 3],
    ],
    c.clothDark,
  );
  p.poly(
    [
      [cx - c.shoulderW + 2, sy + 3],
      [cx + 1, sy + 3],
      [cx - 2, c.ground - 9],
      [cx - c.shoulderW - 1, c.ground - 6],
    ],
    c.cloth,
  );
  p.line(cx - c.shoulderW - 2, c.ground - 4, cx - c.shoulderW + 2, sy + 4, 1, c.clothLit);
}

function drawHumanoid(c: HumanoidCfg, pose: Pose): Pix {
  const p = new Pix(c.w, c.h);
  const cx = Math.floor(c.w / 2);
  let bob = 0;
  let legSwing = 0;
  let armSwing = 0;
  let lean = 0;
  let crouch = 0;

  if (pose.kind === 'idle') {
    bob = pose.i === 0 ? 0 : 1;
    legSwing = 1;
  } else if (pose.kind === 'walk') {
    const ph = (pose.i / 4) * Math.PI * 2;
    legSwing = Math.sin(ph) * 4;
    armSwing = -Math.sin(ph) * 3;
    bob = Math.round(Math.abs(Math.sin(ph * 2)) * 1.4);
  } else if (pose.kind === 'attack') {
    lean = pose.i === 0 ? -2 : 3;
    crouch = pose.i === 0 ? 1 : 0;
    armSwing = pose.i === 0 ? -6 : 5;
    legSwing = pose.i === 0 ? -2 : 3;
  } else if (pose.kind === 'hit') {
    lean = -3;
    crouch = 1;
    legSwing = -2;
  }

  // 阴影
  p.ellipse(cx, c.ground - 1, c.shoulderW + 2, 3, 'rgba(0,0,0,0.4)');

  if (c.cape) drawCape(p, c, cx);

  const hipY = c.hipY + crouch + bob;
  const shoulderY = c.shoulderY + lean + crouch + bob;
  const legTop = hipY - 1;
  const footY = c.ground - 2;

  // 后腿
  const backHip = cx - c.hipW * 0.55;
  const backKneeX = backHip - legSwing * 0.55;
  const backFootX = backHip - legSwing;
  limb(
    p,
    [
      [backHip, legTop],
      [backKneeX, (legTop + footY) / 2],
      [backFootX, footY],
    ],
    Math.max(4, Math.round(c.shoulderW * 0.4)),
    c.clothDark,
    c.cloth,
    '#15121a',
  );
  p.rect(backFootX - 2, footY, 5, 2, '#241f1a');

  // 后臂
  const backShX = cx - c.shoulderW + 1 + c.hunch * 2;
  const backElbowX = backShX - 3 - armSwing * 0.4;
  const backHandX = backShX - 3 - armSwing;
  const backHandY = hipY - 2;
  limb(
    p,
    [
      [backShX, shoulderY + 2],
      [backElbowX, shoulderY + 7],
      [backHandX, backHandY],
    ],
    Math.max(2, Math.round(c.shoulderW * 0.3)),
    c.skinDark,
    c.skin,
    '#1a2016',
  );

  // 躯干
  torso(p, { ...c, hipY, shoulderY }, cx, 0);

  // 前腿
  const frontHip = cx + c.hipW * 0.55;
  const frontKneeX = frontHip + legSwing * 0.55;
  const frontFootX = frontHip + legSwing;
  limb(
    p,
    [
      [frontHip, legTop],
      [frontKneeX, (legTop + footY) / 2],
      [frontFootX, footY],
    ],
    Math.max(3, Math.round(c.shoulderW * 0.34)),
    c.cloth,
    c.clothLit,
    c.clothDark,
  );
  p.rect(frontFootX - 2, footY, 5, 2, '#2f2820');
  p.px(frontFootX - 2, footY, '#4a3f31');

  // 头
  const hx = cx + c.hunch * 2.5 + lean * 0.3;
  const hy = c.headY + lean + crouch + bob;
  if (c.helmet && c.helmet !== 'skull') helmetHead(p, c, hx, hy, c.headR);
  else skullHead(p, c, hx, hy, c.headR);

  // 前臂 + 武器
  const frontShX = cx + c.shoulderW - 2 + c.hunch * 2;
  const frontElbowX = frontShX + 4 + armSwing * 0.4;
  const frontHandX = frontShX + 4 + armSwing;
  const frontHandY = hipY - 4 - (pose.kind === 'attack' && pose.i === 1 ? 5 : 0);
  limb(
    p,
    [
      [frontShX, shoulderY + 2],
      [frontElbowX, shoulderY + 6],
      [frontHandX, frontHandY],
    ],
    Math.max(2, Math.round(c.shoulderW * 0.32)),
    c.skin,
    c.skinLit,
    c.skinDark,
  );
  drawWeapon(p, c, frontHandX, frontHandY, pose.kind === 'attack' && pose.i === 1);

  if (c.shield) {
    const sx = cx - c.shoulderW - 2;
    const sy = hipY - 6;
    p.ellipse(sx, sy, 6, 8, P.steelDark);
    p.ellipse(sx, sy, 5, 7, P.steel);
    p.ellipse(sx - 1, sy - 1, 3, 4, P.steelLit);
    p.rect(sx - 1, sy - 2, 2, 5, P.gold);
    p.rect(sx - 2, sy - 1, 5, 2, P.gold);
    p.px(sx, sy, P.holy);
  }

  return p;
}

/* ---------------- 蜘蛛 ---------------- */

function drawSpider(): Pix {
  const p = new Pix(56, 44);
  const cx = 28;
  const cy = 26;
  p.ellipse(cx, 41, 18, 3, 'rgba(0,0,0,0.38)');
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 4; i++) {
      const baseX = cx + s * 3;
      const kneeX = cx + s * (10 + i * 3.6);
      const kneeY = cy - 10 + i * 2.6;
      const footX = cx + s * (15 + i * 4.2);
      const footY = 41 - Math.abs(i - 1.2) * 1.4;
      limb(
        p,
        [
          [baseX, cy],
          [kneeX, kneeY],
          [footX, footY],
        ],
        2,
        '#3c4a33',
        '#5f7248',
        '#1e2618',
      );
    }
  }
  // 腹部
  p.ellipse(cx, cy + 4, 10, 9, '#39462a');
  p.ellipse(cx - 1, cy + 3, 8, 7, '#536b3a');
  p.ellipse(cx - 2, cy + 2, 5, 4, '#6f8a4e');
  // 魂囊
  p.ellipse(cx, cy + 5, 4, 4, P.soulDeep);
  p.ellipse(cx, cy + 5, 2.5, 3, P.soulMid);
  p.px(cx, cy + 5, P.soul);
  p.glow(cx, cy + 5, 8, 'rgba(140,255,120,0.4)', 0.6);
  // 头胸部
  p.ellipse(cx, cy - 7, 7, 6, '#465733');
  p.ellipse(cx - 1, cy - 8, 5, 4, '#647c45');
  // 八眼
  p.rect(cx - 4, cy - 9, 2, 2, P.ink);
  p.rect(cx + 2, cy - 9, 2, 2, P.ink);
  p.px(cx - 4, cy - 9, P.soul);
  p.px(cx + 3, cy - 9, P.soul);
  p.rect(cx - 2, cy - 11, 1, 1, P.soulMid);
  p.rect(cx + 1, cy - 11, 1, 1, P.soulMid);
  // 螯牙
  p.line(cx - 3, cy - 2, cx - 5, cy + 3, 2, '#2a3320');
  p.line(cx + 3, cy - 2, cx + 5, cy + 3, 2, '#2a3320');
  p.px(cx - 5, cy + 3, P.boneMid);
  p.px(cx + 5, cy + 3, P.boneMid);
  return p;
}

/* ---------------- 死亡帧 ---------------- */

function drawDeath(c: HumanoidCfg, i: number): Pix {
  const p = new Pix(c.w, c.h);
  const cx = Math.floor(c.w / 2);
  if (i === 0) {
    p.ellipse(cx, c.ground - 1, 10, 4, 'rgba(0,0,0,0.4)');
    p.ellipse(cx - 1, c.ground - 6, 9, 5, c.skinDark);
    p.ellipse(cx - 4, c.ground - 7, 5, 4, c.cloth);
    p.ellipse(cx + 8, c.ground - 4, 4, 3, c.skin);
    p.rect(cx - 10, c.ground - 3, 4, 2, c.skinDark);
    p.px(cx + 2, c.ground - 9, c.skinLit);
  } else if (i === 1) {
    p.ellipse(cx, c.ground - 2, 12, 3, 'rgba(0,0,0,0.32)');
    p.rect(cx - 9, c.ground - 7, 15, 4, c.clothDark);
    p.rect(cx - 8, c.ground - 7, 13, 1, c.cloth);
    p.ellipse(cx + 8, c.ground - 6, 4, 3, c.skinDark);
    p.ellipse(cx - 11, c.ground - 5, 3, 2, c.skinDark);
    p.px(cx - 4, c.ground - 8, P.boneDark);
    p.px(cx + 1, c.ground - 8, P.boneMid);
    p.px(cx + 4, c.ground - 6, P.bloodDark);
  } else {
    p.ellipse(cx, c.ground - 3, 7, 2, 'rgba(0,0,0,0.25)');
    p.glow(cx, c.ground - 9, 11, 'rgba(125,255,160,0.5)', 0.75);
    p.px(cx, c.ground - 9, P.soul);
    p.px(cx - 2, c.ground - 13, P.soulMid);
    p.px(cx + 3, c.ground - 15, P.soulMid);
    p.px(cx + 1, c.ground - 18, P.soulDeep);
  }
  return p;
}

/* ---------------- 配置 ---------------- */

const BASE_CFG = {
  hunch: 0,
  spikes: false,
  ribs: false,
  cape: false,
};

function cfgZombie(): HumanoidCfg {
  return {
    ...BASE_CFG,
    w: 48,
    h: 60,
    ground: 58,
    hipY: 39,
    shoulderY: 21,
    headY: 12,
    headR: 5.5,
    shoulderW: 9,
    hipW: 6,
    hunch: 0.9,
    skin: '#2f3a25',
    skinLit: '#4f6038',
    skinDark: '#141a0f',
    cloth: '#352f40',
    clothLit: '#4c4459',
    clothDark: '#1c1824',
    eye: P.soul,
    weapon: 'claw',
    ribs: true,
    helmet: 'skull',
  };
}

function cfgRunner(): HumanoidCfg {
  return {
    ...BASE_CFG,
    w: 48,
    h: 60,
    ground: 58,
    hipY: 38,
    shoulderY: 20,
    headY: 11,
    headR: 5,
    shoulderW: 7.4,
    hipW: 5,
    hunch: 1.3,
    skin: '#29331f',
    skinLit: '#475833',
    skinDark: '#0f140c',
    cloth: '#282432',
    clothLit: '#3b3548',
    clothDark: '#13111a',
    eye: '#c6ff7a',
    weapon: 'claw',
    ribs: true,
    helmet: 'skull',
  };
}

function cfgBrute(): HumanoidCfg {
  return {
    ...BASE_CFG,
    w: 68,
    h: 74,
    ground: 72,
    hipY: 47,
    shoulderY: 26,
    headY: 21,
    headR: 6.5,
    shoulderW: 14,
    hipW: 9,
    hunch: 0.6,
    skin: '#2c3622',
    skinLit: '#4b5833',
    skinDark: '#11160c',
    cloth: '#241d19',
    clothLit: '#3c3028',
    clothDark: '#100c0a',
    armor: '#3f3a2e',
    armorLit: '#6d6350',
    armorDark: '#1d1a14',
    eye: '#ffab55',
    weapon: 'club',
    spikes: true,
    helmet: 'skull',
  };
}

function cfgBoss(): HumanoidCfg {
  return {
    ...BASE_CFG,
    w: 104,
    h: 116,
    ground: 113,
    hipY: 76,
    shoulderY: 42,
    headY: 31,
    headR: 7.5,
    shoulderW: 22,
    hipW: 11,
    hunch: 0.55,
    skin: '#28321d',
    skinLit: '#46532e',
    skinDark: '#0d120a',
    cloth: '#211a28',
    clothLit: '#3a2c49',
    clothDark: '#0f0b14',
    armor: '#332e23',
    armorLit: '#5e5540',
    armorDark: '#17140f',
    eye: '#c4ff6a',
    weapon: 'axe',
    spikes: true,
    cape: true,
    helmet: 'horned',
  };
}

function cfgLord(): HumanoidCfg {
  return {
    ...BASE_CFG,
    w: 68,
    h: 92,
    ground: 89,
    hipY: 58,
    shoulderY: 33,
    headY: 22,
    headR: 7,
    shoulderW: 11,
    hipW: 7.5,
    hunch: 0,
    skin: P.bone,
    skinLit: P.boneLit,
    skinDark: P.boneDark,
    cloth: '#2a2236',
    clothLit: '#4a3c60',
    clothDark: '#15101d',
    armor: '#2b261e',
    armorLit: '#6d5836',
    armorDark: '#141009',
    eye: '#d6ff96',
    weapon: 'staff',
    cape: true,
    helmet: 'crown',
  };
}

function cfgHuman(kind: 'infantry' | 'gunner' | 'sniper' | 'paladin'): HumanoidCfg {
  const base: HumanoidCfg = {
    ...BASE_CFG,
    w: 48,
    h: 60,
    ground: 58,
    hipY: 39,
    shoulderY: 21,
    headY: 12,
    headR: 5,
    shoulderW: 8.4,
    hipW: 5.6,
    skin: P.skin,
    skinLit: '#ecc7a1',
    skinDark: P.skinDark,
    cloth: P.blue,
    clothLit: P.blueLit,
    clothDark: P.blueDark,
    armor: '#59666d',
    armorLit: '#a8b6bd',
    armorDark: '#262e33',
    eye: '#1d252a',
    weapon: 'sword',
    helmet: 'steel',
  };
  if (kind === 'gunner')
    return {
      ...base,
      weapon: 'rifle',
      helmet: 'cap',
      cloth: '#39472f',
      clothLit: '#516244',
      clothDark: '#212a1b',
      armor: '#6a7864',
      armorLit: '#93a08b',
      armorDark: '#39433a',
    };
  if (kind === 'sniper')
    return {
      ...base,
      weapon: 'longrifle',
      helmet: 'hood',
      cloth: '#393946',
      clothLit: '#525260',
      clothDark: '#22222a',
      armor: '#5d6670',
      armorLit: '#828c96',
      armorDark: '#333b42',
      shoulderW: 6.2,
    };
  if (kind === 'paladin')
    return {
      ...base,
      w: 52,
      h: 64,
      ground: 62,
      hipY: 42,
      shoulderY: 23,
      headY: 12,
      headR: 6,
      shoulderW: 8.5,
      hipW: 5.8,
      weapon: 'hammer',
      shield: true,
      armor: '#cfd8dc',
      armorLit: '#ffffff',
      armorDark: '#7f8b91',
      cloth: P.white,
      clothLit: '#ffffff',
      clothDark: '#b9ae94',
      helmet: 'white',
      eye: P.gold,
    };
  return base;
}

const CFG: Record<UnitArtType, () => HumanoidCfg> = {
  zombie: cfgZombie,
  runner: cfgRunner,
  brute: cfgBrute,
  boss: cfgBoss,
  lord: cfgLord,
  infantry: () => cfgHuman('infantry'),
  gunner: () => cfgHuman('gunner'),
  sniper: () => cfgHuman('sniper'),
  paladin: () => cfgHuman('paladin'),
  spider: cfgZombie,
};

export const UNIT_FRAMES: Record<PoseKind, number> = {
  idle: 2,
  walk: 4,
  attack: 2,
  hit: 1,
  death: 3,
};

export const UNIT_ART_SIZE: Record<UnitArtType, { w: number; h: number }> = {
  zombie: { w: 48, h: 60 },
  runner: { w: 48, h: 60 },
  brute: { w: 68, h: 74 },
  spider: { w: 56, h: 44 },
  boss: { w: 104, h: 116 },
  lord: { w: 68, h: 92 },
  infantry: { w: 48, h: 60 },
  gunner: { w: 48, h: 60 },
  sniper: { w: 48, h: 60 },
  paladin: { w: 52, h: 64 },
};

export function renderUnitPix(type: UnitArtType, pose: Pose): Pix {
  if (type === 'spider') {
    if (pose.kind === 'death') return drawDeath(CFG.spider(), pose.i);
    return drawSpider();
  }
  const cfg = CFG[type]();
  if (pose.kind === 'death') return drawDeath(cfg, pose.i);
  const p = drawHumanoid(cfg, pose);
  p.outline(P.ink);
  const rng = mulberry32(type.length * 97 + pose.kind.length * 13 + pose.i * 7);
  p.speckle([cfg.skinDark, cfg.skinLit], 0.05, rng);
  // 幽绿轮廓光：亡灵单位在暗色地图上的辨识度
  const undead = type === 'zombie' || type === 'runner' || type === 'brute' || type === 'boss' || type === 'lord';
  if (undead) p.rimLight([80, 190, 120], 0.4);
  else p.rimLight([210, 220, 190], 0.22);
  if (cfg.helmet === 'skull' || cfg.helmet === 'crown' || cfg.helmet === 'horned') {
    const cx = Math.floor(cfg.w / 2) + cfg.hunch * 2.5;
    p.glow(cx, cfg.headY + 1, cfg.headR + 4, 'rgba(125,255,150,0.32)', 0.5);
  }
  return p;
}

export function buildUnitCanvases(): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();
  for (const type of Object.keys(CFG) as UnitArtType[]) {
    for (const kind of Object.keys(UNIT_FRAMES) as PoseKind[]) {
      for (let i = 0; i < UNIT_FRAMES[kind]; i++) {
        out.set(`unit:${type}:${kind}:${i}`, renderUnitPix(type, { kind, i }).canvas);
      }
    }
  }
  return out;
}

/** 单位卡图标：暗底 + 居中放大 + 绿色边光 */
export function unitIconDataUrl(type: UnitArtType): string {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const g = ctx.createRadialGradient(size / 2, size * 0.66, 4, size / 2, size * 0.66, size * 0.62);
  g.addColorStop(0, 'rgba(90,160,115,0.34)');
  g.addColorStop(1, 'rgba(8,12,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // 地面
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(size / 2, size - 12, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const pix = renderUnitPix(type, { kind: 'idle', i: 0 });
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min((size - 16) / pix.w, (size - 12) / pix.h);
  const dw = pix.w * scale;
  const dh = pix.h * scale;
  ctx.drawImage(pix.canvas, (size - dw) / 2, size - 8 - dh, dw, dh);
  return c.toDataURL('image/png');
}
