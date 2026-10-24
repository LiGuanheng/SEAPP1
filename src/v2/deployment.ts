import { isArmy, type Kind } from "./data";
import type { Battle } from "./simulation";
/** One press commits once; holding repeats against the same legal world position.
 * No timers survive the battle: the renderer supplies monotonic UI timestamps. */
export class DeploymentStream {
  private hold: { kind: Kind; x: number; y: number; batches: number; next: number } | null = null;
  constructor(private battle: Battle) {}
  get active() {
    return this.hold !== null;
  }
  begin(kind: Kind, x: number, y: number, batches: number, now: number, repeat = false) {
    this.end();
    const ok = this.battle.deploy(kind, x, y, batches);
    if (ok && repeat && isArmy(kind) && batches !== Infinity && !this.battle.paused)
      this.hold = { kind, x, y, batches, next: now + 600 };
    return ok;
  }
  tick(now: number, enabled = true) {
    if (!enabled || this.battle.paused || this.battle.status !== "battle") {
      this.end();
      return;
    }
    const h = this.hold;
    if (!h || now < h.next) return;
    if (!this.battle.deploy(h.kind, h.x, h.y, h.batches)) {
      this.end();
      return;
    }
    h.next = now + 500;
  }
  end() {
    this.hold = null;
  }
}
