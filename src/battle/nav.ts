import { MAP_H, MAP_W } from '../config/mapData';

export interface FlowField {
  /** 每格到目标的累计代价 */
  dist: Float32Array;
  /** 指向目标的单位向量 */
  dx: Int8Array;
  dy: Int8Array;
  targetX: number;
  targetY: number;
}

class MinHeap {
  private idx: Int32Array;
  private pri: Float32Array;
  private size = 0;

  constructor(cap: number) {
    this.idx = new Int32Array(cap);
    this.pri = new Float32Array(cap);
  }

  clear(): void {
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }

  push(i: number, p: number): void {
    if (this.size >= this.idx.length) return;
    let k = this.size++;
    this.idx[k] = i;
    this.pri[k] = p;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= this.pri[k]) break;
      this.swap(parent, k);
      k = parent;
    }
  }

  pop(): number {
    if (this.size === 0) return -1;
    const top = this.idx[0];
    this.size--;
    if (this.size > 0) {
      this.idx[0] = this.idx[this.size];
      this.pri[0] = this.pri[this.size];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < this.size && this.pri[l] < this.pri[m]) m = l;
        if (r < this.size && this.pri[r] < this.pri[m]) m = r;
        if (m === k) break;
        this.swap(m, k);
        k = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const ti = this.idx[a];
    this.idx[a] = this.idx[b];
    this.idx[b] = ti;
    const tp = this.pri[a];
    this.pri[a] = this.pri[b];
    this.pri[b] = tp;
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class NavGrid {
  readonly w = MAP_W;
  readonly h = MAP_H;
  readonly cost: Float32Array;
  readonly blocked: Uint8Array;
  private heap = new MinHeap(MAP_W * MAP_H);

  constructor() {
    this.cost = new Float32Array(MAP_W * MAP_H).fill(1);
    this.blocked = new Uint8Array(MAP_W * MAP_H);
  }

  index(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  setCost(x: number, y: number, c: number): void {
    if (!this.inBounds(x, y)) return;
    this.cost[this.index(x, y)] = c;
    this.blocked[this.index(x, y)] = c >= 999 ? 1 : 0;
  }

  setRect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setCost(xx, yy, c);
  }

  /** 墙体/建筑（代价 >= 20）对移动而言是实体阻挡 */
  blockedAtWorld(wx: number, wy: number): boolean {
    const tx = Math.floor(wx / 32);
    const ty = Math.floor(wy / 32);
    if (!this.inBounds(tx, ty)) return true;
    return this.cost[this.index(tx, ty)] > 20;
  }

  /** 从目标点反向 Dijkstra，生成流场 */
  buildFlow(targetX: number, targetY: number): FlowField {
    const n = this.w * this.h;
    const dist = new Float32Array(n).fill(Infinity);
    const dx = new Int8Array(n);
    const dy = new Int8Array(n);
    if (!this.inBounds(targetX, targetY)) {
      return { dist, dx, dy, targetX, targetY };
    }
    const heap = this.heap;
    heap.clear();
    const start = this.index(targetX, targetY);
    dist[start] = 0;
    heap.push(start, 0);

    while (heap.length > 0) {
      const cur = heap.pop();
      const cx = cur % this.w;
      const cy = (cur - cx) / this.w;
      const cd = dist[cur];
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const ni = ny * this.w + nx;
        const terrain = this.cost[ni];
        if (terrain >= 999) continue;
        const diag = d >= 4 ? 1.414 : 1;
        const nd = cd + (terrain * diag + (DX[d] !== 0 && DY[d] !== 0 ? 0.15 : 0));
        if (nd < dist[ni] - 1e-4) {
          dist[ni] = nd;
          heap.push(ni, nd);
        }
      }
    }

    // 生成每格朝向：选择 dist 最小的邻居
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (!isFinite(dist[i])) continue;
        let best = dist[i];
        let bx = 0;
        let by = 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const nd = dist[ny * this.w + nx];
          if (nd < best) {
            best = nd;
            bx = DX[d];
            by = DY[d];
          }
        }
        dx[i] = bx;
        dy[i] = by;
      }
    }

    return { dist, dx, dy, targetX, targetY };
  }
}
