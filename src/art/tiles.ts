import { P } from './palette';
import { Pix, hash2, mulberry32 } from './pixel';

export const TILE = 32;
export const TILESET_COLS = 4;
export const TILESET_ROWS = 8;

/** 瓦片索引约定（与 mapData 的 TERRAIN 对应） */
export const T = {
  SOIL: 0,
  ROAD: 4,
  COBBLE: 8,
  RUBBLE: 12,
  GRASS: 16,
  PLAZA: 20,
  MUD: 24,
  CITY: 28,
} as const;

function soil(p: Pix, rng: () => number, base: string, spec: string[], density = 0.18): void {
  p.rect(0, 0, TILE, TILE, base);
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    p.px(x, y, spec[Math.floor(rng() * spec.length)]);
  }
  if (density > 0) {
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rng() * (TILE - 2));
      const y = Math.floor(rng() * (TILE - 2));
      p.rect(x, y, 2, 1, spec[0]);
      p.px(x + 1, y + 1, '#151610');
    }
  }
}

function road(p: Pix, rng: () => number): void {
  p.rect(0, 0, TILE, TILE, '#4a4437');
  for (let i = 0; i < 150; i++) {
    p.px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), rng() < 0.5 ? '#3a3429' : '#5b5343');
  }
  // 车辙
  const off = Math.floor(rng() * 6);
  for (let x = 0; x < TILE; x++) {
    p.px(x, 8 + off, '#312b22');
    p.px(x, 9 + off, '#655b49');
    p.px(x, 22 + off * 0.4, '#312b22');
  }
  for (let i = 0; i < 4; i++) {
    p.rect(Math.floor(rng() * TILE), Math.floor(rng() * TILE), 2, 1, '#75694f');
  }
}

function cobble(p: Pix, rng: () => number): void {
  p.rect(0, 0, TILE, TILE, '#34362b');
  const rows = 4;
  for (let ry = 0; ry < rows; ry++) {
    const offset = ry % 2 === 0 ? 0 : -4;
    for (let rx = 0; rx < 5; rx++) {
      const x = rx * 8 + offset;
      const y = ry * 8;
      const shade = rng();
      const base = shade < 0.33 ? '#4e5144' : shade < 0.66 ? '#5a5e4e' : '#43463a';
      p.rect(x + 1, y + 1, 6, 6, base);
      p.rect(x + 1, y + 1, 6, 1, '#717560');
      p.rect(x + 1, y + 1, 1, 6, '#666a58');
      p.rect(x + 1, y + 6, 6, 1, '#282a21');
      p.rect(x + 6, y + 1, 1, 6, '#2d2f26');
    }
  }
}

function rubble(p: Pix, rng: () => number): void {
  soil(p, rng, '#3a3c30', ['#4c4e3d', '#292b22', '#5e5f4b'], 0.1);
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rng() * (TILE - 5));
    const y = Math.floor(rng() * (TILE - 5));
    const w = 2 + Math.floor(rng() * 4);
    const h = 2 + Math.floor(rng() * 3);
    p.rect(x, y, w, h, '#40423a');
    p.rect(x, y, w, 1, '#585b4e');
    p.rect(x, y + h - 1, w, 1, '#1c1d18');
  }
  for (let i = 0; i < 3; i++) {
    p.px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), '#6b6552');
  }
}

function grass(p: Pix, rng: () => number): void {
  p.rect(0, 0, TILE, TILE, '#313823');
  for (let i = 0; i < 110; i++) {
    p.px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), rng() < 0.5 ? '#3f4729' : '#252a1b');
  }
  for (let i = 0; i < 6; i++) {
    const x = 2 + Math.floor(rng() * (TILE - 4));
    const y = 4 + Math.floor(rng() * (TILE - 8));
    const h = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < h; k++) p.px(x + (k % 2), y - k, '#536232');
  }
}

function plaza(p: Pix, rng: () => number): void {
  p.rect(0, 0, TILE, TILE, '#41443a');
  p.rect(0, 0, TILE, 1, '#535748');
  p.rect(0, 0, 1, TILE, '#535748');
  p.rect(0, 15, TILE, 1, '#2f3229');
  p.rect(15, 0, 1, TILE, '#2f3229');
  for (let i = 0; i < 70; i++) {
    p.px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), rng() < 0.5 ? '#4e5245' : '#363930');
  }
  if (rng() < 0.3) {
    const x = Math.floor(rng() * 20) + 4;
    p.line(x, 4, x + 3, 10, 1, '#2b2e25');
  }
}

function mud(p: Pix, rng: () => number): void {
  soil(p, rng, '#33291f', ['#4a372a', '#211811', '#5c4030'], 0.2);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * (TILE - 6));
    const y = Math.floor(rng() * (TILE - 4));
    p.rect(x, y, 3 + Math.floor(rng() * 4), 1, '#5a2a22');
    p.px(x + 1, y + 1, '#3d1a14');
  }
}

function cityFloor(p: Pix, rng: () => number): void {
  p.rect(0, 0, TILE, TILE, '#3a4145');
  for (let i = 0; i < 3; i++) {
    const y = i * 11;
    p.rect(0, y, TILE, 1, '#272d31');
    p.rect(0, y + 1, TILE, 1, '#3a4145');
  }
  const off = Math.floor(rng() * 8);
  p.rect(off, 0, 1, TILE, '#272d31');
  p.rect(off + 1, 0, 1, TILE, '#3a4145');
  for (let i = 0; i < 60; i++) {
    p.px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), rng() < 0.5 ? '#444c50' : '#31383c');
  }
}

/** 生成 4×8 的瓦片图集（128×256），每种地形 4 个变体 */
export function buildTileset(): HTMLCanvasElement {
  const p = new Pix(TILE * TILESET_COLS, TILE * TILESET_ROWS);
  const makers: Array<(pp: Pix, rng: () => number) => void> = [
    (pp, r) => soil(pp, r, '#3c3e31', ['#4f5140', '#2a2c22', '#5c5d49']),
    road,
    cobble,
    rubble,
    grass,
    plaza,
    mud,
    cityFloor,
  ];
  makers.forEach((make, row) => {
    for (let v = 0; v < 4; v++) {
      const sp = new Pix(TILE, TILE);
      const rng = mulberry32(1000 + row * 37 + v * 91);
      make(sp, rng);
      p.ctx.drawImage(sp.canvas, v * TILE, row * TILE);
    }
  });
  return p.canvas;
}

/** 地图瓦片选择：地形类型 + 稳定哈希变体 */
export function tileIndex(terrain: number, x: number, y: number): number {
  const v = Math.floor(hash2(x, y, terrain + 7) * 4);
  return terrain + Math.min(3, v);
}

/* ---------------- 装饰物 ---------------- */

export function buildDecorCanvases(): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();

  // 枯树
  for (let v = 0; v < 3; v++) {
    const p = new Pix(48, 64);
    const rng = mulberry32(300 + v * 17);
    p.ellipse(24, 61, 10, 3, 'rgba(0,0,0,0.4)');
    const trunkH = 30 + v * 6;
    p.rect(21, 62 - trunkH, 5, trunkH, '#2a2118');
    p.rect(21, 62 - trunkH, 2, trunkH, '#3d3024');
    for (let b = 0; b < 5; b++) {
      const y = 62 - trunkH + 4 + b * (trunkH / 6);
      const dir = b % 2 === 0 ? -1 : 1;
      const len = 8 + rng() * 10;
      p.line(23, y, 23 + dir * len, y - 6 - rng() * 6, 2, '#2a2118');
      p.line(23, y - 1, 23 + dir * len, y - 7 - rng() * 6, 1, '#3b2f22');
    }
    p.outline('#0b0d0a');
    out.set(`decor:tree:${v}`, p.canvas);
  }

  // 岩石
  for (let v = 0; v < 3; v++) {
    const p = new Pix(36, 28);
    const rng = mulberry32(700 + v * 23);
    p.ellipse(18, 25, 11, 3, 'rgba(0,0,0,0.35)');
    p.ellipse(18, 16, 10, 8, '#3d4038');
    p.ellipse(16, 14, 7, 5, '#4f5348');
    p.ellipse(15, 12, 4, 3, '#5f6456');
    for (let i = 0; i < 12; i++) p.px(8 + rng() * 20, 8 + rng() * 14, '#2b2e27');
    p.outline('#0b0d0a');
    out.set(`decor:rock:${v}`, p.canvas);
  }

  // 骨堆
  {
    const p = new Pix(32, 20);
    p.ellipse(16, 17, 10, 3, 'rgba(0,0,0,0.3)');
    p.ellipse(12, 13, 4, 3, P.boneMid);
    p.ellipse(20, 14, 3, 2.5, P.boneDark);
    p.line(6, 16, 18, 11, 2, P.boneMid);
    p.line(14, 15, 26, 13, 2, P.boneDark);
    p.px(11, 12, P.ink);
    p.px(13, 12, P.ink);
    p.outline('#0b0d0a');
    out.set('decor:bones:0', p.canvas);
  }

  // 木桶 / 板条箱
  {
    const p = new Pix(20, 24);
    p.ellipse(10, 22, 7, 2, 'rgba(0,0,0,0.35)');
    p.rect(3, 8, 14, 13, '#4a3826');
    p.rect(3, 8, 14, 1, '#6b5136');
    p.rect(3, 11, 14, 1, '#2e2318');
    p.rect(3, 17, 14, 1, '#2e2318');
    p.rect(3, 8, 1, 13, '#5e472e');
    p.rect(16, 8, 1, 13, '#2a2016');
    p.ellipse(10, 8, 7, 2, '#5a452c');
    p.ellipse(10, 8, 5, 1, '#6f5636');
    p.outline('#0b0d0a');
    out.set('decor:barrel:0', p.canvas);
  }

  // 战旗
  {
    const p = new Pix(26, 52);
    p.rect(12, 10, 2, 40, '#2a2118');
    p.poly(
      [
        [14, 11],
        [25, 15],
        [20, 20],
        [25, 25],
        [14, 28],
      ],
      '#5a2a24',
    );
    p.poly(
      [
        [14, 12],
        [22, 15],
        [18, 19],
        [22, 23],
        [14, 26],
      ],
      '#7e3a2f',
    );
    p.rect(11, 49, 4, 3, '#3a3026');
    p.outline('#0b0d0a');
    out.set('decor:banner:0', p.canvas);
  }

  // 火盆（人类）
  {
    const p = new Pix(24, 34);
    p.ellipse(12, 32, 6, 2, 'rgba(0,0,0,0.35)');
    p.rect(10, 18, 4, 14, '#3a3a34');
    p.rect(6, 14, 12, 5, '#4a4a40');
    p.rect(6, 14, 12, 1, '#6a6a5c');
    p.ellipse(12, 12, 6, 4, '#ff9a3c');
    p.ellipse(12, 11, 4, 3, '#ffd07a');
    p.ellipse(12, 10, 2, 2, '#fff3c4');
    p.outline('#0b0d0a');
    out.set('decor:brazier:0', p.canvas);
  }

  // 魂火柱（亡灵）
  {
    const p = new Pix(24, 40);
    p.ellipse(12, 38, 7, 2, 'rgba(0,0,0,0.4)');
    p.poly(
      [
        [8, 36],
        [10, 22],
        [12, 18],
        [14, 22],
        [16, 36],
      ],
      '#2b3327',
    );
    p.poly(
      [
        [9, 34],
        [11, 22],
        [12, 20],
        [13, 22],
        [15, 34],
      ],
      '#3d4834',
    );
    p.ellipse(12, 12, 5, 7, P.soulDeep);
    p.ellipse(12, 11, 3, 5, P.soulMid);
    p.ellipse(12, 10, 1.5, 3, P.soul);
    p.glow(12, 10, 12, 'rgba(125,255,160,0.5)', 0.8);
    p.outline('#0b0d0a');
    out.set('decor:soulfire:0', p.canvas);
  }

  // —— 地面小装饰，提高地表密度 ——
  {
    const p = new Pix(10, 8);
    p.ellipse(5, 6, 4, 2, '#6a6a58');
    p.ellipse(4, 5, 3, 1.5, '#82826c');
    p.px(3, 4, '#9a9a80');
    p.outline('#22241c');
    out.set('decor:pebble:0', p.canvas);
  }
  {
    const p = new Pix(16, 10);
    p.line(2, 3, 6, 6, 1, '#23251d');
    p.line(6, 6, 9, 3, 1, '#23251d');
    p.line(9, 3, 14, 7, 1, '#23251d');
    p.line(4, 4, 7, 7, 1, '#3a3d31');
    out.set('decor:crack:0', p.canvas);
  }
  {
    const p = new Pix(12, 10);
    for (let i = 0; i < 5; i++) {
      const x = 2 + i * 2;
      p.line(x, 9, x + (i % 2 === 0 ? 1 : -1), 5 - (i % 3), 1, '#4a5a2e');
    }
    p.outline('#1c2016');
    out.set('decor:tuft:0', p.canvas);
  }
  {
    const p = new Pix(12, 8);
    p.ellipse(6, 6, 5, 1.5, 'rgba(90,26,20,0.55)');
    p.ellipse(9, 4, 2, 1.2, 'rgba(120,36,26,0.5)');
    p.ellipse(3, 3, 1.5, 1, 'rgba(120,36,26,0.4)');
    out.set('decor:blood:0', p.canvas);
  }

  return out;
}
