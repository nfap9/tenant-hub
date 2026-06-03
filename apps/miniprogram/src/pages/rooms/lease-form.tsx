import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input, DateField } from '../../components/ui';
import { today, nextYear } from '../../utils/format';
import {
  cycleLabels,
  selectableFeeTypes,
  type LeaseFeeFormItem,
  type RentCycle,
} from './constants';
import { buildLeaseFeesPayload } from './utils';
import './index.scss';

export default function LeaseFormPage() {
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const { params } = useRouter();
  const roomId = params.roomId;

  const [form, setForm] = useState({
    tenantName: '',
    tenantPhone: '',
    startDate: today(),
    endDate: nextYear(),
    cycle: 'MONTHLY' as RentCycle,
    rentAmount: '',
    depositAmount: '',
    waterUnitPrice: '0',
    powerUnitPrice: '0',
    autoRenew: true,
    generateHistoricalBills: false,
  });
  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const [saving, setSaving] = useState(false);

  const updateForm = (
    key: keyof typeof form,
    value: string | boolean | RentCycle
  ) => setForm((old) => ({ ...old, [key]: value }));

  const addFee = async () => {
    const availableTypes = selectableFeeTypes.filter(
      (item) => !fees.some((fee) => fee.type === item.type)
    );
    if (availableTypes.length === 0) {
      Taro.showToast({ title: '费用项目已全部添加', icon: 'none' });
      return;
    }
    try {
      const result = await Taro.showActionSheet({
        itemList: availableTypes.map((item) => item.label),
      });
      const selectedType = availableTypes[result.tapIndex];
      if (!selectedType) return;
      setFees((old) => [
        ...old,
        {
          id: `${selectedType.type}-${Date.now()}`,
          type: selectedType.type,
          name: selectedType.label,
          amount: '',
        },
      ]);
    } catch {
      // cancelled
    }
  };

  const updateFeeAmount = (id: string, amount: string) => {
    setFees((old) =>
      old.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const removeFee = (id: string) => {
    setFees((old) => old.filter((item) => item.id !== id));
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSave = async () => {
    if (!currentOrgId || !roomId) return;
    if (!canManageLease) {
      Taro.showToast({ title: '当前角色没有管理租约权限', icon: 'none' });
      return;
    }
    if (
      !form.tenantName.trim() ||
      !form.tenantPhone.trim() ||
      !form.rentAmount.trim()
    ) {
      return Taro.showToast({ title: '请填写租客、电话和租金', icon: 'none' });
    }

    setSaving(true);
    try {
      await apiClient('/leases', {
        method: 'POST',
        body: {
          roomId,
          tenantName: form.tenantName.trim(),
          tenantPhone: form.tenantPhone.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          cycle: form.cycle,
          rentAmount: Number(form.rentAmount),
          depositAmount: Number(form.depositAmount || 0),
          waterUnitPrice: Number(form.waterUnitPrice || 0),
          powerUnitPrice: Number(form.powerUnitPrice || 0),
          autoRenew: form.autoRenew,
          generateHistoricalBills: form.generateHistoricalBills,
          fees: buildLeaseFeesPayload(fees),
        },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '签约完成', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '签约失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="签约入住">
        <Input
          label="租客姓名"
          placeholder="请输入姓名"
          value={form.tenantName}
          onChange={(value) => updateForm('tenantName', value)}
        />
        <Input
          label="租客电话"
          placeholder="请输入手机号"
          value={form.tenantPhone}
          onChange={(value) => updateForm('tenantPhone', value)}
        />
        <View className="form-grid">
          <DateField
            label="开始日期"
            placeholder="选择日期"
            value={form.startDate}
            onChange={(value) => updateForm('startDate', value)}
          />
          <DateField
            label="结束日期"
            placeholder="选择日期"
            value={form.endDate}
            onChange={(value) => updateForm('endDate', value)}
          />
        </View>
        <View className="form-grid">
          <Input
            label="租金"
            placeholder="每期金额"
            type="number"
            value={form.rentAmount}
            onChange={(value) => updateForm('rentAmount', value)}
          />
          <Input
            label="押金"
            placeholder="请输入押金"
            type="number"
            value={form.depositAmount}
            onChange={(value) => updateForm('depositAmount', value)}
          />
        </View>
        <Text className="field-label">交租周期</Text>
        <View className="segment">
          {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as RentCycle[]).map((item) => (
            <View
              key={item}
              className={`segment-item ${form.cycle === item ? 'segment-item--active' : ''}`}
              onClick={() => updateForm('cycle', item)}
            >
              <Text
                className={`segment-text ${form.cycle === item ? 'segment-text--active' : ''}`}
              >
                {cycleLabels[item]}
              </Text>
            </View>
          ))}
        </View>
        <View className="form-grid">
          <Input
            label="水费单价"
            placeholder="元/吨"
            type="number"
            value={form.waterUnitPrice}
            onChange={(value) => updateForm('waterUnitPrice', value)}
          />
          <Input
            label="电费单价"
            placeholder="元/度"
            type="number"
            value={form.powerUnitPrice}
            onChange={(value) => updateForm('powerUnitPrice', value)}
          />
        </View>
        <Text className="field-label">自动续约</Text>
        <View className="segment">
          {[true, false].map((item) => (
            <View
              key={String(item)}
              className={`segment-item ${form.autoRenew === item ? 'segment-item--active' : ''}`}
              onClick={() => updateForm('autoRenew', item)}
            >
              <Text
                className={`segment-text ${form.autoRenew === item ? 'segment-text--active' : ''}`}
              >
                {item ? '开启' : '关闭'}
              </Text>
            </View>
          ))}
        </View>
        {new Date(form.startDate).setHours(0, 0, 0, 0) <
        new Date().setHours(0, 0, 0, 0) ? (
          <>
            <Text className="field-label">历史账单</Text>
            <View className="segment">
              {[false, true].map((item) => (
                <View
                  key={String(item)}
                  className={`segment-item ${form.generateHistoricalBills === item ? 'segment-item--active' : ''}`}
                  onClick={() => updateForm('generateHistoricalBills', item)}
                >
                  <Text
                    className={`segment-text ${form.generateHistoricalBills === item ? 'segment-text--active' : ''}`}
                  >
                    {item ? '生成全部' : '仅当前期'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        <Text className="field-label">费用项目</Text>
        <View className="fee-list">
          {fees.map((item) => (
            <View key={item.id} className="fee-row">
              <Text className="fee-row__type">{item.name}</Text>
              <Input
                label=""
                placeholder="价格"
                type="number"
                value={item.amount}
                onChange={(value) => updateFeeAmount(item.id, value)}
              />
              <Text className="danger-text" onClick={() => removeFee(item.id)}>
                删除
              </Text>
            </View>
          ))}
        </View>
        <Button variant="secondary" size="small" onClick={addFee}>
          添加费用
        </Button>
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          确认签约
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
