import { P } from './palette';
import { Pix } from './pixel';

function radial(size: number, inner: string, outer = 'rgba(0,0,0,0)', power = 1): Pix {
  const p = new Pix(size, size);
  const c = size / 2;
  const g = p.ctx.createRadialGradient(c, c, 0, c, c, c);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = Math.pow(1 - t, power);
    g.addColorStop(t, i === 0 ? inner : withAlpha(inner, a));
  }
  g.addColorStop(1, outer);
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, size, size);
  return p;
}

function withAlpha(color: string, a: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb')) return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  const h = color.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function buildFxCanvases(): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();

  out.set('fx:glow', radial(96, '#ffffff').canvas);
  out.set('fx:glow-soul', radial(96, P.soul).canvas);
  out.set('fx:glow-gold', radial(96, '#ffe9a8').canvas);
  out.set('fx:glow-blue', radial(96, '#9fe4ff').canvas);

  // 魂火粒子
  {
    const p = new Pix(8, 8);
    p.ellipse(4, 4, 3, 3, withAlpha(P.soulMid, 0.5));
    p.ellipse(4, 4, 2, 2, P.soulMid);
    p.ellipse(4, 4, 1, 1, '#f0ffe0');
    out.set('fx:soul', p.canvas);
  }

  // 火花 / 血
  {
    const p = new Pix(4, 4);
    p.rect(0, 0, 4, 4, '#ffffff');
    out.set('fx:spark', p.canvas);
  }
  {
    const p = new Pix(10, 10);
    p.ellipse(5, 5, 3, 2, P.blood);
    p.ellipse(3, 6, 2, 1, P.bloodDark);
    p.ellipse(7, 3, 1, 1, P.blood);
    p.px(8, 7, P.bloodDark);
    out.set('fx:blood', p.canvas);
  }

  // 炮弹
  {
    const p = new Pix(8, 6);
    p.ellipse(4, 3, 3, 2, '#2a2a26');
    p.ellipse(4, 3, 2, 1, '#6b6b5e');
    p.px(6, 2, '#ffb054');
    out.set('fx:shell', p.canvas);
  }

  // 枪口火焰
  {
    const p = new Pix(16, 12);
    p.poly(
      [
        [0, 6],
        [10, 2],
        [16, 6],
        [10, 10],
      ],
      '#ffd27a',
    );
    p.poly(
      [
        [2, 6],
        [9, 4],
        [12, 6],
        [9, 8],
      ],
      '#fff6d8',
    );
    p.glow(6, 6, 8, 'rgba(255,200,120,0.6)', 0.8);
    out.set('fx:muzzle', p.canvas);
  }

  // 爆炸圆环
  for (let f = 0; f < 3; f++) {
    const size = 56;
    const p = new Pix(size, size);
    const c = size / 2;
    const r = 8 + f * 8;
    for (let a = 0; a < Math.PI * 2; a += 0.06) {
      p.px(c + Math.cos(a) * r, c + Math.sin(a) * r, f === 0 ? '#fff3c4' : f === 1 ? '#ffb054' : 'rgba(180,90,40,0.6)');
      if (f > 0) p.px(c + Math.cos(a) * (r - 2), c + Math.sin(a) * (r - 2), 'rgba(120,60,30,0.45)');
    }
    p.glow(c, c, r + 4, f === 0 ? 'rgba(255,240,180,0.55)' : 'rgba(255,140,60,0.4)', 0.8);
    out.set(`fx:blast:${f}`, p.canvas);
  }

  // 尘土
  for (let f = 0; f < 3; f++) {
    const p = new Pix(24, 16);
    const r = 6 + f * 3;
    p.ellipse(12, 10, r, r * 0.6, 'rgba(120,115,96,0.35)');
    p.ellipse(10, 9, r * 0.7, r * 0.45, 'rgba(160,155,132,0.4)');
    p.ellipse(14, 11, r * 0.5, r * 0.3, 'rgba(90,86,72,0.35)');
    out.set(`fx:dust:${f}`, p.canvas);
  }

  // 冲击波（冲击环）
  {
    const size = 128;
    const p = new Pix(size, size);
    const c = size / 2;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      p.px(c + Math.cos(a) * 54, c + Math.sin(a) * 54, 'rgba(180,255,200,0.5)');
    }
    out.set('fx:shock', p.canvas);
  }

  // 灯塔光束（右向）
  {
    const p = new Pix(300, 80);
    const g = p.ctx.createLinearGradient(0, 0, 300, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.55)');
    g.addColorStop(0.45, 'rgba(255,235,170,0.16)');
    g.addColorStop(1, 'rgba(255,230,160,0)');
    p.ctx.fillStyle = g;
    p.ctx.beginPath();
    p.ctx.moveTo(0, 34);
    p.ctx.lineTo(300, 0);
    p.ctx.lineTo(300, 80);
    p.ctx.lineTo(0, 46);
    p.ctx.closePath();
    p.ctx.fill();
    out.set('fx:beam', p.canvas);
  }

  // 选中环
  {
    const size = 64;
    const p = new Pix(size, size);
    const c = size / 2;
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      p.px(c + Math.cos(a) * 22, c + Math.sin(a) * 11, P.soul);
    }
    out.set('fx:select', p.canvas);
  }

  // 治疗 / 圣光
  {
    const size = 64;
    const p = new Pix(size, size);
    const c = size / 2;
    p.glow(c, c, 30, 'rgba(255,240,180,0.5)', 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.px(c + Math.cos(a) * 26, c + Math.sin(a) * 26, P.holy);
    }
    out.set('fx:holy', p.canvas);
  }

  // 破墙碎块
  {
    const p = new Pix(8, 8);
    p.rect(1, 1, 5, 5, '#5a5c50');
    p.rect(1, 1, 5, 1, '#82856f');
    p.rect(1, 5, 5, 1, '#2e302a');
    out.set('fx:debris', p.canvas);
  }

  return out;
}
