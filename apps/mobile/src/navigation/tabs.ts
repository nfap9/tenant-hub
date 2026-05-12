import type { IconName } from '../components/ui/Icon';
import type { TabKey } from '../types/navigation';

export const tabItems: Array<{ key: TabKey; label: string; icon: IconName; iconActive: IconName }> =
  [
    { key: 'home', label: '首页', icon: 'home-outline', iconActive: 'home' },
    { key: 'rooms', label: '房间', icon: 'bed-outline', iconActive: 'bed' },
    { key: 'bills', label: '账单', icon: 'wallet-outline', iconActive: 'wallet' },
    { key: 'apartments', label: '公寓', icon: 'business-outline', iconActive: 'business' },
    { key: 'settings', label: '更多', icon: 'grid-outline', iconActive: 'grid' },
  ];
