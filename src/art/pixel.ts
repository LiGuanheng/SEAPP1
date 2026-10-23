/** 极简逐像素绘制工具：所有战场素材都由此生成，保证风格统一且完全原创。 */
export type Pt = [number, number];

export class Pix {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  px(x: number, y: number, c: string): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(ix, iy, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** 三色块：上/左高光，下/右暗部。用于快速塑造体积。 */
  block(x: number, y: number, w: number, h: number, base: string, lit: string, dark: string): void {
    this.rect(x, y, w, h, base);
    this.rect(x, y, w, 1, lit);
    this.rect(x, y, 1, h, lit);
    this.rect(x, y + h - 1, w, 1, dark);
    this.rect(x + w - 1, y, 1, h, dark);
  }

  line(x0: number, y0: number, x1: number, y1: number, t: number, c: string): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (dx * i) / steps;
      const y = y0 + (dy * i) / steps;
      this.rect(x - (t - 1) / 2, y - (t - 1) / 2, t, t, c);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) * rx;
      this.rect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }

  /** 椭圆的高光/暗部描边 */
  ellipseShaded(cx: number, cy: number, rx: number, ry: number, base: string, lit: string, dark: string): void {
    this.ellipse(cx, cy, rx, ry, base);
    for (let a = -Math.PI; a < 0; a += 0.18) {
      this.px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, lit);
    }
    for (let a = 0; a < Math.PI; a += 0.18) {
      this.px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, dark);
    }
  }

  poly(pts: Pt[], c: string): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.rect(xs[i], y, xs[i + 1] - xs[i] + 1, 1, c);
      }
    }
  }

  /** 给所有不透明像素加 1px 外轮廓（像素风的关键） */
  outline(c: string): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const src = img.data;
    const mask = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.w * this.h; i++) mask[i] = src[i * 4 + 3] > 40 ? 1 : 0;
    const ctx = this.ctx;
    ctx.fillStyle = c;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (mask[i]) continue;
        const near =
          (x > 0 && mask[i - 1]) ||
          (x < this.w - 1 && mask[i + 1]) ||
          (y > 0 && mask[i - this.w]) ||
          (y < this.h - 1 && mask[i + this.w]);
        if (near) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  /** 给左侧/上侧轮廓加冷光边，让暗色角色在暗色地图上更立体 */
  rimLight(rgb: [number, number, number], alpha = 0.42): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const opaque = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.w * this.h; i++) opaque[i] = d[i * 4 + 3] > 60 ? 1 : 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (!opaque[i]) continue;
        const leftEmpty = x === 0 || !opaque[i - 1];
        const topEmpty = y === 0 || !opaque[i - this.w];
        if (!leftEmpty && !topEmpty) continue;
        const o = i * 4;
        d[o] = Math.round(d[o] * (1 - alpha) + rgb[0] * alpha);
        d[o + 1] = Math.round(d[o + 1] * (1 - alpha) + rgb[1] * alpha);
        d[o + 2] = Math.round(d[o + 2] * (1 - alpha) + rgb[2] * alpha);
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /** 在已有像素上撒噪点，制造材质颗粒 */
  speckle(colors: string[], chance: number, rng: () => number): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (d[i + 3] < 40) continue;
        if (rng() < chance) {
          const c = colors[Math.floor(rng() * colors.length)];
          const rgb = hexToRgb(c);
          d[i] = rgb[0];
          d[i + 1] = rgb[1];
          d[i + 2] = rgb[2];
        }
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /** 叠加柔光（用于眼睛、火焰） */
  glow(cx: number, cy: number, r: number, color: string, alpha = 0.85): void {
    const g = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = g;
    this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    this.ctx.restore();
  }

  cloneCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')?.drawImage(this.canvas, 0, 0);
    return c;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bb = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bb})`;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 稳定哈希，用于地图瓦片变体的确定性选择 */
export function hash2(x: number, y: number, seed = 1337): number {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
