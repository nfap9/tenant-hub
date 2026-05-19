import { useState } from 'react';
import { Button, Input } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';

interface UtilityImportSheetProps {
  visible: boolean;
  onSubmit: (csv: string) => Promise<void> | void;
  onClose: () => void;
}

export function UtilityImportSheet({ visible, onSubmit, onClose }: UtilityImportSheetProps) {
  const [csv, setCsv] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!csv.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(csv);
      setCsv("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      title="导入水电读数"
      onClose={onClose}
      footer={(
        <>
          <Button loading={submitting} disabled={submitting} onClick={handleSubmit}>确认导入</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <Input label="CSV 内容" placeholder="粘贴 CSV 内容" value={csv} onChange={setCsv} />
    </TaskSheet>
  );
}
