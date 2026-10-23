export type Quality = 'high' | 'low';

export interface Settings {
  muted: boolean;
  quality: Quality;
}

const KEY = 'SEAPP1.zombie-siege.settings.v1';

const DEFAULTS: Settings = { muted: false, quality: 'high' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      muted: parsed.muted === true,
      quality: parsed.quality === 'low' ? 'low' : 'high',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式下静默失败，不影响游戏 */
  }
}

export const settings: Settings = loadSettings();

export function setSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  saveSettings(settings);
}
