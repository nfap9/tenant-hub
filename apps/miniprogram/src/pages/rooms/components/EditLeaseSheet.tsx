import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Input } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { selectableFeeTypes, feeTypeLabels, LeaseFeeFormItem } from '../constants';
import type { Lease } from '../../../types/domain';

interface EditLeaseSheetProps {
  visible: boolean;
  lease?: Lease;
  form: { rentAmount: string; depositAmount: string; waterUnitPrice: string; powerUnitPrice: string };
  onUpdateForm: (key: string, value: string) => void;
  onSubmit: (fees: LeaseFeeFormItem[]) => void;
  onClose: () => void;
}

export function EditLeaseSheet({ visible, lease, form, onUpdateForm, onSubmit, onClose }: EditLeaseSheetProps) {
  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);

  useEffect(() => {
    if (lease) {
      const leaseFees = lease.fees ?? [];
      setFees(leaseFees.map((fee) => ({
        id: fee.id,
        type: fee.type,
        name: fee.name || feeTypeLabels[fee.type] || "其他费用",
        amount: String(fee.amount)
      })));
    }
  }, [lease]);

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
      title="编辑租约"
      onClose={handleClose}
      footer={(
        <>
          <Button onClick={handleSubmit}>保存修改</Button>
          <Button variant="ghost" onClick={handleClose}>取消</Button>
        </>
      )}
    >
      <View className="form-grid">
        <Input label="租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => onUpdateForm("rentAmount", value)} />
        <Input label="押金" placeholder="请输入押金" type="number" value={form.depositAmount} onChange={(value) => onUpdateForm("depositAmount", value)} />
      </View>
      <View className="form-grid">
        <Input label="水费单价" placeholder="元/吨" type="number" value={form.waterUnitPrice} onChange={(value) => onUpdateForm("waterUnitPrice", value)} />
        <Input label="电费单价" placeholder="元/度" type="number" value={form.powerUnitPrice} onChange={(value) => onUpdateForm("powerUnitPrice", value)} />
      </View>
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
