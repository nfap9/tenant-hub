import { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import { Button, Input } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';

interface BillItemEdit {
  id: string;
  billId: string;
  name: string;
  amount: number;
  note?: string;
}

interface EditBillItemSheetProps {
  visible: boolean;
  item: BillItemEdit | undefined;
  onSubmit: (billId: string, itemId: string, amount: string, note: string) => Promise<void> | void;
  onClose: () => void;
}

export function EditBillItemSheet({ visible, item, onSubmit, onClose }: EditBillItemSheetProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setAmount(String(item.amount));
      setNote(item.note ?? "");
    }
  }, [item]);

  const handleSubmit = async () => {
    if (!item) return;
    setSubmitting(true);
    try {
      await onSubmit(item.billId, item.id, amount, note);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible && !!item}
      title={item ? `修改 ${item.name}` : "修改账单项目"}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" size="small" onClick={onClose}>取消</Button>
          <Button size="small" loading={submitting} disabled={submitting} onClick={handleSubmit}>保存</Button>
        </>
      )}
    >
      {item ? (
        <View style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <View>
            <Input label="金额" value={amount} onChange={setAmount} type="digit" placeholder="输入金额" />
          </View>
          <View>
            <Input label="备注" value={note} onChange={setNote} placeholder="备注（可选）" />
          </View>
        </View>
      ) : null}
    </TaskSheet>
  );
}
