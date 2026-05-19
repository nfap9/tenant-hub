import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Input, DateField } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { cycleLabels, selectableFeeTypes, type LeaseFeeFormItem, type RentCycle } from '../constants';

interface LeaseSheetProps {
  visible: boolean;
  form: {
    tenantName: string;
    tenantPhone: string;
    startDate: string;
    endDate: string;
    graceDays: string;
    cycle: RentCycle;
    rentAmount: string;
    depositAmount: string;
    waterUnitPrice: string;
    powerUnitPrice: string;
    autoRenew: boolean;
    generateHistoricalBills: boolean;
  };
  onUpdateForm: (key: string, value: string | boolean | RentCycle) => void;
  onSubmit: (fees: LeaseFeeFormItem[]) => void;
  onClose: () => void;
}

export function LeaseSheet({ visible, form, onUpdateForm, onSubmit, onClose }: LeaseSheetProps) {
  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);

  const addFee = async () => {
    const availableTypes = selectableFeeTypes.filter((item) => !fees.some((fee) => fee.type === item.type));
    if (availableTypes.length === 0) {
      Taro.showToast({ title: "费用项目已全部添加", icon: "none" });
      return;
    }
    try {
      const result = await Taro.showActionSheet({ itemList: availableTypes.map((item) => item.label) });
      const selectedType = availableTypes[result.tapIndex];
      if (!selectedType) return;
      setFees((old) => [...old, { id: `${selectedType.type}-${Date.now()}`, type: selectedType.type, name: selectedType.label, amount: "" }]);
    } catch {
      // User cancelled the action sheet.
    }
  };

  const updateFeeAmount = (id: string, amount: string) => {
    setFees((old) => old.map((item) => (item.id === id ? { ...item, amount } : item)));
  };

  const removeFee = (id: string) => {
    setFees((old) => old.filter((item) => item.id !== id));
  };

  const handleClose = () => {
    setFees([]);
    onClose();
  };

  const handleSubmit = () => {
    onSubmit(fees);
  };

  return (
    <TaskSheet
      visible={visible}
      title="签约入住"
      onClose={handleClose}
      footer={(
        <>
          <Button onClick={handleSubmit}>确认签约</Button>
          <Button variant="ghost" onClick={handleClose}>取消</Button>
        </>
      )}
    >
      <Input label="租客姓名" placeholder="请输入姓名" value={form.tenantName} onChange={(value) => onUpdateForm("tenantName", value)} />
      <Input label="租客电话" placeholder="请输入手机号" value={form.tenantPhone} onChange={(value) => onUpdateForm("tenantPhone", value)} />
      <View className="form-grid">
        <DateField label="开始日期" placeholder="选择日期" value={form.startDate} onChange={(value) => onUpdateForm("startDate", value)} />
        <DateField label="结束日期" placeholder="选择日期" value={form.endDate} onChange={(value) => onUpdateForm("endDate", value)} />
      </View>
      <View className="form-grid">
        <Input label="租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => onUpdateForm("rentAmount", value)} />
        <Input label="押金" placeholder="请输入押金" type="number" value={form.depositAmount} onChange={(value) => onUpdateForm("depositAmount", value)} />
      </View>
      <View className="form-grid">
        <Input label="宽限天数" placeholder="交租日后几日内" type="number" value={form.graceDays} onChange={(value) => onUpdateForm("graceDays", value)} />
      </View>
      <Text className="field-label">交租周期</Text>
      <View className="segment">
        {(["MONTHLY", "QUARTERLY", "YEARLY"] as RentCycle[]).map((item) => (
          <View key={item} className={`segment-item ${form.cycle === item ? 'segment-item--active' : ''}`} onClick={() => onUpdateForm("cycle", item)}>
            <Text className={`segment-text ${form.cycle === item ? 'segment-text--active' : ''}`}>{cycleLabels[item]}</Text>
          </View>
        ))}
      </View>
      <View className="form-grid">
        <Input label="水费单价" placeholder="元/吨" type="number" value={form.waterUnitPrice} onChange={(value) => onUpdateForm("waterUnitPrice", value)} />
        <Input label="电费单价" placeholder="元/度" type="number" value={form.powerUnitPrice} onChange={(value) => onUpdateForm("powerUnitPrice", value)} />
      </View>
      <Text className="field-label">自动续约</Text>
      <View className="segment">
        {[true, false].map((item) => (
          <View key={String(item)} className={`segment-item ${form.autoRenew === item ? 'segment-item--active' : ''}`} onClick={() => onUpdateForm("autoRenew", item)}>
            <Text className={`segment-text ${form.autoRenew === item ? 'segment-text--active' : ''}`}>{item ? "开启" : "关闭"}</Text>
          </View>
        ))}
      </View>
      {new Date(form.startDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? (
        <>
          <Text className="field-label">历史账单</Text>
          <View className="segment">
            {[false, true].map((item) => (
              <View key={String(item)} className={`segment-item ${form.generateHistoricalBills === item ? 'segment-item--active' : ''}`} onClick={() => onUpdateForm("generateHistoricalBills", item)}>
                <Text className={`segment-text ${form.generateHistoricalBills === item ? 'segment-text--active' : ''}`}>{item ? "生成全部" : "仅当前期"}</Text>
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
            <Input label="" placeholder="价格" type="number" value={item.amount} onChange={(value) => updateFeeAmount(item.id, value)} />
            <Text className="danger-text" onClick={() => removeFee(item.id)}>删除</Text>
          </View>
        ))}
      </View>
      <Button variant="secondary" size="small" onClick={addFee}>添加费用</Button>
    </TaskSheet>
  );
}
