import type { TabKey } from "../types/navigation";

export type BillTabKey = "monthly" | "meter" | "review";
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
  icon: string;
  intent: HomeNavigationIntent;
};

export const homeQuickActions: HomeQuickAction[] = [
  {
    key: "payment",
    title: "登记收款",
    icon: "收",
    intent: { tab: "bills", billsTab: "monthly", billsAction: "payment" }
  },
  {
    key: "lease",
    title: "签约入住",
    icon: "签",
    intent: { tab: "rooms", roomsAction: "lease" }
  },
  {
    key: "meter",
    title: "抄表",
    icon: "表",
    intent: { tab: "bills", billsTab: "meter" }
  }
];
