import type { MenuItemConfig } from './menuConfig';

export function flattenMenu(configs: MenuItemConfig[]): MenuItemConfig[] {
  return configs.flatMap((item) => [...(item.children || []), item]);
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

  // 优先匹配最长路径，确保子菜单项优先于父级分组
  const prefixMatches = all
    .filter((item) => pathname.startsWith(item.path + '/'))
    .sort((a, b) => b.path.length - a.path.length);
  if (prefixMatches.length > 0) return prefixMatches[0].key;

  return 'dashboard';
}

export function getLabelFromKey(
  configs: MenuItemConfig[],
  key: string
): string {
  return flattenMenu(configs).find((item) => item.key === key)?.label ?? '';
}

export function getParentKeys(
  configs: MenuItemConfig[],
  targetKey: string
): string[] {
  const result: string[] = [];

  function walk(items: MenuItemConfig[], parents: string[]): boolean {
    for (const item of items) {
      if (item.key === targetKey) {
        result.push(...parents);
        return true;
      }
      if (item.children) {
        const found = walk(item.children, [...parents, item.key]);
        if (found) return true;
      }
    }
    return false;
  }

  walk(configs, []);
  return result;
}
