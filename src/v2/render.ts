import { COMMANDERS, isCommander, type Kind } from "./data";
import type { Battle, Event, Unit } from "./simulation";
import type { Structure } from "./world";
export const artUrl = (s: string) => `${import.meta.env.BASE_URL}art/${s}.webp`;
const images = new Map<string, HTMLImageElement>();
const atlasFrames = new Map<string, HTMLCanvasElement>();
export async function loadArt() {
  await Promise.all(
    [
      "cover",
      "portraits",
      "units",
      "units-move",
      "structures",
      "hero-dragon",
      "hero-titan",
      "hero-moon",
      "hero-web",
      "hero-forest",
      "hero-emperor",
      "grove",
      "city",
      "materials",
    ].map(
      (k) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = artUrl(k);
          images.set(k, img);
        }),
    ),
  );
}
const polygon = (c: CanvasRenderingContext2D, pts: number[][], fill: string, stroke?: string) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
};
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly mini: HTMLCanvasElement;
  private ground: HTMLCanvasElement;
  private wallPattern: CanvasPattern | string | null = null;
  private raf = 0;
  private last = 0;
  private fx: (Event & { age: number; life: number })[] = [];
  private resizeObserver: ResizeObserver;
  camera = { x: 1600, y: 1390, zoom: 0.4 };
  width = 0;
  height = 0;
  fps = 60;
  frames = 0;
  private frameTime = 0;
  private miniClock = 0;
  private shake = 0;
  pointer = { x: 1600, y: 2070 };
  mode: { type: "none" } | { type: "deploy"; kind: Kind | "all" } | { type: "skill"; kind: Kind } =
    { type: "none" };
  selection: { x: number; y: number; tx: number; ty: number } | null = null;
  onFrame: () => void = () => {};
  onEvent: (e: Event) => void = () => {};
  constructor(
    readonly battle: Battle,
    container: HTMLElement,
    mini: HTMLCanvasElement,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "battle-canvas";
    this.canvas.setAttribute("aria-label", "圣曜城实时攻城战场");
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.mini = mini;
    this.ground = this.makeGround();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.overview(false);
  }
  resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }
  overview(full = true) {
    this.camera.x = 1600;
    this.camera.y = full ? 1190 : 1460;
    this.camera.zoom = full
      ? Math.min(this.width / 3000, this.height / 2100)
      : Math.max(this.width / 3200, this.height / 1800);
  }
  screenToWorld(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: this.camera.x + (x - r.left - this.width / 2) / this.camera.zoom,
      y: this.camera.y + (y - r.top - this.height / 2) / this.camera.zoom,
    };
  }
  worldToScreen(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: r.left + (x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: r.top + (y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }
  zoomAt(delta: number, x: number, y: number) {
    const before = this.screenToWorld(x, y);
    this.camera.zoom = Math.max(0.22, Math.min(1.45, this.camera.zoom * (delta > 0 ? 0.88 : 1.12)));
    const after = this.screenToWorld(x, y);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
  }
  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.battle.advance(delta);
      this.frames++;
      this.frameTime += delta;
      if (this.frameTime >= 0.7) {
        this.fps = this.frames / this.frameTime;
        this.frames = 0;
        this.frameTime = 0;
      }
      for (const e of this.battle.events.splice(0)) {
        this.fx.push({
          ...e,
          age: 0,
          life:
            e.type === "skill"
              ? 2
              : e.type === "death"
                ? 1.5
                : e.type === "shot"
                  ? 0.95
                  : e.type === "wall"
                    ? 2.5
                    : e.type === "victory" || e.type === "defeat"
                      ? 9
                      : 1.5,
        });
        if (e.type === "wall" || (e.kind === "titan" && e.type === "skill")) this.shake = 9;
        this.onEvent(e);
      }
      this.fx = this.fx
        .filter((e) => {
          e.age += delta * (this.battle.paused ? 0 : 1);
          return e.age < e.life;
        })
        .slice(-350);
      this.shake *= 0.86;
      this.render(now / 1000);
      this.miniClock += delta;
      if (this.miniClock > 0.15) {
        this.drawMini();
        this.onFrame();
        this.miniClock = 0;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.remove();
    this.ground.width = 1;
    this.ground.height = 1;
    this.fx.length = 0;
  }
  private drawAtlas(
    c: CanvasRenderingContext2D,
    name: string,
    index: number,
    cols: number,
    rows: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const img = images.get(name);
    if (!img?.complete || !img.naturalWidth) return;
    const key = `${name}:${index}`;
    let frame = atlasFrames.get(key);
    if (!frame) {
      const sw = img.naturalWidth / cols,
        sh = img.naturalHeight / rows;
      frame = document.createElement("canvas");
      const size = name.startsWith("units") ? 112 : name.startsWith("hero-") ? 256 : 512;
      frame.width = size;
      frame.height = Math.round((size * sh) / sw);
      frame
        .getContext("2d")!
        .drawImage(
          img,
          (index % cols) * sw,
          Math.floor(index / cols) * sh,
          sw,
          sh,
          0,
          0,
          frame.width,
          frame.height,
        );
      atlasFrames.set(key, frame);
    }
    c.drawImage(frame, x - w / 2, y - h, w, h);
  }
  private material(
    c: CanvasRenderingContext2D,
    index: number,
    size: number,
  ): CanvasPattern | string {
    const img = images.get("materials");
    if (!img?.naturalWidth) return "#738176";
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const tc = tile.getContext("2d")!;
    tc.drawImage(
      img,
      ((index % 2) * img.naturalWidth) / 2,
      (Math.floor(index / 2) * img.naturalHeight) / 2,
      img.naturalWidth / 2,
      img.naturalHeight / 2,
      0,
      0,
      size,
      size,
    );
    return c.createPattern(tile, "repeat")!;
  }
  private makeGround() {
    const a = document.createElement("canvas");
    a.width = 3200;
    a.height = 2400;
    const c = a.getContext("2d")!;
    let seed = 42;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const grad = c.createLinearGradient(0, 0, 0, 2400);
    grad.addColorStop(0, "#41534c");
    grad.addColorStop(0.75, "#596452");
    grad.addColorStop(1, "#343e36");
    c.fillStyle = grad;
    c.fillRect(0, 0, 3200, 2400);
    c.fillStyle = this.material(c, 1, 550);
    c.globalAlpha = 0.6;
    c.fillRect(0, 0, 3200, 2400);
    c.globalAlpha = 1;
    for (let i = 0; i < 26000; i++) {
      const x = rng() * 3200,
        y = rng() * 2400;
      c.fillStyle = rng() > 0.5 ? "rgba(204,195,140,.065)" : "rgba(8,25,23,.09)";
      c.fillRect(x, y, 2 + rng() * 13, 1 + rng() * 6);
    }
    // Ring moat and raised limestone precinct.
    c.fillStyle = "#243f41";
    c.fillRect(420, 235, 2360, 1540);
    c.fillStyle = "#566e69";
    c.fillRect(450, 255, 2300, 1500);
    c.fillStyle = "#8a9380";
    c.fillRect(500, 300, 2200, 1400);
    c.fillStyle = "#737e70";
    c.fillRect(530, 330, 2140, 1340);
    for (let i = 0; i < 18000; i++) {
      const x = 530 + rng() * 2140,
        y = 330 + rng() * 1340;
      c.fillStyle = rng() > 0.5 ? "rgba(224,222,185,.12)" : "rgba(30,42,40,.10)";
      c.fillRect(x, y, 4 + rng() * 22, 2 + rng() * 8);
    }
    c.fillStyle = this.material(c, 0, 240);
    c.globalAlpha = 0.3;
    c.fillRect(530, 330, 2140, 1340);
    c.globalAlpha = 1;
    c.fillStyle = "rgba(81,99,89,.19)";
    c.fillRect(530, 330, 2140, 1340);
    const road = (pts: number[][], width: number) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.lineJoin = "round";
      c.strokeStyle = "#59695f";
      c.lineWidth = width + 12;
      c.stroke();
      c.strokeStyle = this.material(c, 0, 160);
      c.lineWidth = width;
      c.stroke();
      c.strokeStyle = "rgba(226,216,175,.28)";
      c.lineWidth = width - 8;
      c.stroke();
    };
    road(
      [
        [1600, 2310],
        [1600, 390],
      ],
      125,
    );
    road(
      [
        [850, 2280],
        [850, 1120],
        [1250, 1000],
        [1950, 1000],
        [2300, 1120],
        [2300, 2280],
      ],
      110,
    );
    road(
      [
        [540, 1430],
        [2650, 1430],
      ],
      90,
    );
    road(
      [
        [550, 1200],
        [2680, 1200],
      ],
      60,
    );
    road(
      [
        [600, 600],
        [2600, 600],
      ],
      85,
    );
    road(
      [
        [650, 780],
        [2590, 780],
      ],
      55,
    );
    road(
      [
        [650, 440],
        [2600, 440],
      ],
      48,
    );
    // Cathedral plaza, engraved circular stonework, radial paths.
    c.fillStyle = "#a9ad96";
    c.beginPath();
    c.ellipse(1600, 1010, 340, 270, 0, 0, Math.PI * 2);
    c.fill();
    for (let r = 100; r <= 325; r += 44) {
      c.strokeStyle = r % 3 ? "#c5bd99" : "#687a72";
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(1600, 1010, r, r * 0.8, 0, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      c.strokeStyle = "#7d8a7a";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(1600 + Math.cos(angle) * 100, 1010 + Math.sin(angle) * 80);
      c.lineTo(1600 + Math.cos(angle) * 330, 1010 + Math.sin(angle) * 264);
      c.stroke();
    }
    const house = (x: number, y: number, w: number, h: number, royal = false) => {
      c.fillStyle = "rgba(13,26,25,.18)";
      c.beginPath();
      c.ellipse(x + 12, y + 4, w * 0.58, 19, 0, 0, 7);
      c.fill();
      this.drawAtlas(
        c,
        "city",
        royal ? 3 : Math.round(x + y) % 2 ? 1 : 2,
        4,
        2,
        x,
        y + 12,
        w * 1.32,
        h * 1.75,
      );
    };
    // Distinct residential, military, and cathedral quarters, clear approach streets.
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 12; col++) {
        const x = 660 + col * 170,
          y = 510 + row * 175;
        if (Math.abs(x - 1600) < 160) continue;
        house(x + (rng() - 0.5) * 28, y, 95 + rng() * 25, 60 + rng() * 20, col % 4 === 0);
      }
    for (const side of [0, 1])
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          const x = (side ? 2160 : 630) + col * 140,
            y = 940 + row * 140;
          if ((x > 760 && x < 980) || (x > 2220 && x < 2410)) continue;
          house(x, y, 80 + rng() * 22, 58 + rng() * 20, row === 0);
        }
    this.drawAtlas(c, "city", 0, 4, 2, 1600, 680, 420, 350);
    this.drawAtlas(c, "city", 3, 4, 2, 1050, 620, 245, 210);
    this.drawAtlas(c, "city", 3, 4, 2, 2150, 620, 245, 210);
    for (const [x, y] of [
      [1040, 1050],
      [2150, 990],
      [1060, 1210],
      [2160, 1280],
    ])
      this.drawAtlas(c, "city", 6, 4, 2, x, y, 150, 130);
    // Exterior woods, rocks, wheat and marching encampments.
    for (let i = 0; i < 340; i++) {
      const x = rng() * 3200,
        y = rng() * 2400;
      if (x > 380 && x < 2820 && y > 180 && y < 2320) continue;
      const treeSize = 90 + rng() * 75;
      this.drawAtlas(c, "grove", 0, 1, 1, x, y, treeSize, treeSize);
    }
    for (let lane = 0; lane < 3; lane++) {
      const x = [850, 1600, 2380][lane];
      for (let j = 0; j < 6; j++) {
        const xx = x - 180 + j * 70;
        c.fillStyle = "#283c36";
        polygon(
          c,
          [
            [xx - 20, 2310],
            [xx, 2280],
            [xx + 22, 2310],
          ],
          "#687667",
          "#b2a379",
        );
        c.fillStyle = "#223d34";
        c.fillRect(xx - 5, 2297, 10, 14);
      }
    }
    return a;
  }
  render(t: number) {
    const c = this.ctx,
      dpr = this.canvas.width / this.width;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#1a2929";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(
      this.width / 2 + Math.sin(t * 43) * this.shake,
      this.height / 2 + Math.cos(t * 39) * this.shake * 0.5,
    );
    c.scale(this.camera.zoom, this.camera.zoom);
    c.translate(-this.camera.x, -this.camera.y);
    c.drawImage(this.ground, 0, 0);
    this.drawZones(c, t);
    for (const s of this.battle.structures.filter((s) => s.hp <= 0 && s.kind !== "crystal"))
      this.drawRuin(c, s);
    const objects: (
      { y: number; type: "unit"; u: Unit } | { y: number; type: "structure"; s: Structure }
    )[] = [];
    const visible = (x: number, y: number) =>
      Math.abs(x - this.camera.x) < this.width / 2 / this.camera.zoom + 230 &&
      Math.abs(y - this.camera.y) < this.height / 2 / this.camera.zoom + 320;
    for (const s of this.battle.structures)
      if (s.hp > 0 && visible(s.x, s.y)) objects.push({ y: s.y, type: "structure", s });
    for (const u of this.battle.units)
      if ((u.hp > 0 || this.battle.time - u.deadAt < 1.4) && visible(u.x, u.y))
        objects.push({ y: u.y + (u.flying ? 100 : 0), type: "unit", u });
    objects.sort((a, b) => a.y - b.y);
    for (const o of objects)
      o.type === "unit" ? this.drawUnit(c, o.u, t) : this.drawStructure(c, o.s, t);
    for (const f of this.fx) this.drawEffect(c, f, t);
    this.drawPointer(c, t);
    if (this.selection) {
      c.fillStyle = "rgba(116,222,193,.12)";
      c.strokeStyle = "#a4f0d1";
      c.lineWidth = 2 / this.camera.zoom;
      c.fillRect(
        this.selection.x,
        this.selection.y,
        this.selection.tx - this.selection.x,
        this.selection.ty - this.selection.y,
      );
      c.strokeRect(
        this.selection.x,
        this.selection.y,
        this.selection.tx - this.selection.x,
        this.selection.ty - this.selection.y,
      );
    }
    c.restore();
    const vignette = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.25,
      this.width / 2,
      this.height / 2,
      this.width * 0.65,
    );
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, "rgba(6,17,21,.42)");
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
  }
  private drawZones(c: CanvasRenderingContext2D, t: number) {
    for (const [i, x] of [850, 1600, 2380].entries()) {
      const active = this.mode.type === "deploy";
      c.fillStyle = active ? "rgba(94,218,173,.12)" : "rgba(70,154,125,.04)";
      c.strokeStyle = active ? "#80d5b0" : "#789484";
      c.lineWidth = 2;
      c.setLineDash([14, 12]);
      c.strokeRect(x - 260, 1870, 520, 400);
      c.fillRect(x - 260, 1870, 520, 400);
      c.setLineDash([]);
      this.text(c, ["西境召唤阵", "正门召唤阵", "东境召唤阵"][i], x, 2220, 22, "#c0cbb2");
    }
    for (const p of this.battle.outposts) {
      c.fillStyle = p.captured ? "rgba(75,192,154,.13)" : "rgba(164,143,94,.10)";
      c.beginPath();
      c.ellipse(p.x, p.y, 145, 95, 0, 0, 7);
      c.fill();
      c.strokeStyle = p.captured ? "#86dfbc" : "#c3ad7d";
      c.lineWidth = 4;
      c.stroke();
      if (p.progress > 0 && !p.captured) {
        c.strokeStyle = "#83e3c2";
        c.lineWidth = 10;
        c.beginPath();
        c.arc(p.x, p.y, 90, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.progress) / 8);
        c.stroke();
      }
      this.text(
        c,
        p.captured
          ? `${p.name} · ${p.contested ? "争夺中" : "援军已解锁"}`
          : `${p.name} · ${p.progress > 0 ? `${p.progress.toFixed(1)} / 8s` : "占领8秒"}`,
        p.x,
        p.y + 110,
        20,
        p.captured ? "#b5f3d5" : "#e4d1a7",
      );
      this.flag(c, p.x - 50, p.y - 10, t, p.captured);
    }
  }
  private text(
    c: CanvasRenderingContext2D,
    s: string,
    x: number,
    y: number,
    size = 18,
    color = "#e4ddbe",
  ) {
    c.font = `500 ${size}px "Microsoft YaHei", sans-serif`;
    c.textAlign = "center";
    c.fillStyle = "rgba(9,20,22,.65)";
    c.fillText(s, x + 2, y + 3);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  private flag(c: CanvasRenderingContext2D, x: number, y: number, t: number, green = false) {
    c.fillStyle = "#bca877";
    c.fillRect(x, y - 85, 3, 90);
    polygon(
      c,
      [
        [x + 3, y - 85],
        [x + 35, y - 79 + Math.sin(t * 3 + x) * 4],
        [x + 31, y - 44 + Math.sin(t * 3 + x + 1) * 4],
        [x + 3, y - 50],
      ],
      green ? "#237b65" : "#294d69",
      "#c6b47c",
    );
    c.fillStyle = "#c6b47c";
    c.fillRect(x + 13, y - 71, 3, 12);
    c.fillRect(x + 9, y - 67, 11, 3);
  }
  private drawStructure(c: CanvasRenderingContext2D, s: Structure, t: number) {
    if (s.kind === "wall" || s.kind === "gate") {
      const tall = s.kind === "gate" ? 68 : 47,
        x = s.x - s.w / 2,
        y = s.y - s.h / 2;
      c.fillStyle = "rgba(10,24,24,.27)";
      c.fillRect(x + 14, y + 17, s.w + 10, s.h + 18);
      c.fillStyle = "#777e72";
      c.fillRect(x, y - tall * 0.1, s.w, s.h);
      c.fillStyle = s.weak ? "#aaa995" : "#b9baa6";
      c.fillRect(x, y - tall, s.w, s.h + tall * 0.7);
      this.wallPattern ??= this.material(c, 2, 180);
      c.fillStyle = this.wallPattern;
      c.globalAlpha = 0.48;
      c.fillRect(x, y - tall, s.w, s.h + tall * 0.7);
      c.globalAlpha = 1;
      c.fillStyle = "#d4d1b6";
      c.fillRect(x - 2, y - tall - 5, s.w + 4, 10);
      c.strokeStyle = "#8b9485";
      c.lineWidth = 1.5;
      for (let yy = y - tall + 13; yy < y + 10; yy += 14) {
        c.beginPath();
        c.moveTo(x, yy);
        c.lineTo(x + s.w, yy);
        c.stroke();
        for (let xx = x + (yy % 2) * 14; xx < x + s.w; xx += 28) {
          c.beginPath();
          c.moveTo(xx, yy);
          c.lineTo(xx, yy + 14);
          c.stroke();
        }
      }
      c.fillStyle = "#c6c4ab";
      for (let xx = x; xx < x + s.w; xx += 22) c.fillRect(xx, y - tall - 15, 13, 15);
      if (s.kind === "gate") {
        c.fillStyle = "#584e3c";
        c.fillRect(x + 8, y - tall + 22, s.w - 16, tall + 2);
        c.strokeStyle = "#322d28";
        for (let xx = x + 12; xx < x + s.w - 8; xx += 12) {
          c.beginPath();
          c.moveTo(xx, y - tall + 23);
          c.lineTo(xx, y + 20);
          c.stroke();
        }
        c.strokeStyle = "#c6ab6b";
        c.lineWidth = 4;
        c.strokeRect(x + 8, y - tall + 22, s.w - 16, tall + 2);
      }
      if (s.hp < s.maxHp * 0.65) {
        c.strokeStyle = "#484b44";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(s.x - 10, y - tall);
        c.lineTo(s.x + 8, y - tall + 18);
        c.lineTo(s.x - 7, y - tall + 29);
        c.lineTo(s.x + 10, y + 15);
        c.stroke();
      }
      if (s.id % 5 === 0) this.flag(c, s.x, s.y - tall, t);
      if (s.y === 1700 && [550, 1150, 2050, 2650].includes(s.x))
        this.drawAtlas(c, "city", 4, 4, 2, s.x, s.y + 14, 140, 180);
      if (s.y === 1700 && s.x === 1550) this.drawAtlas(c, "city", 7, 4, 2, s.x, s.y + 18, 240, 250);
    } else {
      const indices: Partial<Record<Kind, number>> = {
        arrow: 0,
        cannon: 1,
        antiAir: 2,
        holy: 3,
        barracks: 4,
        crystal: 5,
      };
      const width =
        s.kind === "crystal" ? 290 : s.kind === "barracks" ? 220 : s.kind === "cannon" ? 175 : 152;
      const height =
        s.kind === "crystal" ? 310 : s.kind === "barracks" ? 180 : s.kind === "cannon" ? 155 : 220;
      c.fillStyle = "rgba(7,23,25,.22)";
      c.beginPath();
      c.ellipse(s.x + 12, s.y + 9, width * 0.42, 24, 0, 0, 7);
      c.fill();
      if (s.kind === "crystal") {
        const glow = c.createRadialGradient(s.x, s.y - 130, 10, s.x, s.y - 130, 230);
        glow.addColorStop(0, "rgba(255,235,161,.24)");
        glow.addColorStop(1, "transparent");
        c.fillStyle = glow;
        c.fillRect(s.x - 240, s.y - 360, 480, 480);
        c.save();
        c.globalCompositeOperation = "screen";
        c.fillStyle = `rgba(219,238,208,${0.04 + Math.sin(t) * 0.015})`;
        polygon(
          c,
          [
            [s.x - 22, s.y - 120],
            [s.x - 80, 0],
            [s.x + 80, 0],
            [s.x + 22, s.y - 120],
          ],
          c.fillStyle,
        );
        c.restore();
      }
      c.save();
      if (s.attackFlash > 0 && s.kind === "cannon") c.translate(0, (5 * s.attackFlash) / 0.3);
      this.drawAtlas(c, "structures", indices[s.kind] ?? 0, 3, 2, s.x, s.y + 24, width, height);
      c.restore();
      if (s.kind === "crystal") this.text(c, "日 轮 圣 晶", s.x, s.y - 290, 26, "#f5e1a5");
      if (s.attackFlash > 0 && s.kind !== "crystal") {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.fillStyle = `rgba(166,229,255,${s.attackFlash})`;
        c.beginPath();
        c.arc(s.x, s.y - 80, 23, 0, 7);
        c.fill();
        c.restore();
      }
    }
    if (s.hp < s.maxHp && s.kind !== "crystal")
      this.health(c, s.x, s.y + 22, Math.max(45, s.w * 0.8), s.hp / s.maxHp, "#dbc08a");
  }
  private drawRuin(c: CanvasRenderingContext2D, s: Structure) {
    c.fillStyle = "#747b6b";
    c.beginPath();
    c.ellipse(s.x, s.y, Math.max(30, s.w * 0.52), Math.max(18, s.h * 0.4), 0, 0, 7);
    c.fill();
    for (let i = 0; i < 9; i++) {
      const x = s.x + Math.sin(i * 17 + s.id) * s.w * 0.48,
        y = s.y + Math.cos(i * 13 + s.id) * s.h * 0.55;
      polygon(
        c,
        [
          [x - 8, y + 5],
          [x - 4, y - 10],
          [x + 10, y - 7],
          [x + 12, y + 5],
        ],
        i % 2 ? "#b3b09a" : "#929783",
        "#626f62",
      );
    }
  }
  private health(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    ratio: number,
    color: string,
  ) {
    c.fillStyle = "#142c29";
    c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    c.fillStyle = color;
    c.fillRect(x - w / 2, y, w * Math.max(0, ratio), 4);
  }
  private drawUnit(c: CanvasRenderingContext2D, u: Unit, t: number) {
    const dead = u.hp <= 0;
    const death = dead ? Math.min(1, (this.battle.time - u.deadAt) / 1.4) : 0;
    const hero = isCommander(u.kind) || u.kind === "king";
    const selected = this.battle.selected.has(u.id);
    const size = u.size;
    const phase =
      this.battle.time * (u.kind === "slime" || u.kind === "split" ? 7 : u.speed * 0.08) + u.id;
    const bob = u.moving
      ? Math.sin(phase) * (u.flying ? 9 : u.kind === "slime" || u.kind === "split" ? 6 : 2.2)
      : Math.sin(t * 2 + u.id) * 0.8;
    c.save();
    c.globalAlpha = 1 - death;
    c.fillStyle = "rgba(9,22,24,.32)";
    c.beginPath();
    c.ellipse(u.x + 4, u.y + 3, size * 0.36, size * 0.14, 0, 0, 7);
    c.fill();
    if (selected || hero) {
      c.strokeStyle = selected ? "#adffe2" : u.side === 0 ? "#b5a56c" : "#dcb37d";
      c.lineWidth = selected ? 3 : 1.5;
      c.beginPath();
      c.ellipse(u.x, u.y, size * 0.43, size * 0.17, 0, 0, 7);
      c.stroke();
    }
    if (u.buff > 0 || u.hunt > 0) {
      c.strokeStyle = u.buff > 0 ? "#b4e894" : "#bddafb";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(u.x, u.y - 10, size * 0.6, t, t + 4);
      c.stroke();
    }
    c.translate(u.x, u.y - bob - (u.flying ? 30 : 0) + death * 10);
    c.scale(u.facing, 1);
    c.rotate(u.attack > 0 ? Math.sin(u.attack * 20) * 0.12 : dead ? death * 0.7 : 0);
    const squash =
      (u.kind === "slime" || u.kind === "split") && u.moving ? Math.sin(phase) * 0.1 : 0;
    c.scale(1 + squash, 1 - squash);
    if (isCommander(u.kind)) this.drawAtlas(c, "hero-" + u.kind, 0, 1, 1, 0, 6, size, size);
    else
      this.drawAtlas(
        c,
        u.moving && Math.sin(phase) > 0 ? "units-move" : "units",
        u.sprite,
        4,
        4,
        0,
        6,
        size,
        size,
      );
    // Independent wing beats add articulation to the original dragon silhouettes.
    if (u.flying && u.moving) {
      c.globalAlpha *= 0.12;
      c.scale(1 + Math.sin(phase) * 0.12, 0.98);
      if (isCommander(u.kind)) this.drawAtlas(c, "hero-dragon", 0, 1, 1, 0, 6, size, size);
      else this.drawAtlas(c, "units", u.sprite, 4, 4, 0, 6, size, size);
    }
    if (u.hit > 0) {
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = `rgba(255,224,178,${u.hit * 2})`;
      c.fillRect(-size / 2, -size, size, size);
    }
    c.restore();
    if (dead) return;
    if (u.hp < u.maxHp || selected || hero)
      this.health(
        c,
        u.x,
        u.y - size * 0.92 - (u.flying ? 28 : 0),
        hero ? 66 : Math.max(21, size * 0.7),
        u.hp / u.maxHp,
        u.side === 0 ? "#80dbb2" : "#df9c84",
      );
    if (hero) this.text(c, u.name, u.x, u.y + 23, 16, u.side === 0 ? "#e4d3a5" : "#f2c6a6");
  }
  private drawEffect(
    c: CanvasRenderingContext2D,
    f: Event & { age: number; life: number },
    t: number,
  ) {
    const p = f.age / f.life;
    const alpha = 1 - p;
    c.save();
    c.globalAlpha = alpha;
    const x = f.x,
      y = f.y,
      r = f.radius ?? 60;
    if (f.type === "shot") {
      const tracked = f.target && !f.radius ? this.battle.byId.get(f.target) : undefined;
      const tx = tracked?.x ?? f.tx ?? x,
        ty = tracked?.y ?? f.ty ?? y;
      const q = Math.min(1, f.age / (f.kind === "cannon" ? 0.95 : 0.3));
      const xx = x + (tx - x) * q,
        yy = y + (ty - y) * q - (f.kind === "cannon" ? Math.sin(q * Math.PI) * 120 : 0);
      c.strokeStyle = f.side === 0 ? "#a5efd0" : f.kind === "antiAir" ? "#91d4ff" : "#ffcd87";
      c.lineWidth = f.kind === "cannon" ? 6 : 2.5;
      c.beginPath();
      c.moveTo(xx - (tx - x) * 0.07, yy - (ty - y) * 0.07);
      c.lineTo(xx, yy);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.beginPath();
      c.arc(xx, yy, f.kind === "cannon" ? 7 : 3, 0, 7);
      c.fill();
      if (f.kind === "cannon" && q < 1) {
        c.strokeStyle = "rgba(230,156,88,.45)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(tx, ty, r, 0, 7);
        c.stroke();
      }
    } else if (f.type === "deploy" || f.type === "capture") {
      c.strokeStyle = "#8ae7c0";
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(x, y, r * (0.7 + p * 0.7), r * 0.4, 0, 0, 7);
      c.stroke();
      c.save();
      c.translate(x, y);
      c.rotate(t * 0.5);
      for (let i = 0; i < 8; i++) {
        c.rotate(Math.PI / 4);
        c.fillStyle = "#b1f3d4";
        c.fillRect(r * 0.8, -3, 12, 6);
      }
      c.restore();
      if (f.text) this.text(c, f.text, x, y - 90 - p * 30, 25, "#b6f0cd");
    } else if (f.type === "skill") {
      const color =
        f.kind === "dragon"
          ? "#8bdbff"
          : f.kind === "titan"
            ? "#efca88"
            : f.kind === "web"
              ? "#d0a3ed"
              : "#9bf0c1";
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = 4;
      if (f.kind === "titan") {
        c.strokeStyle = "#e7bf80";
        c.lineWidth = 7;
        c.globalAlpha = alpha * 0.8;
        c.beginPath();
        c.ellipse(x, y, r * (0.5 + p), r * (0.25 + p * 0.45), 0, 0, 7);
        c.stroke();
        for (let i = 0; i < 28; i++) {
          const a = i * 2.399,
            spread = r * (0.15 + p) * (0.5 + Math.sin(i * 17) * 0.4),
            xx = x + Math.cos(a) * spread,
            yy = y + Math.sin(a) * spread * 0.5 - Math.sin(p * Math.PI) * 70;
          c.globalAlpha = alpha * 0.8;
          polygon(
            c,
            [
              [xx - 5, yy + 3],
              [xx - 8, yy - 7],
              [xx + 4, yy - 11],
              [xx + 8, yy + 1],
            ],
            i % 3 ? "#cfc2a3" : "#777b68",
            "#d8b77c",
          );
        }
        c.globalAlpha = alpha * 0.15;
        c.fillStyle = "#d3bc90";
        c.beginPath();
        c.ellipse(x, y, r * (0.5 + p), r * 0.4, 0, 0, 7);
        c.fill();
      } else if (f.kind === "king" && this.battle.loadout.spec === "element") {
        const q = Math.min(1, p * 4),
          mx = x - 180 * (1 - q),
          my = y - 420 * (1 - q);
        const fire = c.createRadialGradient(mx, my, 0, mx, my, 65);
        fire.addColorStop(0, "#fff5c8");
        fire.addColorStop(0.3, "#ffb765");
        fire.addColorStop(1, "rgba(243,139,70,0)");
        c.fillStyle = fire;
        c.fillRect(mx - 65, my - 65, 130, 130);
        c.strokeStyle = "#f4b77b";
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(mx - 60 * (1 - q), my - 140 * (1 - q));
        c.lineTo(mx, my);
        c.stroke();
        if (q >= 1) {
          c.globalAlpha = alpha * 0.4;
          c.fillStyle = "#f6d190";
          c.beginPath();
          c.arc(x, y, r * Math.min(1, p * 2), 0, 7);
          c.fill();
        }
      } else if (f.kind === "dragon") {
        c.translate(x, y);
        c.rotate(f.angle ?? 0);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, "rgba(205,245,255,.7)");
        g.addColorStop(1, "rgba(73,168,255,0)");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, r, -0.65, 0.65);
        c.closePath();
        c.fill();
        for (let i = 0; i < 7; i++) {
          const a = (i / 6 - 0.5) * 1.2;
          c.beginPath();
          c.moveTo(0, 0);
          for (let j = 1; j <= 6; j++)
            c.lineTo(
              (Math.cos(a) * r * j) / 6,
              (Math.sin(a) * r * j) / 6 + Math.sin(j * 17 + t * 30) * 12,
            );
          c.stroke();
        }
      } else {
        c.globalAlpha = alpha * 0.3;
        c.beginPath();
        c.arc(x, y, r, 0, 7);
        c.fill();
        c.globalAlpha = alpha;
        c.beginPath();
        c.arc(x, y, r * (0.75 + p * 0.25), 0, 7);
        c.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
          c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          c.stroke();
        }
        if (f.kind === "web") {
          for (let j = 1; j <= 4; j++) {
            c.beginPath();
            c.arc(x, y, (r * j) / 4, 0, 7);
            c.stroke();
          }
        }
      }
      c.setTransform(c.getTransform());
    } else if (["wall", "destroy", "impact", "hit"].includes(f.type)) {
      const dust = f.type === "wall" || f.type === "destroy";
      c.fillStyle = dust ? "#c7bda0" : f.kind === "cannon" ? "#ffc87c" : "#c4efdc";
      for (let i = 0; i < (dust ? 22 : 7); i++) {
        const a = i * 2.399,
          d = (15 + p * r) * Math.sin(i * 23 + 4);
        const xx = x + Math.cos(a) * d,
          yy = y + Math.sin(a) * d - p * 50;
        c.globalAlpha = alpha * (dust ? 0.65 : 0.7);
        c.beginPath();
        c.arc(xx, yy, Math.max(1, (dust ? 8 : 5) * (1 - p)), 0, 7);
        c.fill();
      }
    } else if (f.type === "victory" || f.type === "defeat") {
      const g = c.createRadialGradient(x, y, 0, x, y, r * (p * 3 + 0.3));
      g.addColorStop(0, f.type === "victory" ? "rgba(123,240,219,.7)" : "rgba(255,233,166,.8)");
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      if (f.type === "victory") {
        for (let i = 0; i < 36; i++) {
          const a = i * 2.399,
            spread = (60 + p * 1300) * (0.3 + Math.sin(i * 8) * 0.65),
            xx = x + Math.cos(a) * spread,
            yy = y - 140 + Math.sin(a) * spread * 0.6 - p * 180;
          c.globalAlpha = alpha;
          polygon(
            c,
            [
              [xx, yy - 16],
              [xx + 7, yy],
              [xx, yy + 20],
              [xx - 8, yy],
            ],
            i % 2 ? "#f8e4a7" : "#b6f2e4",
            "#fff4cf",
          );
        }
      } else {
        c.globalAlpha = alpha * 0.45;
        c.fillStyle = "#fff4cf";
        polygon(
          c,
          [
            [x - 35, y - 120],
            [x - 900, 0],
            [x + 900, 0],
            [x + 35, y - 120],
          ],
          c.fillStyle,
        );
      }
    }
    c.restore();
  }
  private drawPointer(c: CanvasRenderingContext2D, t: number) {
    if (this.mode.type === "none") return;
    const { x, y } = this.pointer;
    const skill = this.mode.type === "skill";
    const kind = this.mode.kind;
    const legal = skill
      ? !!this.battle.getUnit(kind as Kind) &&
        Math.hypot(
          x - this.battle.getUnit(kind as Kind)!.x,
          y - this.battle.getUnit(kind as Kind)!.y,
        ) <
          (isCommander(kind as Kind) ? COMMANDERS[kind as keyof typeof COMMANDERS].castRange : 460)
      : this.battle.canDeploy(x, y);
    const r = skill
      ? isCommander(kind as Kind)
        ? COMMANDERS[kind as keyof typeof COMMANDERS].radius
        : 180
      : 65;
    c.fillStyle = legal ? "rgba(105,231,183,.14)" : "rgba(248,116,101,.18)";
    c.strokeStyle = legal ? "#a7f1cf" : "#ee9687";
    c.lineWidth = 2 / this.camera.zoom;
    c.setLineDash([12, 8]);
    if (!(skill && kind === "dragon")) {
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.fill();
      c.stroke();
    }
    c.setLineDash([]);
    if (skill && kind === "dragon") {
      const hero = this.battle.getUnit("dragon");
      if (hero) {
        const angle = Math.atan2(y - hero.y, x - hero.x);
        c.beginPath();
        c.moveTo(hero.x, hero.y);
        c.arc(hero.x, hero.y, r, angle - 0.65, angle + 0.65);
        c.closePath();
        c.fill();
        c.stroke();
      }
    }
    this.text(
      c,
      skill ? "左键施放 · Esc取消" : legal ? "松开部署 · 库存出征" : "此处不可部署",
      x,
      y - r - 20 + Math.sin(t * 3) * 2,
      22,
      legal ? "#b4f2d4" : "#f3b6a8",
    );
  }
  private drawMini() {
    const c = this.mini.getContext("2d")!;
    this.mini.width = 200;
    this.mini.height = 150;
    c.drawImage(this.ground, 0, 0, 200, 150);
    const sx = 200 / 3200,
      sy = 150 / 2400;
    for (const s of this.battle.structures)
      if (s.hp > 0) {
        c.fillStyle = s.kind === "crystal" ? "#fff0b5" : "#bfbda3";
        c.fillRect(s.x * sx - 2, s.y * sy - 1, 4, 2);
      }
    for (const u of this.battle.units)
      if (u.hp > 0) {
        c.fillStyle = u.side === 0 ? "#75f2bb" : "#edaa85";
        c.fillRect(u.x * sx, u.y * sy, 2, 2);
      }
    c.strokeStyle = "#deceb0";
    c.lineWidth = 1;
    c.strokeRect(
      (this.camera.x - this.width / 2 / this.camera.zoom) * sx,
      (this.camera.y - this.height / 2 / this.camera.zoom) * sy,
      (this.width / this.camera.zoom) * sx,
      (this.height / this.camera.zoom) * sy,
    );
  }
}
