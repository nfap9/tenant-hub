import { useState } from 'react';
import { Text } from '@tarojs/components';
import { Button } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';

interface DeleteConfirmSheetProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function DeleteConfirmSheet({ visible, title, description, confirmText = "确认删除", onConfirm, onClose }: DeleteConfirmSheetProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      variant="dialog"
      title={title}
      onClose={onClose}
      footer={(
        <>
          <Button variant="danger" size="small" loading={deleting} disabled={deleting} onClick={handleConfirm}>{confirmText}</Button>
          <Button variant="ghost" size="small" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <Text className="text-muted">{description}</Text>
    </TaskSheet>
  );
}
