/**
 * 主题系统。
 *
 * 只提供明暗两档 + 一个色相（印泥）。按设计规范：同一界面只用一个强调色，
 * 表面之间只改明度不改色相，因此不再提供多色相切换。
 *
 * 主题状态写入 <html> 的 data-scheme（明暗）与 data-accent（印泥浓淡），
 * 组件内一律用 var(--xxx) 读取，实现无闪烁切换与持久化。
 */

export type ThemeScheme = 'light' | 'dark' | 'auto';

/** 印泥浓淡：同一色相的明度档位 */
export type ThemeAccent = 'cinnabar' | 'sienna' | 'umber';

export interface ThemeState {
  scheme: ThemeScheme;
  accent: ThemeAccent;
}

export const THEME_SCHEMES: Array<{ value: ThemeScheme; label: string }> = [
  { value: 'light', label: '宣纸' },
  { value: 'dark', label: '夜墨' },
  { value: 'auto', label: '跟随系统' },
];

export const THEME_ACCENTS: Array<{ value: ThemeAccent; label: string; swatch: string }> = [
  { value: 'cinnabar', label: '朱砂', swatch: '#8c4a2e' },
  { value: 'sienna', label: '赭石', swatch: '#a06a34' },
  { value: 'umber', label: '棕褐', swatch: '#6d513a' },
];

const STORAGE_KEY = 'shuoshuo.theme';

function readStored(): ThemeState {
  const fallback: ThemeState = { scheme: 'auto', accent: 'cinnabar' };
  if (import.meta.server) return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      scheme: parsed.scheme ?? fallback.scheme,
      accent: parsed.accent ?? fallback.accent,
    };
  } catch {
    return fallback;
  }
}

export function useTheme() {
  const state = useState<ThemeState>('theme', readStored);

  /** 实际生效的明暗（auto 时取系统偏好） */
  const resolvedScheme = useState<'light' | 'dark'>('theme-resolved', () => 'light');

  function systemPrefersDark(): boolean {
    if (import.meta.server) return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  function apply() {
    const scheme =
      state.value.scheme === 'auto'
        ? systemPrefersDark()
          ? 'dark'
          : 'light'
        : state.value.scheme;

    resolvedScheme.value = scheme;

    if (import.meta.client) {
      const el = document.documentElement;
      el.setAttribute('data-accent', state.value.accent);
      el.setAttribute('data-scheme', scheme);
      el.style.colorScheme = scheme;
    }
  }

  function setScheme(scheme: ThemeScheme) {
    state.value = { ...state.value, scheme };
    persist();
    apply();
  }

  function setAccent(accent: ThemeAccent) {
    state.value = { ...state.value, accent };
    persist();
    apply();
  }

  function persist() {
    if (import.meta.server) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    } catch {
      /* ignore */
    }
  }

  /** 在客户端挂载时调用，避免主题闪烁 */
  function init() {
    if (import.meta.server) return;

    // hydration 后 useState 携带的是 SSR 期间的值，需重新读取本地存储
    const stored = readStored();
    if (stored.scheme !== state.value.scheme || stored.accent !== state.value.accent) {
      state.value = stored;
    }

    apply();

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.value.scheme === 'auto') apply();
    });
  }

  return {
    state,
    resolvedScheme,
    setScheme,
    setAccent,
    init,
    isDark: computed(() => resolvedScheme.value === 'dark'),
  };
}
