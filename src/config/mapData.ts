import { T } from '../art/tiles';

export const MAP_W = 160;
export const MAP_H = 112;
export const TILE_SIZE = 32;

export type NodeId = 'west' | 'east' | 'center';

export interface WallDef {
  id: string;
  x: number;
  y: number;
  len: number;
  dir: 'h' | 'v';
  kind: 'outer' | 'gate' | 'inner' | 'innerGate';
  hp: number;
}

export interface FacilityDef {
  id: string;
  kind: 'lighthouse' | 'barracks' | 'arsenal' | 'power' | 'research' | 'medical';
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

export interface TowerDef {
  id: string;
  kind: 'mg' | 'cannon' | 'aa' | 'holy';
  x: number;
  y: number;
  hp: number;
}

export interface NodeDef {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  radius: number;
  guards: number;
  reward: { corpses: number; essence: number };
}

export interface SlotDef {
  id: string;
  x: number;
  y: number;
  zone: 'rear' | NodeId;
}

/** 结界：外墙以内为外城区，内墙以内为内城 */
export const OUTER_BOUNDS = { x1: 44, y1: 28, x2: 118, y2: 84 };
export const INNER_BOUNDS = { x1: 68, y1: 30, x2: 100, y2: 56 };

export const THRONE = { x: 80, y: 103 };
export const LIGHTHOUSE = { x: 84, y: 40 };

export const WALLS: WallDef[] = [
  // 外墙 · 南
  { id: 'ow-s1', x: 44, y: 84, len: 30, dir: 'h', kind: 'outer', hp: 1400 },
  { id: 'ow-gate', x: 74, y: 84, len: 12, dir: 'h', kind: 'gate', hp: 2600 },
  { id: 'ow-s2', x: 86, y: 84, len: 32, dir: 'h', kind: 'outer', hp: 1400 },
  // 外墙 · 西 / 西北
  { id: 'ow-w1', x: 44, y: 44, len: 41, dir: 'v', kind: 'outer', hp: 1400 },
  { id: 'ow-nw', x: 45, y: 44, len: 11, dir: 'h', kind: 'outer', hp: 1400 },
  { id: 'ow-w2', x: 56, y: 28, len: 16, dir: 'v', kind: 'outer', hp: 1400 },
  // 外墙 · 北
  { id: 'ow-n', x: 56, y: 28, len: 48, dir: 'h', kind: 'outer', hp: 1400 },
  // 外墙 · 东 / 东北
  { id: 'ow-e2', x: 104, y: 28, len: 16, dir: 'v', kind: 'outer', hp: 1400 },
  { id: 'ow-ne', x: 104, y: 44, len: 14, dir: 'h', kind: 'outer', hp: 1400 },
  { id: 'ow-e1', x: 118, y: 44, len: 41, dir: 'v', kind: 'outer', hp: 1400 },
  // 内墙
  { id: 'iw-s1', x: 68, y: 56, len: 12, dir: 'h', kind: 'inner', hp: 1800 },
  { id: 'iw-gate', x: 80, y: 56, len: 8, dir: 'h', kind: 'innerGate', hp: 2200 },
  { id: 'iw-s2', x: 88, y: 56, len: 13, dir: 'h', kind: 'inner', hp: 1800 },
  { id: 'iw-w', x: 68, y: 30, len: 26, dir: 'v', kind: 'inner', hp: 1800 },
  { id: 'iw-e', x: 100, y: 30, len: 26, dir: 'v', kind: 'inner', hp: 1800 },
  { id: 'iw-n', x: 68, y: 30, len: 33, dir: 'h', kind: 'inner', hp: 1800 },
];

export const FACILITIES: FacilityDef[] = [
  { id: 'lighthouse', kind: 'lighthouse', name: '中央灯塔', x: 84, y: 40, w: 3, h: 3, hp: 6000 },
  { id: 'barracksA', kind: 'barracks', name: '西军营', x: 60, y: 70, w: 3, h: 2, hp: 1500 },
  { id: 'barracksB', kind: 'barracks', name: '东军营', x: 104, y: 70, w: 3, h: 2, hp: 1500 },
  { id: 'arsenal', kind: 'arsenal', name: '兵工厂', x: 58, y: 50, w: 3, h: 2, hp: 1700 },
  { id: 'powerA', kind: 'power', name: '能源站 · 甲', x: 60, y: 38, w: 2, h: 2, hp: 1900 },
  { id: 'powerB', kind: 'power', name: '能源站 · 乙', x: 108, y: 50, w: 2, h: 2, hp: 1900 },
  { id: 'research', kind: 'research', name: '研究所', x: 94, y: 62, w: 3, h: 2, hp: 1400 },
  { id: 'medical', kind: 'medical', name: '医疗中心', x: 71, y: 64, w: 2, h: 2, hp: 1200 },
];

export const TOWERS: TowerDef[] = [
  { id: 'tw-mg-1', kind: 'mg', x: 72, y: 78, hp: 800 },
  { id: 'tw-mg-2', kind: 'mg', x: 88, y: 78, hp: 800 },
  { id: 'tw-cannon-1', kind: 'cannon', x: 64, y: 74, hp: 950 },
  { id: 'tw-mg-3', kind: 'mg', x: 50, y: 64, hp: 800 },
  { id: 'tw-cannon-2', kind: 'cannon', x: 112, y: 64, hp: 950 },
  { id: 'tw-mg-4', kind: 'mg', x: 110, y: 44, hp: 800 },
  { id: 'tw-aa-1', kind: 'aa', x: 94, y: 34, hp: 700 },
  { id: 'tw-holy-1', kind: 'holy', x: 76, y: 34, hp: 1100 },
];

export const NODES: NodeDef[] = [
  { id: 'west', name: '西侧哨站', x: 30, y: 68, radius: 5, guards: 4, reward: { corpses: 40, essence: 3 } },
  { id: 'east', name: '东侧补给站', x: 128, y: 68, radius: 5, guards: 4, reward: { corpses: 40, essence: 3 } },
  { id: 'center', name: '城门前哨', x: 80, y: 90, radius: 5, guards: 3, reward: { corpses: 30, essence: 2 } },
];

export const SLOTS: SlotDef[] = [
  { id: 'slot-r1', x: 64, y: 102, zone: 'rear' },
  { id: 'slot-r2', x: 96, y: 102, zone: 'rear' },
  { id: 'slot-r3', x: 80, y: 96, zone: 'rear' },
  { id: 'slot-w1', x: 30, y: 74, zone: 'west' },
  { id: 'slot-e1', x: 128, y: 74, zone: 'east' },
  { id: 'slot-c1', x: 86, y: 92, zone: 'center' },
];

/** 部署圈：王座后方始终可用，前线需占领并激活 */
export const ZONES: Record<'throne' | NodeId, { x: number; y: number; r: number }> = {
  throne: { x: THRONE.x, y: THRONE.y, r: 330 },
  west: { x: 30, y: 68, r: 210 },
  east: { x: 128, y: 68, r: 210 },
  center: { x: 80, y: 90, r: 180 },
};

interface RoadDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
}

export const ROADS: RoadDef[] = [
  { x1: 80, y1: 110, x2: 80, y2: 84, w: 4 },
  { x1: 80, y1: 84, x2: 84, y2: 56, w: 4 },
  { x1: 84, y1: 56, x2: 84, y2: 44, w: 3 },
  { x1: 48, y1: 80, x2: 114, y2: 80, w: 3 },
  { x1: 48, y1: 48, x2: 48, y2: 80, w: 3 },
  { x1: 114, y1: 48, x2: 114, y2: 80, w: 3 },
  { x1: 80, y1: 72, x2: 60, y2: 70, w: 3 },
  { x1: 84, y1: 72, x2: 104, y2: 70, w: 3 },
  { x1: 80, y1: 60, x2: 60, y2: 40, w: 3 },
  { x1: 84, y1: 58, x2: 108, y2: 51, w: 3 },
  { x1: 30, y1: 68, x2: 44, y2: 70, w: 3 },
  { x1: 128, y1: 68, x2: 118, y2: 70, w: 3 },
  { x1: 80, y1: 90, x2: 80, y2: 84, w: 4 },
  { x1: 56, y1: 50, x2: 60, y2: 50, w: 2 },
  { x1: 94, y1: 62, x2: 94, y2: 58, w: 2 },
];

function inRect(x: number, y: number, r: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** 地形层：道路 > 广场 > 内城 > 外城 > 城郊 */
export function terrainAt(x: number, y: number): number {
  for (const r of ROADS) {
    if (distToSegment(x, y, r.x1, r.y1, r.x2, r.y2) <= r.w / 2) return T.ROAD;
  }
  if (inRect(x, y, INNER_BOUNDS)) {
    if (Math.abs(x - LIGHTHOUSE.x) < 6 && Math.abs(y - LIGHTHOUSE.y) < 6) return T.PLAZA;
    return T.CITY;
  }
  if (inRect(x, y, OUTER_BOUNDS)) {
    if (Math.hypot(x - 80, y - 86) < 4.5) return T.PLAZA;
    return T.COBBLE;
  }
  if (Math.hypot(x - 80, y - 100) < 7) return T.PLAZA;
  // 城墙外侧瓦砾带
  for (const w of WALLS) {
    const d =
      w.dir === 'h'
        ? Math.hypot(x - Math.max(w.x, Math.min(w.x + w.len, x)), y - w.y)
        : Math.hypot(x - w.x, y - Math.max(w.y, Math.min(w.y + w.len, y)));
    if (d < 2.2) return T.RUBBLE;
  }
  // 城外荒地：低频噪声形成自然斑块
  const n = (Math.sin(x * 0.21) + Math.cos(y * 0.17) + Math.sin((x + y) * 0.09)) / 3;
  const n2 = (Math.sin(x * 0.63 + 1.7) + Math.cos(y * 0.51 + 0.4)) / 2;
  // 王座前的血泥地
  if (x >= 66 && x <= 94 && y >= 94 && y <= 110 && n2 > -0.45) return T.MUD;
  if (n > 0.34) return T.GRASS;
  if (n2 > 0.72) return T.RUBBLE;
  return T.SOIL;
}

export function tileToWorld(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  return { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) };
}

export function facilityCenter(f: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: (f.x + f.w / 2) * TILE_SIZE, y: (f.y + f.h / 2) * TILE_SIZE };
}

export function innerCityAt(wx: number, wy: number): boolean {
  const t = worldToTile(wx, wy);
  return inRect(t.x, t.y, INNER_BOUNDS);
}

export function nodeById(id: NodeId): NodeDef {
  const n = NODES.find((v) => v.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}
