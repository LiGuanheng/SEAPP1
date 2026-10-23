/** 极简 DOM 构建器，避免为 UI 引入前端框架。 */
export type Props = {
  class?: string;
  id?: string;
  text?: string;
  html?: string;
  title?: string;
  attrs?: Record<string, string>;
  style?: Record<string, string | number>;
  on?: Record<string, (ev: Event) => void>;
  children?: (Node | string | null | undefined)[];
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.id) node.id = props.id;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.title) node.title = props.title;
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  }
  if (props.style) {
    for (const [k, v] of Object.entries(props.style)) {
      const value = typeof v === 'number' ? `${v}px` : v;
      if (k.startsWith('--')) node.style.setProperty(k, value);
      else (node.style as unknown as Record<string, string>)[k] = value;
    }
  }
  if (props.on) {
    for (const [k, fn] of Object.entries(props.on)) node.addEventListener(k, fn);
  }
  const all = [...(props.children ?? []), ...children];
  for (const child of all) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

/** 数字滚动动画，用于资源变化反馈。 */
export function countTo(node: HTMLElement, from: number, to: number, ms = 420): void {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
