import type { MenuItemConfig } from './menuConfig';

export function flattenMenu(configs: MenuItemConfig[]): MenuItemConfig[] {
  return configs.flatMap((item) => [item, ...(item.children || [])]);
}

export function getKeyFromPath(
  configs: MenuItemConfig[],
  pathname: string,
  search = ''
): string {
  // 智能助手路径特殊处理：根据 conv 参数选中对应的历史对话
  if (pathname === '/agent') {
    const params = new URLSearchParams(search);
    const convId = params.get('conv');
    if (convId) return `conv_${convId}`;
    return 'agent-new';
  }

  const all = flattenMenu(configs);

  const exact = all.find((item) => item.path === pathname);
  if (exact) return exact.key;

  const prefix = all.find((item) => pathname.startsWith(item.path + '/'));
  if (prefix) return prefix.key;

  if (pathname.startsWith('/ops')) return 'ops-dashboard';

  return 'dashboard';
}

export function getPathFromKey(
  configs: MenuItemConfig[],
  key: string
): string | undefined {
  return flattenMenu(configs).find((item) => item.key === key)?.path;
}

export function getLabelFromKey(
  configs: MenuItemConfig[],
  key: string
): string {
  return flattenMenu(configs).find((item) => item.key === key)?.label ?? '';
}
