import type { TabKey } from "../types/navigation";

export const tabItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "首页", icon: "🏠" },
  { key: "rooms", label: "房间", icon: "🛏️" },
  { key: "bills", label: "账单", icon: "💰" },
  { key: "apartments", label: "公寓", icon: "🏢" },
  { key: "settings", label: "更多", icon: "⚙️" }
];
