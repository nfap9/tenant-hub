import { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import { Button, Input } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import type { Bill } from '../../../types/domain';

interface UtilitySheetProps {
  visible: boolean;
  bill: Bill | undefined;
  onSubmit: (billId: string, previousWater: string, currentWater: string, previousPower: string, currentPower: string) => Promise<void> | void;
  onClose: () => void;
}

export function UtilitySheet({ visible, bill, onSubmit, onClose }: UtilitySheetProps) {
  const [form, setForm] = useState({ previousWater: "", currentWater: "", previousPower: "", currentPower: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (bill) {
      const water = bill.items?.find((item) => item.type === "WATER");
      const power = bill.items?.find((item) => item.type === "POWER");
      setForm({
        previousWater: water?.previousWater ? String(water.previousWater) : "",
        currentWater: water?.currentWater ? String(water.currentWater) : "",
        previousPower: power?.previousPower ? String(power.previousPower) : "",
        currentPower: power?.currentPower ? String(power.currentPower) : ""
      });
    }
  }, [bill]);

  const handleSubmit = async () => {
    if (!bill) return;
    setSubmitting(true);
    try {
      await onSubmit(bill.id, form.previousWater, form.currentWater, form.previousPower, form.currentPower);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      title="录入本期水电"
      onClose={onClose}
      footer={(
        <>
          <Button loading={submitting} disabled={submitting} onClick={handleSubmit}>保存水电读数</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <View className="form-grid">
        <View>
          <Input label="上期水表" placeholder="请输入读数" type="number" value={form.previousWater} onChange={(value) => setForm((old) => ({ ...old, previousWater: value }))} />
        </View>
        <View>
          <Input label="本期水表" placeholder="请输入读数" type="number" value={form.currentWater} onChange={(value) => setForm((old) => ({ ...old, currentWater: value }))} />
        </View>
      </View>
      <View className="form-grid">
        <View>
          <Input label="上期电表" placeholder="请输入读数" type="number" value={form.previousPower} onChange={(value) => setForm((old) => ({ ...old, previousPower: value }))} />
        </View>
        <View>
          <Input label="本期电表" placeholder="请输入读数" type="number" value={form.currentPower} onChange={(value) => setForm((old) => ({ ...old, currentPower: value }))} />
        </View>
      </View>
    </TaskSheet>
  );
}
