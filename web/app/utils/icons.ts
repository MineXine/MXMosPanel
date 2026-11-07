/** 视图图标映射：兼容早期以英文名保存的图标 */
const VIEW_ICON_MAP: Record<string, string> = {
  inbox: '📥',
  lock: '🔒',
  globe: '🌐',
  'map-pin': '📍',
  archive: '📦',
  map: '🗺️',
  star: '⭐',
  bookmark: '🔖',
  bulb: '💡',
  fire: '🔥',
  calendar: '🗓️',
};

export function resolveIcon(icon?: string): string {
  if (!icon) return '📥';
  return VIEW_ICON_MAP[icon] ?? icon;
}
