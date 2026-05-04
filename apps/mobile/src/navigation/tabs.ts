import type { TabKey } from "../types/navigation";

export const tabItems: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "首页" },
  { key: "rooms", label: "房间" },
  { key: "bills", label: "账单" },
  { key: "apartments", label: "公寓" },
  { key: "settings", label: "设置" }
];
