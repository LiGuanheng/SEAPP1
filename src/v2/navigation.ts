import { WORLD } from "./data";
export interface Point {
  x: number;
  y: number;
}
export interface Obstacle extends Point {
  id: number;
  w: number;
  h: number;
  hp: number;
  weak?: boolean;
  kind: string;
}
const CELL = 40,
  W = Math.ceil(WORLD.width / CELL),
  H = Math.ceil(WORLD.height / CELL);
/** Shared weighted Dijkstra fields. Walls remain physical solids; their weighted cells
 * tell attackers which segment to siege. Destruction invalidates all fields. */
export class Navigation {
  readonly cell = CELL;
  readonly width = W;
  readonly height = H;
  readonly costs = new Float32Array(W * H).fill(1);
  readonly solids = new Int32Array(W * H);
  private fields = new Map<string, Float32Array>();
  private obstacles: Obstacle[] = [];
  private buckets = new Map<number, Obstacle[]>();
  rebuild(obstacles: Obstacle[]) {
    this.obstacles = obstacles.filter((o) => o.hp > 0);
    this.costs.fill(1);
    this.solids.fill(0);
    this.fields.clear();
    this.buckets.clear();
    for (const o of this.obstacles) {
      for (
        let y = Math.max(0, Math.floor((o.y - o.h / 2) / CELL));
        y <= Math.min(H - 1, Math.floor((o.y + o.h / 2) / CELL));
        y++
      )
        for (
          let x = Math.max(0, Math.floor((o.x - o.w / 2) / CELL));
          x <= Math.min(W - 1, Math.floor((o.x + o.w / 2) / CELL));
          x++
        ) {
          const i = y * W + x;
          this.solids[i] = o.id;
          const bucket = this.buckets.get(i);
          if (bucket) bucket.push(o);
          else this.buckets.set(i, [o]);
          this.costs[i] = o.kind === "wall" || o.kind === "gate" ? (o.weak ? 5 : 18) : 12;
        }
    }
  }
  index(x: number, y: number) {
    return (
      Math.max(0, Math.min(H - 1, Math.floor(y / CELL))) * W +
      Math.max(0, Math.min(W - 1, Math.floor(x / CELL)))
    );
  }
  obstacleAt(x: number, y: number, climber = false, defender = false): number {
    for (const o of this.buckets.get(this.index(x, y)) ?? []) {
      if ((climber && o.weak) || (defender && o.kind === "gate")) continue;
      if (Math.abs(x - o.x) < o.w / 2 + 4 && Math.abs(y - o.y) < o.h / 2 + 4) return o.id;
    }
    return 0;
  }
  /** Actual segment/rectangle occlusion, not a distance-only combat approximation. */
  clear(a: Point, b: Point, excludeA = 0, excludeB = 0): boolean {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 20));
    const checked = new Set<number>();
    for (let n = 0; n <= steps; n++) {
      const i = this.index(a.x + (dx * n) / steps, a.y + (dy * n) / steps);
      for (const o of this.buckets.get(i) ?? []) {
        if (o.id === excludeA || o.id === excludeB || checked.has(o.id)) continue;
        checked.add(o.id);
        let lo = 0,
          hi = 1;
        for (const [start, d, min, max] of [
          [a.x, dx, o.x - o.w / 2, o.x + o.w / 2],
          [a.y, dy, o.y - o.h / 2, o.y + o.h / 2],
        ]) {
          if (Math.abs(d) < 1e-9) {
            if (start < min || start > max) {
              lo = 2;
              break;
            }
          } else {
            const t1 = (min - start) / d,
              t2 = (max - start) / d;
            lo = Math.max(lo, Math.min(t1, t2));
            hi = Math.min(hi, Math.max(t1, t2));
          }
        }
        if (lo <= hi && hi > 0.001 && lo < 0.999) return false;
      }
    }
    return true;
  }
  field(x: number, y: number, defender = false) {
    const target = this.index(x, y),
      key = `${target}:${defender}`;
    let f = this.fields.get(key);
    if (f) return f;
    f = new Float32Array(W * H).fill(Infinity);
    f[target] = 0;
    const heap: [number, number][] = [];
    const push = (id: number, d: number) => {
      heap.push([id, d]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][1] <= d) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = [id, d];
    };
    const pop = () => {
      const root = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1][1] < heap[c][1]) c++;
          if (last[1] <= heap[c][1]) break;
          heap[i] = heap[c];
          i = c;
        }
        heap[i] = last;
      }
      return root;
    };
    push(target, 0);
    while (heap.length) {
      const [i, d] = pop();
      if (d > f[i] + 0.0001) continue;
      const cx = i % W,
        cy = Math.floor(i / W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx,
          cost = defender
            ? this.buckets.get(ni)?.some((o) => o.kind !== "gate")
              ? 1000
              : 1
            : this.costs[ni],
          nd = d + cost * (dx && dy ? 1.414 : 1);
        if (nd < f[ni] - 0.0001) {
          f[ni] = nd;
          push(ni, nd);
        }
      }
    }
    this.fields.set(key, f);
    if (this.fields.size > 48) this.fields.delete(this.fields.keys().next().value!);
    return f;
  }
  direction(x: number, y: number, tx: number, ty: number, defender = false): Point {
    const f = this.field(tx, ty, defender),
      i = this.index(x, y),
      cx = i % W,
      cy = Math.floor(i / W);
    let best = f[i],
      bx = tx,
      by = ty;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (f[ni] < best) {
        best = f[ni];
        bx = (nx + 0.5) * CELL;
        by = (ny + 0.5) * CELL;
      }
    }
    const len = Math.hypot(bx - x, by - y) || 1;
    return { x: (bx - x) / len, y: (by - y) / len };
  }
  connected(a: Point, b: Point): boolean {
    const start = this.index(a.x, a.y),
      end = this.index(b.x, b.y),
      seen = new Uint8Array(W * H),
      q = [start];
    seen[start] = 1;
    for (let n = 0; n < q.length; n++) {
      const i = q[n];
      if (i === end) return true;
      const x = i % W,
        y = Math.floor(i / W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx,
          yy = y + dy,
          j = yy * W + xx;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || seen[j] || this.solids[j]) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    return false;
  }
}
