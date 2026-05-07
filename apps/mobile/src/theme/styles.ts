import { Platform, StyleSheet } from "react-native";
import { colors, layout, radii, shadows, spacing, typography } from "./tokens";

export const styles = StyleSheet.create({
  // ============================================
  // Shell & layout
  // ============================================
  shell: { flex: 1, backgroundColor: colors.background },

  content: {
    padding: spacing[4],
    gap: spacing[3],
    paddingBottom: layout.contentBottomPadding
  },

  // ============================================
  // Header
  // ============================================
  header: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[3]
  },

  headerTitleBlock: { flex: 1, minWidth: 0 },

  headerTitle: { ...typography.h5, color: colors.white },

  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing[2], flexShrink: 0 },

  // ============================================
  // User pill & avatar
  // ============================================
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[1],
    paddingRight: spacing[2.5],
    borderRadius: radii.full,
    backgroundColor: "#183531"
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },

  avatarText: { color: colors.primaryDark, fontWeight: "700" },

  userPillText: { maxWidth: 112 },

  userName: { color: colors.white, fontWeight: "700" },

  userOrgName: { color: colors.accentLight, fontSize: typography.caption.fontSize, marginTop: 1 },

  // ============================================
  // User menu dropdown
  // ============================================
  userMenu: {
    position: "absolute",
    top: layout.headerHeight + spacing[1.5],
    right: spacing[3],
    zIndex: 10,
    width: 260,
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.elevated,
    gap: spacing[2]
  },

  userMenuName: { color: colors.text, ...typography.h6 },

  userMenuPhone: { color: colors.textMuted, ...typography.bodySmall },

  menuDivider: { height: 0.5, backgroundColor: colors.dividerLight, marginVertical: spacing[0.5] },

  menuLabel: { color: colors.textSecondary, ...typography.bodySmall },

  menuOrgItem: {
    padding: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[2]
  },

  menuOrgItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  menuOrgName: { color: colors.text, fontWeight: "700" },

  menuLogout: { minHeight: 36, alignItems: "center", justifyContent: "center" },

  // ============================================
  // Login
  // ============================================
  loginShell: { flex: 1, backgroundColor: colors.primaryDark },

  loginContent: { flexGrow: 1, justifyContent: "center", padding: spacing[4.5], gap: spacing[3] },

  loginContentCompact: { paddingVertical: spacing[2.5], gap: spacing[2] },

  loginHeader: { gap: spacing[1] },

  loginEyebrow: { color: colors.accent, ...typography.labelSmall },

  loginProduct: { color: colors.white, ...typography.hero },

  loginSubtitle: { color: colors.accentLight, ...typography.body },

  loginPanel: {
    padding: spacing[3.5],
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.lg,
    gap: spacing[1.5],
    ...shadows.elevated
  },

  // ============================================
  // Form elements (being migrated to <Input> / <Button>)
  // ============================================
  formTitle: { color: colors.text, ...typography.h3 },

  formSubTitle: { color: colors.textMuted, marginTop: spacing[0.5], ...typography.bodySmall },

  formMessage: {
    padding: spacing[2],
    borderRadius: radii.md,
    backgroundColor: colors.primaryLightest,
    color: colors.primary,
    ...typography.bodySmall
  },

  label: { color: colors.textSecondary, ...typography.bodySmall },

  fieldLabel: { color: colors.textMuted, ...typography.labelSmall },

  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    color: colors.text,
    backgroundColor: colors.surface,
    ...typography.body
  },

  textarea: { minHeight: 88, paddingTop: spacing[3], textAlignVertical: "top" },

  codeRow: { flexDirection: "row", gap: spacing[2] },

  codeInput: { flex: 1 },

  gridInput: { flexGrow: 1, flexBasis: 104 },

  // ============================================
  // Buttons (legacy — migrate to <Button>)
  // ============================================
  button: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3]
  },

  buttonDisabled: { opacity: 0.48 },

  buttonText: { color: colors.white, ...typography.body },

  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3]
  },

  secondaryButtonText: { color: colors.primary, ...typography.body },

  switchAuthButton: { minHeight: 28, alignItems: "center", justifyContent: "center" },

  switchAuthText: { color: colors.primary, ...typography.bodySmall },

  codeButton: {
    width: 104,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },

  smallButton: {
    minHeight: 34,
    paddingHorizontal: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: colors.surface
  },

  smallButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  smallButtonText: { color: colors.textSecondary, ...typography.bodySmall },

  smallButtonTextActive: { color: colors.white },

  smallDangerButton: {
    minHeight: 34,
    paddingHorizontal: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#c8674e",
    alignItems: "center",
    justifyContent: "center"
  },

  smallDangerText: { color: colors.danger, ...typography.bodySmall },

  backButton: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5], borderRadius: radii.md, backgroundColor: colors.primaryLightest },

  backButtonText: { color: colors.primary, ...typography.bodySmall },

  refreshButton: {
    minHeight: 34,
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight
  },

  refreshButtonText: { color: colors.text, ...typography.bodySmall },

  actionButton: { flex: 1 },

  // ============================================
  // Cards & panels (legacy — migrate to <Card>)
  // ============================================
  panel: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    ...shadows.card
  },

  card: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3],
    ...shadows.card
  },

  detailPanel: {
    padding: spacing[3.5],
    backgroundColor: colors.surfaceWarm2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing[2]
  },

  apartmentListCard: {
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    backgroundColor: colors.surfaceWarm2
  },

  roomCard: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    ...shadows.card
  },

  roomCardActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  billCard: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.subtle
  },

  planCard: {
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    backgroundColor: colors.surfaceWarm2
  },

  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  memberCard: {
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    gap: spacing[2.5],
    backgroundColor: colors.surfaceWarm2
  },

  leaseCandidateCard: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    ...shadows.subtle
  },

  // ============================================
  // Typography helpers
  // ============================================
  sectionTitle: { color: colors.text, ...typography.h5 },

  cardTitle: { color: colors.text, ...typography.h5 },

  cardStat: { color: colors.primary, ...typography.body },

  muted: { color: colors.textMuted, ...typography.body },

  link: { color: colors.primary, ...typography.body },

  noticeBanner: {
    padding: spacing[2.5],
    borderRadius: radii.md,
    backgroundColor: colors.primaryLighter,
    color: colors.primary,
    ...typography.bodySmall,
    fontWeight: "700"
  },

  noticeText: { color: colors.text, ...typography.bodyLarge },

  emptyText: { color: colors.textPlaceholder, textAlign: "center", marginTop: spacing[6], ...typography.body },

  // ============================================
  // Status badges (legacy — migrate to <Badge>)
  // ============================================
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.full,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden"
  },

  statusVacant: { backgroundColor: colors.successLight, color: colors.success },

  statusOccupied: { backgroundColor: colors.warningLight, color: colors.warning },

  statusMaintenance: { backgroundColor: colors.dangerLight, color: colors.danger },

  statusReserved: { backgroundColor: colors.neutralLight, color: colors.neutral },

  todoBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.full,
    backgroundColor: colors.primaryLighter,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden"
  },

  todoBadgeDanger: { backgroundColor: colors.dangerLight, color: colors.danger },

  todoBadgeWarning: { backgroundColor: colors.warningLight, color: colors.warning },

  roleBadge: { color: colors.primary, ...typography.bodySmall },

  // ============================================
  // Segment control
  // ============================================
  segment: {
    flexDirection: "row",
    padding: spacing[0.75],
    borderRadius: radii.md,
    backgroundColor: "#ece5d5",
    gap: spacing[0.75]
  },

  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center"
  },

  segmentItemActive: { backgroundColor: colors.surface },

  segmentText: { color: "#596460", ...typography.bodySmall },

  segmentTextActive: { color: colors.text },

  // ============================================
  // Metrics & stats
  // ============================================
  metricRow: { flexDirection: "row", gap: spacing[2.5] },

  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing[3], ...shadows.card },

  metricValue: { marginTop: spacing[1], ...typography.metric, color: colors.text },

  statRow: { flexDirection: "row", gap: spacing[2.5] },

  statBlock: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing[3.5], gap: spacing[1.5], ...shadows.card },

  statValue: { ...typography.stat, color: colors.text },

  statLabel: { color: colors.textMuted, ...typography.labelSmall },

  // ============================================
  // Tab bar
  // ============================================
  tabbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: layout.tabBarBottomOffset,
    minHeight: layout.tabBarHeight,
    padding: spacing[2],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLighter,
    flexDirection: "row",
    gap: spacing[1.5]
  },

  tab: { flex: 1, borderRadius: radii.md, alignItems: "center", justifyContent: "center", gap: spacing[0.5] },

  tabActive: { backgroundColor: colors.primary },

  tabText: { color: colors.textPlaceholder, fontSize: 12, lineHeight: 16 },

  tabTextActive: { color: colors.white, fontWeight: "700" },

  // ============================================
  // Home screen
  // ============================================
  homeHero: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDark,
    gap: spacing[3.5]
  },

  homeEyebrow: { color: colors.accent, ...typography.labelSmall },

  homeHeroValue: { marginTop: spacing[1], color: colors.white, ...typography.h1 },

  homeHeroGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[2.5],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: "#294743"
  },

  homeHeroLabel: { color: colors.accentLight, ...typography.labelSmall },

  homeHeroMetric: { marginTop: spacing[0.75], color: colors.white, ...typography.bodyLarge },

  todoItem: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2.5],
    ...shadows.subtle
  },

  todoContent: { flex: 1, gap: spacing[1] },

  homeApartmentRow: {
    paddingVertical: spacing[2.5],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3]
  },

  homeApartmentMain: { flex: 1, gap: spacing[0.75] },

  homeApartmentStat: { alignItems: "flex-end", gap: spacing[0.75] },

  quickActionTitle: { color: colors.textMuted, ...typography.labelSmall },

  quickActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },

  quickActionCard: { width: 64, alignItems: "center", gap: spacing[1.5] },

  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLightest,
    alignItems: "center",
    justifyContent: "center"
  },

  quickActionIconText: { color: colors.primary, fontSize: 18, fontWeight: "700" },

  quickActionLabel: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center" },

  // ============================================
  // Rooms screen
  // ============================================
  roomGrid: { gap: spacing[2.5] },

  roomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing[3] },

  roomHeaderBadges: { alignItems: "flex-end", gap: spacing[1], flexShrink: 0 },

  roomActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },

  filterBar: { flexDirection: "row", gap: spacing[2] },

  filterButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },

  filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  filterButtonText: { color: colors.textSecondary, ...typography.bodySmall },

  filterButtonTextActive: { color: colors.primary },

  // ============================================
  // Settings
  // ============================================
  settingItem: {
    padding: spacing[3.5],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    ...shadows.card
  },

  settingItemText: { color: colors.text, ...typography.bodyLarge, fontWeight: "700" },

  subPageHeader: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[1] },

  planHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },

  planPrice: { marginTop: spacing[1], color: colors.primary, ...typography.h4 },

  quotaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },

  quotaText: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    backgroundColor: colors.background,
    color: colors.textSecondary,
    fontSize: 12,
    overflow: "hidden"
  },

  // ============================================
  // Bills
  // ============================================
  billAmountRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing[3] },

  billSummaryAside: { alignItems: "flex-end", gap: spacing[0.5] },

  billCardFooter: {
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3]
  },

  billAmount: { color: colors.text, ...typography.stat },

  billLine: { paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: "row", justifyContent: "space-between", gap: spacing[2.5] },

  billDetailBlock: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2], gap: spacing[1.5] },

  billItemLine: { flexDirection: "row", justifyContent: "space-between", gap: spacing[2.5], paddingLeft: spacing[2] },

  billChoiceList: { gap: spacing[2] },

  readingRow: {
    padding: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    ...shadows.subtle
  },

  // ============================================
  // Form layout
  // ============================================
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },

  formField: { flexGrow: 1, flexBasis: 104, gap: spacing[1] },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2.5], flexWrap: "wrap" },

  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },

  // ============================================
  // Org & members
  // ============================================
  orgOption: {
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3]
  },

  orgOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  memberHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },

  roleActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },

  // ============================================
  // Batch rooms
  // ============================================
  batchRoomPanel: {
    padding: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceWarm2,
    gap: spacing[2]
  },

  batchRoomGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },

  batchRoomButton: {
    minWidth: 62,
    minHeight: 34,
    paddingHorizontal: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },

  batchRoomButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },

  batchRoomButtonText: { color: colors.textSecondary, ...typography.bodySmall },

  batchRoomButtonTextActive: { color: colors.white },

  // ============================================
  // Fee items
  // ============================================
  feeItem: {
    padding: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceWarm2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2.5]
  },

  feeItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryLightest },

  // ============================================
  // Modal / overlay
  // ============================================
  modalOverlay: {
    flex: 1,
    padding: spacing[4],
    backgroundColor: colors.overlayHeavy,
    justifyContent: "center"
  },

  modalCard: {
    maxHeight: "88%",
    padding: spacing[3.5],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing[2.5],
    ...shadows.float
  },

  modalScrollContent: { gap: spacing[2.5] },

  // ============================================
  // Task sheet
  // ============================================
  taskSheetOverlay: { flex: 1, backgroundColor: colors.overlayHeavy },

  taskSheetOverlay_drawer: { justifyContent: "flex-end" },

  taskSheetOverlay_dialog: { justifyContent: "center", padding: spacing[4.5] },

  taskSheetCard: { backgroundColor: colors.surface, gap: spacing[2.5], padding: spacing[3.5] },

  taskSheetCard_drawer: {
    maxHeight: layout.maxSheetHeight,
    minHeight: layout.minSheetHeight,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.float
  },

  taskSheetCard_dialog: {
    maxHeight: "78%",
    borderRadius: radii.lg,
    ...shadows.float
  },

  taskSheetTitleBlock: { flex: 1, gap: spacing[0.5] },

  taskSheetContent: { gap: spacing[2.5], paddingBottom: spacing[0.5] },

  taskSheetFooter: { gap: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider },

  // ============================================
  // Date field (legacy — migrate styling)
  // ============================================
  dateFieldWrap: { position: "relative", flexGrow: 1, flexBasis: 104 },

  dateField: { justifyContent: "center" },

  dateFieldText: { color: colors.text },

  dateFieldPlaceholder: { color: colors.textPlaceholder },

  datePickerPanel: {
    position: "absolute",
    top: 48,
    left: 0,
    zIndex: 30,
    width: 260,
    padding: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.elevated
  },

  datePickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] },

  datePickerTitle: { color: colors.text, ...typography.body },

  datePickerNav: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLightest
  },

  datePickerNavText: { color: colors.primary, fontSize: 22, lineHeight: 24, fontWeight: "700" },

  datePickerGrid: { flexDirection: "row", flexWrap: "wrap" },

  datePickerWeekday: { width: "14.2857%", paddingVertical: spacing[1], textAlign: "center", color: colors.textMuted, ...typography.labelSmall },

  datePickerDay: { width: "14.2857%", height: 32, alignItems: "center", justifyContent: "center", borderRadius: radii.md },

  datePickerDayActive: { backgroundColor: colors.primary },

  datePickerDayText: { color: colors.text, ...typography.bodySmall },

  datePickerDayTextActive: { color: colors.white },

  datePickerModalOverlay: {
    flex: 1,
    padding: spacing[4.5],
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center"
  },

  datePickerModalPanel: {
    width: 320,
    maxWidth: "100%",
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.float
  }
});
