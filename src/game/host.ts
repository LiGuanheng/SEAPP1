import Phaser from 'phaser';
import type { CampaignState } from '../core/types';
import type { BattleSim } from '../battle/sim';
import { WorldScene, type SceneHooks } from './WorldScene';

export class GameHost {
  private game: Phaser.Game | null = null;
  scene: WorldScene | null = null;

  async mount(state: CampaignState, hooks: SceneHooks, mode: 'council' | 'battle' | 'demo', sim?: BattleSim): Promise<WorldScene> {
    this.destroy();
    const scene = new WorldScene(state, hooks, mode, sim);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-container',
      backgroundColor: '#070a09',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%',
      },
      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        powerPreference: 'high-performance',
      },
      audio: { noAudio: true },
      scene: [scene],
    });
    this.game = game;
    this.scene = scene;
    // 自动化截图/测试时用 ?nopause=1 保持失焦也继续推进（正常游玩仍会在失焦时暂停）
    if (new URLSearchParams(location.search).has('nopause')) {
      game.events.on(Phaser.Core.Events.BLUR, () => {
        window.setTimeout(() => game.loop.focus(), 0);
      });
    }
    // 调试钩子（仅用于开发与自动化冒烟测试）
    (window as unknown as Record<string, unknown>).__SEAPP1__ = { scene, state, game };
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const check = () => {
        if (scene.ready) done();
        else if (!settled) window.requestAnimationFrame(check);
      };
      check();
      window.setTimeout(done, 8000);
    });
    return scene;
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
    const parent = document.getElementById('game-container');
    if (parent) parent.innerHTML = '';
  }
}
