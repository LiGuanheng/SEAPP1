import Phaser from 'phaser';
import { UNITS } from '../config/balance';
import { MAP_H, MAP_W, NODES, SLOTS, THRONE, TILE_SIZE, ZONES, terrainAt } from '../config/mapData';
import type { CampaignState, NodeId, UnitType } from '../core/types';
import { BattleSim, type SimEvent } from '../battle/sim';
import { tileIndex } from '../art/tiles';
import { animKey, registerAllTextures } from './textures';

export interface SceneHooks {
  onLog?: (text: string, kind?: 'good' | 'bad' | 'gold') => void;
  onDeploy?: (ok: boolean, message: string, count: number) => void;
  onSelection?: (ids: number[], info: string) => void;
  onBattleEnd?: () => void;
  onStats?: (stats: { fps: number; units: number; time: number; commandUsed: number; commandCap: number; alive: number }) => void;
  onNodeClick?: (node: NodeId) => void;
  onSlotClick?: (slotId: string) => void;
}

interface UnitView {
  sprite: Phaser.GameObjects.Sprite;
  ring: Phaser.GameObjects.Image;
  pose: string;
  dead: boolean;
  hpBar: Phaser.GameObjects.Graphics;
}


export class WorldScene extends Phaser.Scene {
  readonly state: CampaignState;
  readonly hooks: SceneHooks;
  readonly mode: 'council' | 'battle' | 'demo';
  sim: BattleSim | null = null;
  ready = false;
  paused = false;
  speed = 1;
  deployType: UnitType | null = null;
  selection: number[] = [];

  private views = new Map<number, UnitView>();
  private facilitySprites = new Map<string, Phaser.GameObjects.Image>();
  private wallSprites = new Map<string, Phaser.GameObjects.TileSprite>();
  private wallCracks = new Map<string, Phaser.GameObjects.Image>();
  private towerSprites = new Map<string, Phaser.GameObjects.Image>();
  private slotMarkers: Phaser.GameObjects.Container[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selectBox!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private zoneGraphics!: Phaser.GameObjects.Graphics;
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private acc = 0;
  private statTimer = 0;
  private damageTimer = 0;
  private pointerWorld = new Phaser.Math.Vector2();
  private battleEnded = false;

  constructor(state: CampaignState, hooks: SceneHooks, mode: 'council' | 'battle' | 'demo', sim?: BattleSim) {
    super('world');
    this.state = state;
    this.hooks = hooks;
    this.mode = mode;
    this.sim = sim ?? null;
  }

  create(): void {
    registerAllTextures(this);
    this.buildTerrain();
    this.buildWalls();
    this.buildFacilities();
    this.buildUndead();
    this.buildDecor();
    this.buildLights();
    this.buildTerritory();
    this.buildSlots();

    this.zoneGraphics = this.add.graphics().setDepth(2);
    this.ghost = this.add.graphics().setDepth(9000);
    this.selectBox = this.add.graphics().setDepth(9500);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    cam.setZoom(this.mode === 'battle' ? 0.92 : 0.6);
    cam.setBackgroundColor('#070a09');
    const start = this.mode === 'battle' ? { x: 80 * 32, y: 98 * 32 } : { x: 80 * 32, y: 66 * 32 };
    cam.centerOn(start.x, start.y);

    if (this.game.renderer.type === Phaser.WEBGL) {
      try {
        cam.postFX.addVignette(0.5, 0.5, 0.92, 0.42);
      } catch {
        /* 某些设备不支持后处理，忽略即可 */
      }
    }
    this.setupInput();
    this.buildAmbient();

    if (this.mode === 'battle') this.cameras.main.fadeIn(500, 0, 0, 0);
    this.ready = true;
    this.hooks.onLog?.(this.mode === 'battle' ? '攻城开始：投放尸群，摧毁灯塔' : '议事厅：选择建造点、整备军队', 'gold');
  }

  /* ---------------- 地图 ---------------- */

  private buildTerrain(): void {
    const data: number[][] = [];
    for (let y = 0; y < MAP_H; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_W; x++) row.push(tileIndex(terrainAt(x, y), x, y));
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = map.addTilesetImage('tiles', 'tileset', TILE_SIZE, TILE_SIZE);
    if (!tiles) return;
    const layer = map.createLayer(0, tiles, 0, 0);
    layer?.setDepth(0);
    // 地图边缘的黑暗
    const edge = this.add.graphics().setDepth(1);
    edge.fillStyle(0x050706, 0.85);
    edge.fillRect(0, 0, MAP_W * TILE_SIZE, 20 * TILE_SIZE);
    edge.fillRect(0, 108 * TILE_SIZE, MAP_W * TILE_SIZE, 4 * TILE_SIZE);
    edge.fillRect(0, 0, 22 * TILE_SIZE, MAP_H * TILE_SIZE);
    edge.fillRect(148 * TILE_SIZE, 0, 12 * TILE_SIZE, MAP_H * TILE_SIZE);
  }

  private buildWalls(): void {
    for (const w of this.state.walls) {
      const len = w.len * TILE_SIZE;
      if (w.destroyed) {
        this.spawnRubbleLine(w.x, w.y, w.len, w.dir);
        continue;
      }
      let ts: Phaser.GameObjects.TileSprite;
      if (w.dir === 'h') {
        ts = this.add.tileSprite(w.x * TILE_SIZE, (w.y + 1) * TILE_SIZE, len, 56, w.kind === 'gate' || w.kind === 'innerGate' ? 'gate' : 'wall-h');
        ts.setOrigin(0, 1);
        if (w.kind === 'gate' || w.kind === 'innerGate') ts.setTileScale(len / (12 * TILE_SIZE), 1);
        ts.setDepth(w.y * TILE_SIZE + 30);
      } else {
        ts = this.add.tileSprite((w.x + 1) * TILE_SIZE, w.y * TILE_SIZE, 56, len, 'wall-v');
        ts.setOrigin(1, 0);
        if (w.x > 100) ts.setFlipX(true);
        ts.setDepth((w.y + w.len) * TILE_SIZE);
      }
      ts.setAlpha(1);
      this.wallSprites.set(w.id, ts);
      const crack = this.add.image((w.x + w.len / 2) * TILE_SIZE, (w.y + 0.6) * TILE_SIZE, 'fx:debris').setDepth(ts.depth + 1).setVisible(false);
      this.wallCracks.set(w.id, crack);
    }
  }

  private spawnRubbleLine(x: number, y: number, len: number, dir: 'h' | 'v'): void {
    for (let i = 0; i < len; i++) {
      const wx = (dir === 'h' ? x + i : x) * TILE_SIZE + 16;
      const wy = (dir === 'h' ? y : y + i) * TILE_SIZE + 16;
      const img = this.add.image(wx, wy, 'decor:rock:0').setDepth(wy).setAlpha(0.85).setScale(0.9);
      img.setTint(0x8a8a7a);
      img.setAngle((i * 37) % 360);
    }
  }

  private facilityTexture(kind: string): string {
    switch (kind) {
      case 'lighthouse':
        return 'facility:lighthouse';
      case 'barracks':
        return 'facility:barracks';
      case 'arsenal':
        return 'facility:arsenal';
      case 'power':
        return 'facility:power';
      case 'research':
        return 'facility:research';
      case 'medical':
        return 'facility:medical';
      default:
        return 'facility:barracks';
    }
  }

  private buildFacilities(): void {
    for (const f of this.state.human) {
      if (f.kind === 'tower') continue;
      const art = this.facilityTexture(f.kind);
      const x = (f.x + f.w / 2) * TILE_SIZE;
      const y = (f.y + f.h) * TILE_SIZE;
      if (f.destroyed) {
        const ruin = this.add.image(x, y, art).setOrigin(0.5, 1).setDepth(y).setTint(0x2a2a24).setAlpha(0.5);
        ruin.setScale(0.92);
        continue;
      }
      const img = this.add.image(x, y, art).setOrigin(0.5, 1).setDepth(y);
      this.facilitySprites.set(f.id, img);
      if (f.kind === 'lighthouse') {
        const beam = this.add.image(x, y - 160, 'fx:beam').setOrigin(0.02, 0.5).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
        beam.setScale(1.1, 1);
        this.tweens.add({ targets: beam, angle: 360, duration: 26000, repeat: -1, ease: 'Linear' });
      }
    }
    for (const t of this.state.human) {
      if (t.kind !== 'tower') continue;
      const art =
        t.towerKind === 'cannon'
          ? 'facility:cannontower'
          : t.towerKind === 'aa'
            ? 'facility:aatower'
            : t.towerKind === 'holy'
              ? 'facility:holytower'
              : 'facility:mgtower';
      const x = (t.x + 1) * TILE_SIZE;
      const y = (t.y + 2) * TILE_SIZE;
      if (t.destroyed) {
        this.add.image(x, y, 'facility:mgtower').setOrigin(0.5, 1).setDepth(y).setTint(0x1e1e1a).setAlpha(0.35);
        continue;
      }
      const img = this.add.image(x, y, art).setOrigin(0.5, 1).setDepth(y);
      this.towerSprites.set(t.id, img);
    }
  }

  /** 亡灵建筑：王座、尸巢、变异池、祭坛 */
  private buildUndead(): void {
    const tx = THRONE.x * TILE_SIZE;
    const ty = (THRONE.y + 1) * TILE_SIZE;
    this.add.image(tx, ty, 'facility:throne').setOrigin(0.5, 1).setDepth(ty);
    this.add.image(tx - 70, ty - 6, 'decor:soulfire:0').setOrigin(0.5, 1).setDepth(ty - 6);
    this.add.image(tx + 70, ty - 6, 'decor:soulfire:0').setOrigin(0.5, 1).setDepth(ty - 6);
    for (const b of this.state.buildings) {
      if (b.destroyed) continue;
      const key =
        b.kind === 'brood'
          ? `facility:brood${Math.min(3, Math.max(1, b.level))}`
          : b.kind === 'mutation'
            ? 'facility:mutation'
            : 'facility:altar';
      const x = b.x * TILE_SIZE;
      const y = (b.y + 1) * TILE_SIZE;
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    }
  }

  private buildDecor(): void {
    const rng = new Phaser.Math.RandomDataGenerator([String(this.state.seed)]);
    // 细密地表装饰（石砾、裂纹、枯草、血渍）
    for (let i = 0; i < 900; i++) {
      const tx = 22 + Math.floor(rng.frac() * 116);
      const ty = 18 + Math.floor(rng.frac() * 90);
      const terrain = terrainAt(tx, ty);
      let key: string;
      if (terrain === 4) key = rng.frac() < 0.6 ? 'decor:crack:0' : 'decor:pebble:0';
      else if (terrain === 16) key = 'decor:tuft:0';
      else if (terrain === 24) key = rng.frac() < 0.5 ? 'decor:blood:0' : 'decor:pebble:0';
      else key = rng.frac() < 0.45 ? 'decor:pebble:0' : rng.frac() < 0.7 ? 'decor:crack:0' : 'decor:tuft:0';
      const img = this.add.image(tx * 32 + rng.frac() * 28, ty * 32 + rng.frac() * 28, key);
      img.setDepth(0.6).setAlpha(key === 'decor:blood:0' ? 0.55 : 0.85);
      img.setAngle(rng.frac() * 360);
      img.setScale(0.7 + rng.frac() * 0.7);
    }
    for (let i = 0; i < 260; i++) {
      const tx = 20 + Math.floor(rng.frac() * 120);
      const ty = 16 + Math.floor(rng.frac() * 90);
      const terrain = terrainAt(tx, ty);
      if (terrain < 4 || terrain === 16 || terrain === 20) continue; // 道路/广场上不放
      // 不挡建筑与墙
      let blocked = false;
      for (const w of this.state.walls) {
        if (!w.destroyed && ((w.dir === 'h' && ty === w.y && tx >= w.x && tx < w.x + w.len) || (w.dir === 'v' && tx === w.x && ty >= w.y && ty < w.y + w.len))) blocked = true;
      }
      for (const f of this.state.human) {
        if (tx >= f.x - 1 && tx <= f.x + f.w && ty >= f.y - 1 && ty <= f.y + f.h) blocked = true;
      }
      if (blocked) continue;
      const wx = tx * TILE_SIZE + 16;
      const wy = ty * TILE_SIZE + 16;
      const roll = rng.frac();
      let key = 'decor:rock:0';
      if (terrain === 24) key = roll < 0.5 ? 'decor:bones:0' : 'decor:rock:1';
      else if (roll < 0.45) key = `decor:tree:${Math.floor(rng.frac() * 3)}`;
      else if (roll < 0.7) key = `decor:rock:${Math.floor(rng.frac() * 3)}`;
      else if (roll < 0.85) key = 'decor:barrel:0';
      else key = 'decor:bones:0';
      const img = this.add.image(wx, wy, key).setOrigin(0.5, 1).setDepth(wy);
      img.setScale(0.8 + rng.frac() * 0.4);
      if (rng.frac() < 0.3) img.setFlipX(true);
      if (key.startsWith('decor:tree')) img.setTint(0x8a9484);
    }
  }

  private buildLights(): void {
    const addGlow = (x: number, y: number, color: string, scale: number, alpha: number) => {
      const g = this.add.image(x, y, color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha).setScale(scale).setDepth(y + 2);
      this.tweens.add({ targets: g, alpha: alpha * 0.72, duration: 1600 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return g;
    };
    addGlow(84 * 32, 40 * 32 - 130, 'fx:glow-gold', 3.4, 0.55);
    addGlow(80 * 32, 103 * 32 - 60, 'fx:glow-soul', 2.4, 0.42);
    addGlow(80 * 32, 96 * 32 - 20, 'fx:glow-soul', 1.4, 0.35);
    for (const f of this.state.human) {
      if (f.kind === 'power' && !f.destroyed) addGlow((f.x + 1) * 32, f.y * 32 + 20, 'fx:glow-blue', 1.2, 0.32);
      if (f.kind === 'medical' && !f.destroyed) addGlow((f.x + 1) * 32, f.y * 32 + 16, 'fx:glow-gold', 1.0, 0.18);
    }
    // 旗帜与火盆
    for (const [x, y] of [
      [76, 82],
      [92, 82],
      [46, 78],
      [116, 78],
    ]) {
      this.add.image(x * 32, y * 32, 'decor:brazier:0').setOrigin(0.5, 1).setDepth(y * 32);
      addGlow(x * 32, y * 32 - 24, 'fx:glow-gold', 0.55, 0.3);
    }
    for (const n of NODES) {
      this.add.image(n.x * 32, n.y * 32, 'decor:banner:0').setOrigin(0.5, 1).setDepth(n.y * 32);
    }
  }

  private buildTerritory(): void {
    const g = this.add.graphics().setDepth(1.5);
    for (const n of NODES) {
      const t = this.state.territories.find((v) => v.id === n.id);
      const color = t?.owner === 'undead' ? 0x7dffb0 : 0xc9a45c;
      g.lineStyle(2, color, 0.45);
      g.strokeEllipse(n.x * 32, n.y * 32, n.radius * 64, n.radius * 40);
      g.fillStyle(color, 0.04);
      g.fillEllipse(n.x * 32, n.y * 32, n.radius * 64, n.radius * 40);
    }
    // 王座领地
    g.lineStyle(2, 0x5fbf8a, 0.25);
    g.strokeEllipse(ZONES.throne.x * 32, ZONES.throne.y * 32, ZONES.throne.r * 2, ZONES.throne.r * 1.5);
  }

  private buildSlots(): void {
    if (this.mode === 'battle') return;
    for (const s of SLOTS) {
      const container = this.add.container(s.x * 32, s.y * 32).setDepth(s.y * 32);
      const ring = this.add.graphics();
      ring.lineStyle(1.5, 0x7dffb0, 0.5);
      ring.strokeCircle(0, 0, 22);
      ring.lineStyle(1, 0x7dffb0, 0.25);
      ring.strokeCircle(0, 0, 28);
      const cross = this.add.graphics();
      cross.lineStyle(1, 0x7dffb0, 0.7);
      cross.lineBetween(-6, 0, 6, 0);
      cross.lineBetween(0, -6, 0, 6);
      container.add([ring, cross]);
      container.setSize(56, 56);
      container.setInteractive(new Phaser.Geom.Circle(0, 0, 26), Phaser.Geom.Circle.Contains);
      container.on('pointerdown', () => this.hooks.onSlotClick?.(s.id));
      container.on('pointerover', () => container.setScale(1.15));
      container.on('pointerout', () => container.setScale(1));
      this.tweens.add({ targets: ring, alpha: 0.35, duration: 1800, yoyo: true, repeat: -1 });
      this.slotMarkers.push(container);
    }
  }

  private buildAmbient(): void {
    if (this.mode === 'council') return;
    const particles = this.add.particles(0, 0, 'fx:spark', {
      x: { min: 0, max: MAP_W * TILE_SIZE },
      y: { min: 0, max: MAP_H * TILE_SIZE },
      lifespan: 9000,
      speedX: { min: -8, max: 14 },
      speedY: { min: 4, max: 22 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.28, end: 0 },
      quantity: 1,
      frequency: 220,
      tint: [0x9fd6b0, 0xd8c9a0],
      blendMode: Phaser.BlendModes.ADD,
    });
    particles.setDepth(6000);
  }

  /* ---------------- 输入 ---------------- */

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys('W,A,S,D,SPACE,P,ESC,ONE,TWO,THREE,FOUR,FIVE,R') as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.mouse?.disableContextMenu();
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy2: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy2 * 0.0012, 0.35, 1.8));
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));

    kb.on('keydown-P', () => {
      if (this.mode !== 'battle') return;
      this.paused = !this.paused;
      this.hooks.onLog?.(this.paused ? '已暂停' : '继续', 'gold');
    });
    kb.on('keydown-SPACE', () => {
      const cam = this.cameras.main;
      const target = this.selection.length > 0 ? this.views.get(this.selection[0])?.sprite : null;
      if (target) cam.pan(target.x, target.y, 320, 'Sine.easeInOut');
      else cam.pan(80 * 32, 98 * 32, 320, 'Sine.easeInOut');
    });
    kb.on('keydown-ESC', () => {
      this.deployType = null;
      this.clearSelection();
      this.updateZoneHighlight();
    });
    kb.on('keydown-F', () => {
      if (this.mode === 'battle') this.sim?.chargeAll();
    });
    const cardKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
    cardKeys.forEach((k, i) => {
      kb.on(`keydown-${k}`, () => {
        if (this.mode !== 'battle') return;
        const order: UnitType[] = ['zombie', 'runner', 'brute', 'spider', 'boss'];
        this.setDeployType(order[i]);
      });
    });
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.pointerWorld.set(p.worldX, p.worldY);
    if (this.dragging && this.dragStart) {
      this.drawSelectBox(this.dragStart.x, this.dragStart.y, p.worldX, p.worldY);
    }
    if (this.deployType) this.drawGhost(p.worldX, p.worldY);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (p.rightButtonDown()) {
      if (this.deployType) {
        this.setDeployType(null);
        return;
      }
      this.commandAt(p.worldX, p.worldY);
      return;
    }
    if (p.button !== 0) return;
    if (this.deployType) {
      this.tryDeploy(p.worldX, p.worldY);
      return;
    }
    this.dragStart = { x: p.worldX, y: p.worldY };
    this.dragging = false;
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (!this.dragStart) return;
    const dx = p.worldX - this.dragStart.x;
    const dy = p.worldY - this.dragStart.y;
    if (Math.hypot(dx, dy) > 18) {
      this.selectBox.setVisible(false);
      this.selectInRect(this.dragStart.x, this.dragStart.y, p.worldX, p.worldY);
    } else {
      this.selectAt(p.worldX, p.worldY);
    }
    this.dragStart = null;
    this.dragging = false;
  }

  private drawSelectBox(x1: number, y1: number, x2: number, y2: number): void {
    this.dragging = true;
    this.selectBox.clear();
    this.selectBox.lineStyle(1.5, 0x7dffb0, 0.9);
    this.selectBox.fillStyle(0x7dffb0, 0.08);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    this.selectBox.fillRect(x, y, w, h);
    this.selectBox.strokeRect(x, y, w, h);
    this.selectBox.setVisible(true);
  }

  private selectAt(wx: number, wy: number): void {
    if (!this.sim) return;
    let best: { id: number; d: number } | null = null;
    for (const u of this.sim.units) {
      if (u.dead || u.side !== 'undead') continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < u.radius + 18 && (!best || d < best.d)) best = { id: u.id, d };
    }
    if (best) {
      this.selection = [best.id];
    } else {
      this.selection = [];
    }
    this.syncSelection();
  }

  private selectInRect(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.sim) return;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    this.selection = this.sim.units.filter((u) => !u.dead && u.side === 'undead' && u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY).map((u) => u.id);
    this.syncSelection();
  }

  selectAll(): void {
    if (!this.sim) return;
    this.selection = this.sim.units.filter((u) => !u.dead && u.side === 'undead').map((u) => u.id);
    this.syncSelection();
  }

  clearSelection(): void {
    this.selection = [];
    this.syncSelection();
  }

  private syncSelection(): void {
    for (const [id, v] of this.views) v.ring.setVisible(this.selection.includes(id));
    const s = this.sim;
    let info = '';
    if (s && this.selection.length > 0) {
      const counts = new Map<string, number>();
      for (const id of this.selection) {
        const u = s.units.find((v) => v.id === id);
        if (u) counts.set(UNITS[u.type as UnitType]?.name ?? u.type, (counts.get(UNITS[u.type as UnitType]?.name ?? u.type) ?? 0) + 1);
      }
      info = Array.from(counts.entries())
        .map(([k, v]) => `${k} ×${v}`)
        .join(' · ');
    }
    this.hooks.onSelection?.(this.selection, info);
  }

  private commandAt(wx: number, wy: number): void {
    if (!this.sim || this.selection.length === 0) return;
    let unitTarget: number | undefined;
    let structTarget: string | undefined;
    for (const u of this.sim.units) {
      if (u.dead || u.side !== 'human') continue;
      if (Math.hypot(u.x - wx, u.y - wy) < u.radius + 16) {
        unitTarget = u.id;
        break;
      }
    }
    if (!unitTarget) {
      for (const s of this.sim.structures.values()) {
        if (s.destroyed || s.kind === 'nodeCamp') continue;
        if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) {
          structTarget = s.id;
          break;
        }
      }
    }
    if (unitTarget !== undefined || structTarget) {
      this.sim.focusTarget(this.selection, unitTarget, structTarget);
      this.pulseMarker(wx, wy, 0xff9a6a);
      this.hooks.onLog?.(structTarget ? '集中攻击目标' : '集火敌方单位', 'gold');
    } else {
      this.sim.setDestination(this.selection, wx, wy);
      this.pulseMarker(wx, wy, 0x7dffb0);
    }
  }

  private pulseMarker(x: number, y: number, color: number): void {
    const g = this.add.image(x, y, 'fx:select').setDepth(y + 40).setTint(color).setAlpha(0.95).setScale(0.6);
    this.tweens.add({ targets: g, scale: 1.4, alpha: 0, duration: 620, onComplete: () => g.destroy() });
  }

  /* ---------------- 部署 ---------------- */

  setDeployType(type: UnitType | null): void {
    this.deployType = type;
    if (!type) {
      this.ghost.clear();
      this.updateZoneHighlight();
      return;
    }
    const def = UNITS[type];
    this.hooks.onLog?.(`部署模式：${def.name}（每次 ${def.batch}）— 左键在幽绿区域投放，右键/ESC 取消`, 'gold');
    this.updateZoneHighlight();
  }

  private updateZoneHighlight(): void {
    this.zoneGraphics.clear();
    if (!this.deployType || !this.sim) return;
    const zones: { x: number; y: number; r: number; active: boolean }[] = [{ x: ZONES.throne.x * 32, y: ZONES.throne.y * 32, r: ZONES.throne.r, active: true }];
    for (const t of this.state.territories) {
      if (t.owner === 'undead' && t.activeForDeploy) zones.push({ x: ZONES[t.id].x * 32, y: ZONES[t.id].y * 32, r: ZONES[t.id].r, active: true });
    }
    for (const z of zones) {
      this.zoneGraphics.lineStyle(2, 0x7dffb0, 0.55);
      this.zoneGraphics.strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.5);
      this.zoneGraphics.lineStyle(1, 0x7dffb0, 0.2);
      this.zoneGraphics.strokeEllipse(z.x, z.y, z.r * 2 - 12, z.r * 1.5 - 12);
      this.zoneGraphics.fillStyle(0x7dffb0, 0.05);
      this.zoneGraphics.fillEllipse(z.x, z.y, z.r * 2, z.r * 1.5);
    }
  }

  private drawGhost(wx: number, wy: number): void {
    if (!this.sim || !this.deployType) return;
    const check = this.sim.canDeploy(this.deployType, wx, wy);
    const color = check.ok ? 0x7dffb0 : 0xe8694f;
    this.ghost.clear();
    this.ghost.lineStyle(2, color, 0.9);
    this.ghost.strokeCircle(wx, wy, 26);
    this.ghost.lineStyle(1, color, 0.4);
    this.ghost.strokeCircle(wx, wy, 34);
    this.ghost.fillStyle(color, 0.12);
    this.ghost.fillCircle(wx, wy, 26);
  }

  private tryDeploy(wx: number, wy: number): void {
    if (!this.sim || !this.deployType) return;
    const res = this.sim.deploy(this.deployType, wx, wy);
    this.hooks.onDeploy?.(res.ok, res.message ?? '', res.count);
    if (res.ok) {
      this.pulseMarker(wx, wy, 0x7dffb0);
      this.hooks.onLog?.(`投放 ${UNITS[this.deployType].name} ×${res.count}`, 'good');
    }
  }

  /* ---------------- 相机 ---------------- */

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const speed = 900 * (1 / cam.zoom) * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.A?.isDown) dx -= 1;
    if (this.keys.D?.isDown) dx += 1;
    if (this.keys.W?.isDown) dy -= 1;
    if (this.keys.S?.isDown) dy += 1;
    cam.scrollX += dx * speed;
    cam.scrollY += dy * speed;
  }

  /* ---------------- 战斗循环 ---------------- */

  override update(_time: number, delta: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.05, delta / 1000);
    this.updateCamera(dt);

    if (this.mode === 'battle' && this.sim) {
      if (!this.paused) {
        this.acc += dt * this.speed;
        let steps = 0;
        while (this.acc >= 1 / 30 && steps < 6) {
          this.sim.update(1 / 30);
          this.acc -= 1 / 30;
          steps++;
        }
        if (this.acc > 1) this.acc = 0;
      }
      this.processEvents();
      this.syncUnits(dt);
      this.damageTimer += dt;
      if (this.damageTimer > 0.35) {
        this.damageTimer = 0;
        this.refreshDamageVisuals();
      }
      this.statTimer += dt;
      if (this.statTimer > 0.25) {
        this.statTimer = 0;
        const cmd = this.sim.commandInfo();
        this.hooks.onStats?.({
          fps: Math.round(this.game.loop.actualFps),
          units: this.sim.units.length,
          time: this.sim.timeLimit - this.sim.elapsed,
          commandUsed: cmd.used,
          commandCap: cmd.cap,
          alive: this.sim.aliveUndead(),
        });
      }
      if (this.sim.outcome !== 'ongoing' && !this.battleEnded) {
        this.battleEnded = true;
        this.hooks.onBattleEnd?.();
      }
    }
  }

  private processEvents(): void {
    if (!this.sim) return;
    const events = this.sim.events;
    for (const e of events) this.renderEvent(e);
    events.length = 0;
  }

  private renderEvent(e: SimEvent): void {
    switch (e.t) {
      case 'hit': {
        if (e.kind === 'wall') {
          const p = this.add.image(e.x, e.y, 'fx:debris').setDepth(e.y + 30).setScale(0.8);
          this.tweens.add({ targets: p, y: e.y + 18, alpha: 0, angle: 120, duration: 380, onComplete: () => p.destroy() });
        } else {
          const p = this.add.image(e.x + Phaser.Math.Between(-6, 6), e.y, 'fx:blood').setDepth(e.y + 30).setAlpha(0.9);
          this.tweens.add({ targets: p, y: e.y + 8, alpha: 0, scale: 1.3, duration: 320, onComplete: () => p.destroy() });
        }
        break;
      }
      case 'shot': {
        const color = e.kind === 'cannon' ? 0xffb054 : e.kind === 'holy' ? 0xfff3c4 : 0xffd27a;
        const line = this.add.line(0, 0, e.x0, e.y0, e.x1, e.y1, color, 0.85).setOrigin(0, 0).setDepth(8000);
        line.setLineWidth(e.kind === 'cannon' ? 2 : 1);
        this.tweens.add({ targets: line, alpha: 0, duration: e.kind === 'cannon' ? 160 : 90, onComplete: () => line.destroy() });
        if (e.kind === 'mg') {
          const m = this.add.image(e.x0, e.y0, 'fx:muzzle').setDepth(8001).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: m, alpha: 0, duration: 90, onComplete: () => m.destroy() });
        }
        if (e.kind === 'cannon') {
          const shell = this.add.image(e.x0, e.y0, 'fx:shell').setDepth(8002);
          this.tweens.add({ targets: shell, x: e.x1, y: e.y1, duration: 260, ease: 'Linear', onComplete: () => shell.destroy() });
        }
        break;
      }
      case 'blast': {
        for (let i = 0; i < 3; i++) {
          const s = this.add.image(e.x, e.y, `fx:blast:${i}`).setDepth(e.y + 40).setBlendMode(Phaser.BlendModes.ADD);
          s.setScale(0.5 + i * 0.4);
          this.tweens.add({ targets: s, scale: 1.6 + i * 0.5, alpha: 0, duration: 420 + i * 120, onComplete: () => s.destroy() });
        }
        this.cameras.main.shake(140, 0.0035);
        break;
      }
      case 'death': {
        const p = this.add.image(e.x, e.y - 18, `unit:${e.art}:death:2`).setDepth(e.y + 20).setAlpha(0.85).setScale(e.side === 'human' ? 0.9 : 1);
        this.tweens.add({ targets: p, y: e.y - 60, alpha: 0, duration: 900, onComplete: () => p.destroy() });
        break;
      }
      case 'wallBreak': {
        this.cameras.main.shake(260, 0.008);
        for (let i = 0; i < 10; i++) {
          const d = this.add.image(e.x + Phaser.Math.Between(-40, 40), e.y + Phaser.Math.Between(-16, 16), 'fx:debris').setDepth(e.y + 40);
          this.tweens.add({
            targets: d,
            x: d.x + Phaser.Math.Between(-60, 60),
            y: d.y + Phaser.Math.Between(20, 70),
            alpha: 0,
            angle: Phaser.Math.Between(0, 360),
            duration: 700,
            onComplete: () => d.destroy(),
          });
        }
        this.hooks.onLog?.(`${e.name} 被摧毁，出现缺口！`, 'good');
        break;
      }
      case 'structureDown': {
        this.cameras.main.shake(200, 0.006);
        this.hooks.onLog?.(`${e.name} 被摧毁`, e.kind === 'facility' ? 'good' : 'gold');
        break;
      }
      case 'capture': {
        this.hooks.onLog?.(`占领 ${e.name}！明日可从该方向出兵`, 'good');
        this.pulseMarker(e.node === 'center' ? 80 * 32 : e.node === 'west' ? 30 * 32 : 128 * 32, e.node === 'center' ? 90 * 32 : 68 * 32, 0x7dffb0);
        break;
      }
      case 'notice': {
        this.hooks.onLog?.(e.text, 'gold');
        break;
      }
    }
  }

  /** 依据战役状态刷新墙与设施的损伤表现 */
  private refreshDamageVisuals(): void {
    for (const w of this.state.walls) {
      const sprite = this.wallSprites.get(w.id);
      if (!sprite) continue;
      if (w.destroyed) {
        sprite.destroy();
        this.wallSprites.delete(w.id);
        const crack = this.wallCracks.get(w.id);
        crack?.destroy();
        this.wallCracks.delete(w.id);
        this.spawnRubbleLine(w.x, w.y, w.len, w.dir);
        continue;
      }
      const ratio = w.hp / w.maxHp;
      sprite.setTint(ratio > 0.66 ? 0xffffff : ratio > 0.33 ? 0xd9c9b2 : 0x9c8a75);
      const crack = this.wallCracks.get(w.id);
      if (crack) {
        crack.setVisible(ratio < 0.66);
        crack.setAlpha(ratio < 0.33 ? 1 : 0.5);
      }
    }
    for (const f of this.state.human) {
      if (f.kind === 'tower' || f.kind === 'lighthouse') continue;
      const sprite = this.facilitySprites.get(f.id);
      if (!sprite) continue;
      if (f.destroyed) {
        sprite.setTint(0x2a2a24).setAlpha(0.45);
        continue;
      }
      const ratio = f.hp / f.maxHp;
      sprite.setTint(ratio > 0.6 ? 0xffffff : ratio > 0.3 ? 0xc8bda8 : 0x8e8272);
    }
  }

  private syncUnits(dt: number): void {
    if (!this.sim) return;
    const alive = new Set<number>();
    for (const u of this.sim.units) {
      alive.add(u.id);
      let view = this.views.get(u.id);
      if (!view) {
        const sprite = this.add.sprite(u.x, u.y, `unit:${u.art}:idle:0`).setOrigin(0.5, 1);
        sprite.setDepth(Math.round(u.y));
        const ring = this.add.image(u.x, u.y, 'fx:select').setDepth(Math.round(u.y) - 1).setVisible(false).setTint(0x7dffb0);
        ring.setScale(Math.max(0.5, u.radius / 22));
        const hpBar = this.add.graphics().setDepth(Math.round(u.y) + 1);
        view = { sprite, ring, pose: 'idle', dead: false, hpBar };
        this.views.set(u.id, view);
      }
      const v = view;
      v.sprite.x = u.x;
      v.sprite.y = u.y;
      v.sprite.setDepth(Math.round(u.y));
      v.ring.x = u.x;
      v.ring.y = u.y + 2;
      v.ring.setDepth(Math.round(u.y) - 1);

      if (u.dead) {
        if (!v.dead) {
          v.dead = true;
          v.sprite.play(animKey(u.art, 'death'), true);
          v.ring.setVisible(false);
          v.hpBar.clear();
        }
        v.sprite.setAlpha(Math.max(0, Math.min(1, u.deathT / 1.2)));
        continue;
      }
      const pose = u.hitFlash > 0 ? 'hit' : u.attackAnim > 0 ? 'attack' : u.moving ? 'walk' : 'idle';
      if (v.pose !== pose) {
        v.pose = pose;
        v.sprite.play(animKey(u.art, pose), true);
      }
      v.sprite.setFlipX(u.facing < 0 && u.side === 'undead');
      v.sprite.setTint(u.hitFlash > 0 ? 0xffd0d0 : 0xffffff);
      v.sprite.setAlpha(u.spawnT > 0 ? 0.4 : 1);
      const showHp = u.type === 'boss' || u.type === 'lord';
      v.hpBar.clear();
      if (showHp) {
        const w = u.radius * 2.4;
        const yy = u.y - (u.art === 'boss' ? 106 : 84);
        v.hpBar.fillStyle(0x0a0d0b, 0.85);
        v.hpBar.fillRect(u.x - w / 2, yy, w, 5);
        v.hpBar.fillStyle(u.side === 'undead' ? 0x7dffb0 : 0xe8c46a, 0.95);
        v.hpBar.fillRect(u.x - w / 2 + 1, yy + 1, (w - 2) * Math.max(0, u.hp / u.maxHp), 3);
      }
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        v.sprite.destroy();
        v.ring.destroy();
        v.hpBar.destroy();
        this.views.delete(id);
        this.selection = this.selection.filter((s) => s !== id);
      }
    }
    void dt;
  }

  /* ---------------- 外部控制 ---------------- */

  centerOn(x: number, y: number): void {
    this.cameras.main.centerOn(x, y);
  }

  centerOnThrone(): void {
    this.cameras.main.pan(80 * 32, 100 * 32, 420, 'Sine.easeInOut');
  }

  focusAlive(): void {
    if (!this.sim) return;
    const alive = this.sim.units.filter((u) => !u.dead && u.side === 'undead');
    if (alive.length === 0) return;
    let sx = 0;
    let sy = 0;
    for (const u of alive) {
      sx += u.x;
      sy += u.y;
    }
    this.cameras.main.pan(sx / alive.length, sy / alive.length, 380, 'Sine.easeInOut');
  }

  setSpeed(s: number): void {
    this.speed = s;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  /** 调试/自动化：同步快进模拟（不依赖浏览器帧率），随后渲染层会同步一次 */
  advanceFor(seconds: number): void {
    if (!this.sim) return;
    const steps = Math.min(6000, Math.round(seconds * 30));
    for (let i = 0; i < steps; i++) this.sim.update(1 / 30);
    this.processEvents();
    this.syncUnits(0);
  }

  getMinimap(): {
    units: { x: number; y: number; side: string; art: string }[];
    structures: { x: number; y: number; w: number; h: number; destroyed: boolean; kind: string }[];
    walls: { x: number; y: number; w: number; h: number; destroyed: boolean }[];
    nodes: { x: number; y: number; owner: string }[];
  } {
    const units = (this.sim?.units ?? []).filter((u) => !u.dead).map((u) => ({ x: u.x, y: u.y, side: u.side, art: u.art }));
    const structures: { x: number; y: number; w: number; h: number; destroyed: boolean; kind: string }[] = [];
    const walls: { x: number; y: number; w: number; h: number; destroyed: boolean }[] = [];
    if (this.sim) {
      for (const s of this.sim.structures.values()) {
        if (s.kind === 'nodeCamp') continue;
        if (s.wallId) walls.push({ x: s.x, y: s.y, w: s.w, h: s.h, destroyed: s.destroyed });
        else structures.push({ x: s.x, y: s.y, w: s.w, h: s.h, destroyed: s.destroyed, kind: s.facilityKind ?? s.kind });
      }
    }
    const nodes = NODES.map((n) => ({ x: n.x * 32, y: n.y * 32, owner: this.state.territories.find((t) => t.id === n.id)?.owner ?? 'human' }));
    return { units, structures, walls, nodes };
  }

  destroyScene(): void {
    this.views.clear();
    this.scene.stop();
  }
}
