import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { getApiBaseUrl } from '../../constants/config';
import { Button, Card } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { money } from '../../utils/format';
import { remainingAmount, getPaymentAmountError } from './utils';
import { UnpaidTab } from './components/UnpaidTab';
import { PendingTab } from './components/PendingTab';
import { AllTab } from './components/AllTab';
import { PaymentSheet } from './components/PaymentSheet';
import { ReadingSheet } from './components/ReadingSheet';
import { UtilitySheet } from './components/UtilitySheet';
import { UtilityImportSheet } from './components/UtilityImportSheet';
import { UtilityExportSheet } from './components/UtilityExportSheet';
import { MonthlyDetailSheet } from './components/MonthlyDetailSheet';
import { DeleteConfirmSheet } from './components/DeleteConfirmSheet';
import { EditBillItemSheet } from './components/EditBillItemSheet';
import type { Bill, BillStatus, MonthlyBill, MeterType, Room } from '../../types/domain';
import './index.scss';

export default function BillsPage() {
  const { currentOrgId } = useAppSession();
  const [tab, setTab] = useState<"unpaid" | "pending" | "all">("unpaid");
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [layer, setLayer] = useState<"payment" | "reading" | "utility" | "utilityImport" | "utilityExport" | "monthlyDetail" | "deleteConfirm" | "deleteChildConfirm" | "editBillItem" | undefined>();
  const [selectedMonthlyBillId, setSelectedMonthlyBillId] = useState("");
  const [selectedChildBillId, setSelectedChildBillId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "">("");
  const [utilityCsv, setUtilityCsv] = useState("");
  const [editingBillItem, setEditingBillItem] = useState<{ id: string; billId: string; name: string; amount: number; note: string } | undefined>();
  const [utilityBill, setUtilityBill] = useState<Bill | undefined>();

  const unpaidMonthlyBills = useMemo(() => monthlyBills.filter((bill) => bill.status === "UNPAID" || bill.status === "PARTIAL_PAID"), [monthlyBills]);
  const unpaidTotal = useMemo(() => unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0), [unpaidMonthlyBills]);
  const selectedMonthlyBill = useMemo(() => monthlyBills.find((bill) => bill.id === selectedMonthlyBillId), [monthlyBills, selectedMonthlyBillId]);

  const filteredAllBills = useMemo(() => {
    let result = [...monthlyBills];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((bill) =>
        bill.tenantName?.toLowerCase().includes(q) ||
        bill.lease?.room?.roomNo?.toLowerCase().includes(q) ||
        bill.lease?.tenantPhone?.includes(q)
      );
    }
    if (statusFilter) result = result.filter((bill) => bill.status === statusFilter);
    return result;
  }, [monthlyBills, searchQuery, statusFilter]);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const nextMonthlyBills = await apiClient<MonthlyBill[]>("/bills/monthly", { organizationId: currentOrgId });
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        apiClient<Bill[]>("/bills?status=FAILED", { organizationId: currentOrgId }),
        apiClient<Bill[]>("/bills?status=BILLING", { organizationId: currentOrgId }),
        apiClient<Room[]>("/apartments/rooms", { organizationId: currentOrgId })
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID");
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "账单加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  const openPayment = () => {
    if (unpaidMonthlyBills.length === 0) {
      Taro.showToast({ title: "暂无待收账单", icon: "none" });
      return;
    }
    setLayer("payment");
  };

  const openMonthlyDetail = (bill: MonthlyBill) => {
    setSelectedMonthlyBillId(bill.id);
    setLayer("monthlyDetail");
  };

  const openUtilityReading = (bill: Bill) => {
    setUtilityBill(bill);
    setLayer("utility");
  };

  const openDeleteMonthly = (bill: MonthlyBill) => {
    setSelectedMonthlyBillId(bill.id);
    setLayer("deleteConfirm");
  };

  const openDeleteChild = (childId: string) => {
    setSelectedChildBillId(childId);
    setLayer("deleteChildConfirm");
  };

  const openEditItem = (item: { id: string; billId: string; name: string; amount: number; note: string }) => {
    setEditingBillItem(item);
    setLayer("editBillItem");
  };

  const submitReading = async (roomId: string, meterType: MeterType, readingDate: string, value: string, note: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient("/bills/meter-readings", {
        method: "POST",
        body: { roomId, meterType, readingDate, value: Number(value), note: note.trim() || undefined },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "抄表记录已保存", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存失败", icon: "none" });
    }
  };

  const retryBill = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${bill.id}/retry-billing`, { method: "POST", organizationId: currentOrgId });
      Taro.showToast({ title: "已重新尝试出账", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "重试失败", icon: "none" });
    }
  };

  const submitPayment = async (monthlyBillId: string, amount: string, method: string, note: string) => {
    if (!currentOrgId) return;
    const bill = monthlyBills.find((item) => item.id === monthlyBillId);
    if (!bill || bill.status === "PAID" || bill.status === "VOID") {
      Taro.showToast({ title: "请选择一张未结清账单", icon: "none" });
      return;
    }
    const amountError = getPaymentAmountError(amount, remainingAmount(bill));
    if (amountError) {
      Taro.showToast({ title: amountError, icon: "none" });
      return;
    }
    try {
      await apiClient(`/bills/monthly/${monthlyBillId}/payments`, {
        method: "POST",
        body: { amount: Number(amount), method: method.trim() || "线下收款", note: note.trim() || undefined },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "收款已登记", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "收款失败", icon: "none" });
    }
  };

  const submitUtilityReading = async (billId: string, previousWater: string, currentWater: string, previousPower: string, currentPower: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${billId}/utility-reading`, {
        method: "POST",
        body: {
          previousWater: Number(previousWater || 0),
          currentWater: Number(currentWater || 0),
          previousPower: Number(previousPower || 0),
          currentPower: Number(currentPower || 0)
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "水电读数已录入", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "水电录入失败", icon: "none" });
    }
  };

  const exportUtilityCsv = async () => {
    if (!currentOrgId) return;
    try {
      const res = await Taro.request({
        url: `${getApiBaseUrl()}/bills/utility/pending-export`,
        header: { authorization: `Bearer ${(await import('../../utils/storage')).getSession()?.token}`, "x-organization-id": currentOrgId }
      });
      setUtilityCsv(typeof res.data === "string" ? res.data : "");
      setLayer("utilityExport");
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "导出失败", icon: "none" });
    }
  };

  const importUtilityCsv = async (csv: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient("/bills/utility/import", { method: "POST", body: { csv }, organizationId: currentOrgId });
      Taro.showToast({ title: "水电读数已导入", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "导入失败", icon: "none" });
    }
  };

  const deleteMonthlyBill = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/monthly/${id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "月度账单已删除", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除失败", icon: "none" });
    }
  };

  const deleteChildBill = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "账单已删除", icon: "success" });
      setSelectedChildBillId("");
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除失败", icon: "none" });
    }
  };

  const updateBillItem = async (billId: string, itemId: string, amount: string, note: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${billId}/items/${itemId}`, {
        method: "PUT",
        organizationId: currentOrgId,
        body: { amount: Number(amount), note: note.trim() || undefined }
      });
      Taro.showToast({ title: "账单项目已更新", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <View className="stat-row">
        {tab === "unpaid" ? (
          <>
            <Card className="stat-card"><Text className="stat-label">待支付账单</Text><Text className="stat-value">{unpaidMonthlyBills.length}</Text></Card>
            <Card className="stat-card"><Text className="stat-label">待收金额</Text><Text className="stat-value">¥{money(unpaidTotal)}</Text></Card>
          </>
        ) : tab === "pending" ? (
          <Card className="stat-card"><Text className="stat-label">待处理账单</Text><Text className="stat-value">{reviewBills.length}</Text></Card>
        ) : (
          <>
            <Card className="stat-card"><Text className="stat-label">全部账单</Text><Text className="stat-value">{monthlyBills.length}</Text></Card>
            <Card className="stat-card"><Text className="stat-label">待收金额</Text><Text className="stat-value">¥{money(unpaidTotal)}</Text></Card>
          </>
        )}
      </View>

      <View className="segment">
        {([{ key: "unpaid", label: "待支付" }, { key: "pending", label: "待处理" }, { key: "all", label: "全部" }] as const).map(({ key, label }) => (
          <View key={key} className={`segment-item ${tab === key ? 'segment-item--active' : ''}`} onClick={() => setTab(key)}>
            <Text className={`segment-text ${tab === key ? 'segment-text--active' : ''}`}>{label}</Text>
          </View>
        ))}
      </View>

      <View className="section-header">
        <View className="action-row-inline">
          {tab === "unpaid" ? <Button variant="secondary" size="small" onClick={openPayment}>登记收款</Button> : null}
          {tab === "pending" ? (
            <>
              <Button size="small" onClick={() => setLayer("reading")}>录入读数</Button>
              <Button variant="secondary" size="small" onClick={exportUtilityCsv}>导出</Button>
              <Button variant="secondary" size="small" onClick={() => setLayer("utilityImport")}>导入</Button>
            </>
          ) : null}
          <Button variant="ghost" size="small" loading={loading} disabled={loading} onClick={loadData}>{loading ? "刷新中" : "刷新"}</Button>
        </View>
      </View>

      {tab === "unpaid" ? (
        <UnpaidTab bills={unpaidMonthlyBills} onDetail={openMonthlyDetail} />
      ) : tab === "pending" ? (
        <PendingTab bills={reviewBills} onRetry={retryBill} onUtilityReading={openUtilityReading} />
      ) : (
        <AllTab
          bills={filteredAllBills}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onDetail={openMonthlyDetail}
          onDelete={openDeleteMonthly}
        />
      )}

      <PaymentSheet
        visible={layer === "payment"}
        rooms={rooms}
        bills={unpaidMonthlyBills}
        onSubmit={submitPayment}
        onClose={() => setLayer(undefined)}
      />

      <ReadingSheet
        visible={layer === "reading"}
        rooms={rooms}
        onSubmit={submitReading}
        onClose={() => setLayer(undefined)}
      />

      <UtilitySheet
        visible={layer === "utility"}
        bill={utilityBill}
        onSubmit={submitUtilityReading}
        onClose={() => setLayer(undefined)}
      />

      <UtilityImportSheet
        visible={layer === "utilityImport"}
        onSubmit={importUtilityCsv}
        onClose={() => setLayer(undefined)}
      />

      <UtilityExportSheet
        visible={layer === "utilityExport"}
        csv={utilityCsv}
        onClose={() => setLayer(undefined)}
      />

      <MonthlyDetailSheet
        visible={layer === "monthlyDetail"}
        bill={selectedMonthlyBill}
        onPayment={submitPayment}
        onUtilityReading={openUtilityReading}
        onEditItem={openEditItem}
        onDeleteChild={openDeleteChild}
        onClose={() => setLayer(undefined)}
      />

      <DeleteConfirmSheet
        visible={layer === "deleteConfirm"}
        title="删除月度账单"
        onConfirm={() => deleteMonthlyBill(selectedMonthlyBillId)}
        onClose={() => setLayer(undefined)}
      />

      <DeleteConfirmSheet
        visible={layer === "deleteChildConfirm"}
        title="删除账单"
        onConfirm={() => deleteChildBill(selectedChildBillId)}
        onClose={() => setLayer(undefined)}
      />

      <EditBillItemSheet
        visible={layer === "editBillItem"}
        item={editingBillItem}
        onSubmit={updateBillItem}
        onClose={() => { setEditingBillItem(undefined); setLayer("monthlyDetail"); }}
      />
    </View>
  );
}
