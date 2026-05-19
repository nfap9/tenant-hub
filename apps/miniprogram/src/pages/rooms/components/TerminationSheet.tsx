import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Input, DateField } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { terminationLabels } from '../constants';
import { computeSettlementPreview, defaultTerminationType, terminationResultText } from '../utils';
import { money, today, numberValue } from '../../../utils/format';
import { apiClient } from '../../../api/client';
import type { Lease, TerminationType } from '../../../types/domain';

interface TerminationSheetProps {
  visible: boolean;
  lease?: Lease;
  currentOrgId?: string;
  onSubmit: (form: {
    type: TerminationType;
    reason: string;
    terminatedAt: string;
    depositDeductionAmount: number;
    depositDeductionReason?: string;
    rentAdjustmentAmount: number;
    currentWater: number;
    currentPower: number;
    otherFeeAmount: number;
    otherFeeReason?: string;
  }) => void;
  onClose: () => void;
}

export function TerminationSheet({ visible, lease, currentOrgId, onSubmit, onClose }: TerminationSheetProps) {
  const [form, setForm] = useState({
    type: "NEGOTIATED" as TerminationType,
    terminatedAt: today(),
    reason: "",
    depositDeductionAmount: "0",
    depositDeductionReason: "",
    rentAdjustmentAmount: "0",
    currentWater: "0",
    currentPower: "0",
    otherFeeAmount: "0",
    otherFeeReason: ""
  });
  const [previousReadings, setPreviousReadings] = useState({ previousWater: 0, previousPower: 0 });

  useEffect(() => {
    if (lease && currentOrgId) {
      const defaultType = defaultTerminationType(lease.endDate, today());
      setForm({
        type: defaultType,
        terminatedAt: today(),
        reason: "",
        depositDeductionAmount: "0",
        depositDeductionReason: "",
        rentAdjustmentAmount: "0",
        currentWater: "0",
        currentPower: "0",
        otherFeeAmount: "0",
        otherFeeReason: ""
      });
      apiClient<{ previousWater: string | number; previousPower: string | number }>(`/leases/${lease.id}/settlement-preview?terminatedAt=${encodeURIComponent(today())}`, { organizationId: currentOrgId })
        .then((data) => setPreviousReadings({ previousWater: Number(data.previousWater ?? 0), previousPower: Number(data.previousPower ?? 0) }))
        .catch((e) => Taro.showToast({ title: e instanceof Error ? e.message : "退租读数加载失败", icon: "none" }));
    }
  }, [lease, currentOrgId]);

  const preview = useMemo(
    () => lease ? computeSettlementPreview(lease, form, previousReadings) : { utility: 0, depositRefund: 0, receivable: 0, refundable: 0, net: 0 },
    [lease, form, previousReadings]
  );

  const handleSubmit = () => {
    onSubmit({
      type: form.type,
      reason: form.reason.trim() || terminationLabels[form.type],
      terminatedAt: form.terminatedAt,
      depositDeductionAmount: numberValue(form.depositDeductionAmount),
      depositDeductionReason: form.depositDeductionReason.trim() || undefined,
      rentAdjustmentAmount: numberValue(form.rentAdjustmentAmount),
      currentWater: numberValue(form.currentWater),
      currentPower: numberValue(form.currentPower),
      otherFeeAmount: numberValue(form.otherFeeAmount),
      otherFeeReason: form.otherFeeReason.trim() || undefined
    });
  };

  return (
    <TaskSheet
      visible={visible}
      title="合约终止"
      onClose={onClose}
      footer={(
        <>
          <Button variant="danger" onClick={handleSubmit}>确认终止合约</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      {lease ? (
        <>
          <View className="segment">
            {(["EXPIRED", "NEGOTIATED", "BREACH"] as TerminationType[]).map((item) => (
              <View key={item} className={`segment-item ${form.type === item ? 'segment-item--active' : ''}`} onClick={() => setForm((old) => ({ ...old, type: item }))}>
                <Text className={`segment-text ${form.type === item ? 'segment-text--active' : ''}`}>{terminationLabels[item]}</Text>
              </View>
            ))}
          </View>
          <DateField label="退租日期" placeholder="选择日期" value={form.terminatedAt} onChange={(value) => setForm((old) => ({ ...old, terminatedAt: value }))} />
          <View className="detail-panel">
            <View className="detail-row"><Text className="text-muted">原押金</Text><Text className="card-stat">¥{money(lease.depositAmount)}</Text></View>
            <View className="detail-row"><Text className="text-muted">预计退押金</Text><Text className="card-stat">¥{money(preview.depositRefund)}</Text></View>
          </View>
          <View className="form-grid">
            <Input label="押金扣款" placeholder="请输入金额" type="number" value={form.depositDeductionAmount} onChange={(value) => setForm((old) => ({ ...old, depositDeductionAmount: value }))} />
            <Input label="房租退补" placeholder="正数补收，负数退款" type="number" value={form.rentAdjustmentAmount} onChange={(value) => setForm((old) => ({ ...old, rentAdjustmentAmount: value }))} />
          </View>
          <Input label="押金扣款原因" placeholder="可选" value={form.depositDeductionReason} onChange={(value) => setForm((old) => ({ ...old, depositDeductionReason: value }))} />
          <View className="form-grid">
            <View>
              <Input label="退租水表读数" placeholder="当前读数" type="number" value={form.currentWater} onChange={(value) => setForm((old) => ({ ...old, currentWater: value }))} />
              <Text className="text-muted">上次 {money(previousReadings.previousWater)}</Text>
            </View>
            <View>
              <Input label="退租电表读数" placeholder="当前读数" type="number" value={form.currentPower} onChange={(value) => setForm((old) => ({ ...old, currentPower: value }))} />
              <Text className="text-muted">上次 {money(previousReadings.previousPower)}</Text>
            </View>
          </View>
          <View className="form-grid">
            <Input label="其他费用" placeholder="请输入金额" type="number" value={form.otherFeeAmount} onChange={(value) => setForm((old) => ({ ...old, otherFeeAmount: value }))} />
            <View>
              <Text className="field-label">预估水电费</Text>
              <Text className="card-stat">¥{money(preview.utility)}</Text>
            </View>
          </View>
          <Input label="其他费用说明" placeholder="可选" value={form.otherFeeReason} onChange={(value) => setForm((old) => ({ ...old, otherFeeReason: value }))} />
          <View className="detail-panel">
            <View className="detail-row"><Text className="text-muted">应收</Text><Text className="card-stat">¥{money(preview.receivable)}</Text></View>
            <View className="detail-row"><Text className="text-muted">应退</Text><Text className="card-stat">¥{money(preview.refundable)}</Text></View>
            <View className="detail-row"><Text className="text-muted">结算结果</Text>
              <Text className={preview.net >= 0 ? "card-stat" : "danger-text"}>
                {preview.net > 0 ? `租客补交 ¥${money(preview.net)}` : preview.net < 0 ? `退租客 ¥${money(Math.abs(preview.net))}` : "结清"}
              </Text>
            </View>
          </View>
          <Input label="退租原因" placeholder="可选" value={form.reason} onChange={(value) => setForm((old) => ({ ...old, reason: value }))} />
          {lease.isAutoRenewalPeriod ? <Text className="text-muted">当前租约已进入自动续约期，到期后退房不默认视为违约。</Text> : null}
        </>
      ) : null}
    </TaskSheet>
  );
}
