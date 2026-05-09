import type { IconName } from "../components/ui/Icon";
import type { TabKey } from "../types/navigation";

export type BillTabKey = "unpaid" | "pending" | "all";
export type BillActionKey = "payment";
export type RoomActionKey = "lease";

export type HomeNavigationIntent = {
  tab: TabKey;
  billsTab?: BillTabKey;
  billsAction?: BillActionKey;
  roomsAction?: RoomActionKey;
};

export type HomeQuickAction = {
  key: string;
  title: string;
  icon: IconName;
  intent: HomeNavigationIntent;
};

export const homeQuickActions: HomeQuickAction[] = [
  {
    key: "payment",
    title: "登记收款",
    icon: "cash-outline",
    intent: { tab: "bills", billsTab: "unpaid", billsAction: "payment" }
  },
  {
    key: "lease",
    title: "签约入住",
    icon: "create-outline",
    intent: { tab: "rooms", roomsAction: "lease" }
  },
  {
    key: "meter",
    title: "抄表",
    icon: "speedometer-outline",
    intent: { tab: "bills", billsTab: "pending" }
  }
];
