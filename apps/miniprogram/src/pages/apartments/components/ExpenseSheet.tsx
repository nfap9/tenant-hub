import { useState } from 'react';
import { View } from '@tarojs/components';
import { Button, Input, DateField } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';

interface ExpenseSheetProps {
  visible: boolean;
  onSave: (expense: { name: string; amount: string; spentAt: string; note: string }) => Promise<void> | void;
  onClose: () => void;
}

export function ExpenseSheet({ visible, onSave, onClose }: ExpenseSheetProps) {
  const [expense, setExpense] = useState({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(expense);
      setExpense({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      title="记录花费"
      onClose={onClose}
      footer={(
        <>
          <Button loading={saving} disabled={saving} onClick={handleSave}>保存花费</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <View className="form-grid">
        <Input label="花费名称" placeholder="例如 维修材料" value={expense.name} onChange={(value) => setExpense((old) => ({ ...old, name: value }))} />
        <Input label="金额" placeholder="请输入金额" type="number" value={expense.amount} onChange={(value) => setExpense((old) => ({ ...old, amount: value }))} />
        <DateField label="日期" placeholder="选择日期" value={expense.spentAt} onChange={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
      </View>
      <Input label="备注" placeholder="可选" value={expense.note} onChange={(value) => setExpense((old) => ({ ...old, note: value }))} />
    </TaskSheet>
  );
}
