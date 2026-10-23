import { UNIT_FRAMES, buildUnitCanvases, type PoseKind, type UnitArtType } from '../art/units';
import { el } from './dom';

/** 开发用素材预览：?art 打开。用于检查像素风一致性与动画帧。 */
export function showArtPreview(root: HTMLElement): void {
  const canvases = buildUnitCanvases();
  const wrap = el('div', {
    class: 'screen',
    style: { overflow: 'auto', padding: '24px', background: '#0b0f0e', display: 'block' },
  });
  wrap.append(
    el('h2', {
      text: '素材预览 · ART PREVIEW',
      style: { fontFamily: 'var(--font-display)', color: '#d8b978', letterSpacing: '0.2em', margin: '0 0 18px' },
    }),
  );

  const types: UnitArtType[] = ['zombie', 'runner', 'brute', 'spider', 'boss', 'lord', 'infantry', 'gunner', 'sniper', 'paladin'];
  for (const t of types) {
    const row = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap' } });
    row.append(el('div', { text: t, style: { width: '76px', color: '#93a09a', fontSize: '12px' } }));
    for (const kind of Object.keys(UNIT_FRAMES) as PoseKind[]) {
      for (let i = 0; i < UNIT_FRAMES[kind]; i++) {
        const src = canvases.get(`unit:${t}:${kind}:${i}`);
        if (!src) continue;
        const c = document.createElement('canvas');
        const scale = 2;
        c.width = src.width * scale;
        c.height = src.height * scale;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(src, 0, 0, c.width, c.height);
        }
        c.style.background = 'repeating-conic-gradient(#141a18 0% 25%, #0f1413 0% 50%) 50% / 12px 12px';
        c.title = `${kind}:${i}`;
        row.append(c);
      }
      row.append(el('div', { style: { width: '6px' } }));
    }
    wrap.append(row);
  }
  root.append(wrap);
}
