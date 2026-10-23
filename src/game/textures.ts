import type Phaser from 'phaser';
import { buildFacilityCanvases, buildGateCanvas, buildWallTile } from '../art/buildings';
import { buildFxCanvases } from '../art/fx';
import { buildDecorCanvases, buildTileset } from '../art/tiles';
import { UNIT_FRAMES, buildUnitCanvases, type PoseKind, type UnitArtType } from '../art/units';

const UNIT_TYPES: UnitArtType[] = ['zombie', 'runner', 'brute', 'spider', 'boss', 'lord', 'infantry', 'gunner', 'sniper', 'paladin'];

const FRAME_RATE: Record<PoseKind, number> = { idle: 2, walk: 9, attack: 9, hit: 10, death: 7 };

export function registerAllTextures(scene: Phaser.Scene): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
  };

  add('tileset', buildTileset());
  for (const [k, c] of buildUnitCanvases()) add(k, c);
  for (const [k, c] of buildDecorCanvases()) add(k, c);
  for (const [k, c] of buildFacilityCanvases()) add(k, c);
  for (const [k, c] of buildFxCanvases()) add(k, c);
  add('wall-h', buildWallTile(false));
  add('wall-v', buildWallTile(true));
  add('gate', buildGateCanvas(12 * 32));

  // 动画
  for (const type of UNIT_TYPES) {
    for (const pose of Object.keys(UNIT_FRAMES) as PoseKind[]) {
      const key = `anim:${type}:${pose}`;
      if (scene.anims.exists(key)) continue;
      const frames = [];
      for (let i = 0; i < UNIT_FRAMES[pose]; i++) frames.push({ key: `unit:${type}:${pose}:${i}` });
      scene.anims.create({
        key,
        frames,
        frameRate: FRAME_RATE[pose],
        repeat: pose === 'idle' || pose === 'walk' ? -1 : 0,
      });
    }
  }
}

export function animKey(art: string, pose: PoseKind): string {
  return `anim:${art}:${pose}`;
}
