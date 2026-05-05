# Mobile Form Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all mobile business-page forms out of inline entry points into reusable bottom-sheet, drawer, or dialog layers.

**Architecture:** Add one shared `TaskSheet` component built on React Native `Modal`, then update bills, apartments, and rooms screens to open forms through explicit layer state. Business screens keep their existing form state, submit handlers, API calls, and notices.

**Tech Stack:** React Native, Expo, TypeScript, existing `StyleSheet` styles, `pnpm --filter @tenant-hub/mobile typecheck`.

---

## Files

- Create: `apps/mobile/src/components/TaskSheet.tsx` for the shared form layer.
- Modify: `apps/mobile/src/theme/styles.ts` for sheet, drawer, dialog, and footer styles.
- Modify: `apps/mobile/src/screens/bills/BillsScreen.tsx` to move payment and meter forms into `TaskSheet`.
- Modify: `apps/mobile/src/screens/apartments/ApartmentsScreen.tsx` to move expense, fee, room, batch room, edit room, and delete confirmation forms into `TaskSheet`.
- Modify: `apps/mobile/src/screens/rooms/RoomsScreen.tsx` to move inline room edit into `TaskSheet`.

## Task 1: Shared TaskSheet Container

- [ ] **Step 1: Add the shared component**

Create `apps/mobile/src/components/TaskSheet.tsx` with:

```tsx
import type { ReactNode } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../theme/styles";

export type TaskSheetVariant = "bottom" | "drawer" | "dialog";

type Props = {
  visible: boolean;
  variant?: TaskSheetVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function TaskSheet({ visible, variant = "bottom", title, subtitle, onClose, children, footer }: Props) {
  const isDialog = variant === "dialog";
  return (
    <Modal visible={visible} transparent animationType={isDialog ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={[styles.taskSheetOverlay, styles[`taskSheetOverlay_${variant}`]]}>
        <View style={[styles.taskSheetCard, styles[`taskSheetCard_${variant}`]]}>
          <View style={styles.sectionHeader}>
            <View style={styles.taskSheetTitleBlock}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={styles.smallButton} onPress={onClose}>
              <Text style={styles.smallButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.taskSheetContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.taskSheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Add supporting styles**

Add these styles to `apps/mobile/src/theme/styles.ts` inside `StyleSheet.create`:

```ts
taskSheetOverlay: { flex: 1, backgroundColor: "rgba(16, 37, 34, 0.42)" },
taskSheetOverlay_bottom: { justifyContent: "flex-end" },
taskSheetOverlay_drawer: { justifyContent: "flex-end" },
taskSheetOverlay_dialog: { justifyContent: "center", padding: 18 },
taskSheetCard: { backgroundColor: "white", gap: 10, padding: 14 },
taskSheetCard_bottom: { maxHeight: "78%", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
taskSheetCard_drawer: { maxHeight: "90%", minHeight: "62%", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
taskSheetCard_dialog: { maxHeight: "78%", borderRadius: 8 },
taskSheetTitleBlock: { flex: 1, gap: 2 },
taskSheetContent: { gap: 10, paddingBottom: 2 },
taskSheetFooter: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#eee8da" }
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @tenant-hub/mobile typecheck`

Expected: TypeScript may fail until screens use the component, but `TaskSheet.tsx` itself should have no syntax errors.

## Task 2: Bills Forms

- [ ] **Step 1: Update imports and layer state**

In `apps/mobile/src/screens/bills/BillsScreen.tsx`, import `TaskSheet` and add:

```ts
type BillLayer = "payment" | "reading";
const [activeLayer, setActiveLayer] = useState<BillLayer>();
const unpaidBills = useMemo(() => monthlyBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID"), [monthlyBills]);
```

- [ ] **Step 2: Replace inline payment and reading panels**

Remove the always-visible `登记收款` panel and `录入读数` panel. Add action buttons in each tab header panel:

```tsx
{tab === "monthly" ? (
  <TouchableOpacity style={styles.button} onPress={() => setActiveLayer("payment")}>
    <Text style={styles.buttonText}>登记收款</Text>
  </TouchableOpacity>
) : null}
{tab === "meter" ? (
  <TouchableOpacity style={styles.button} onPress={() => setActiveLayer("reading")}>
    <Text style={styles.buttonText}>录入读数</Text>
  </TouchableOpacity>
) : null}
```

- [ ] **Step 3: Add TaskSheet forms**

Append two `TaskSheet` components before the final fragment close. Payment uses `variant="bottom"` and reading uses `variant="drawer"`. Use the existing field markup and existing `submitPayment` / `submitReading` handlers.

- [ ] **Step 4: Close sheets on successful submit**

After successful payment submit, call `setActiveLayer(undefined)`. After successful reading submit, call `setActiveLayer(undefined)`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @tenant-hub/mobile typecheck`

Expected: pass or fail only on unrelated pre-existing errors.

## Task 3: Apartment Forms

- [ ] **Step 1: Update imports and layer state**

In `apps/mobile/src/screens/apartments/ApartmentsScreen.tsx`, import `TaskSheet` and `ScrollView` if needed. Replace boolean form-open state with:

```ts
type ApartmentLayer = "expense" | "fee" | "roomSingle" | "roomBatch" | "roomEdit" | "roomDelete";
const [activeLayer, setActiveLayer] = useState<ApartmentLayer>();
const [expenseApartmentId, setExpenseApartmentId] = useState<string>();
```

Keep form state objects unchanged.

- [ ] **Step 2: Convert expense actions**

The apartment list and detail `记录花费` buttons should set `expenseApartmentId` and `activeLayer` to `"expense"`. Remove inline expense form rendering from cards and detail panels.

- [ ] **Step 3: Convert fee action**

The edit page `添加费用项` button should set `activeLayer` to `"fee"`. Remove inline fee form rendering from the edit page.

- [ ] **Step 4: Convert room actions**

`新增房间`, `批量添加`, and room `编辑` buttons should set `activeLayer` to `"roomSingle"`, `"roomBatch"`, or `"roomEdit"` and initialize relevant form state. Delete should set `activeLayer` to `"roomDelete"` and `deleteRoomId`.

- [ ] **Step 5: Add TaskSheet forms**

Append `TaskSheet` components for expense, fee, single room, batch room, edit room, and delete confirmation. Reuse `renderRoomFields`, existing `addExpense`, `addFee`, `createRoom`, `addBatchRooms`, `updateRoom`, and `deleteRoom`.

- [ ] **Step 6: Close layers on successful submit**

Update submit helpers to clear `activeLayer` and relevant ids after successful completion.

- [ ] **Step 7: Run typecheck**

Run: `pnpm --filter @tenant-hub/mobile typecheck`

Expected: pass or fail only on unrelated pre-existing errors.

## Task 4: Rooms Inline Edit

- [ ] **Step 1: Replace inline edit state**

In `apps/mobile/src/screens/rooms/RoomsScreen.tsx`, replace `activeRoomForm` with an edit sheet state:

```ts
const [editingRoomId, setEditingRoomId] = useState<string>();
const editingRoom = useMemo(() => rooms.find((item) => item.id === editingRoomId), [rooms, editingRoomId]);
```

- [ ] **Step 2: Convert edit button**

The `编辑房间` button should set `editingRoomId` to the expanded room id and populate `roomForm`. Remove inline edit form rendering from the card.

- [ ] **Step 3: Add TaskSheet drawer**

Append one `TaskSheet variant="drawer"` for editing the room. Reuse the existing fields and `updateRoom` handler.

- [ ] **Step 4: Close drawer on successful submit**

After successful `updateRoom`, call `setEditingRoomId(undefined)`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @tenant-hub/mobile typecheck`

Expected: pass.

## Task 5: Verification

- [ ] **Step 1: Scan for inline form toggles**

Run:

```bash
rg -n "FormOpen|roomFormMode|activeRoomForm|收起|isRecordingExpense|feeFormOpen|listExpenseApartmentId" apps/mobile/src/screens
```

Expected: no remaining matches for removed inline form state. Matches for unrelated auth/settings are acceptable only if they are not business-page entry forms.

- [ ] **Step 2: Run full mobile typecheck**

Run: `pnpm --filter @tenant-hub/mobile typecheck`

Expected: pass.

- [ ] **Step 3: Manual web check**

Run: `pnpm --filter @tenant-hub/mobile web` and open the printed Expo web URL. Check bills, apartments, and rooms entry points open sheets/drawers/dialogs instead of expanding forms inline.
