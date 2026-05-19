import { Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';

interface UtilityExportSheetProps {
  visible: boolean;
  csv: string;
  onClose: () => void;
}

export function UtilityExportSheet({ visible, csv, onClose }: UtilityExportSheetProps) {
  return (
    <TaskSheet
      visible={visible}
      title="导出水电读数模板"
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={() => { Taro.setClipboardData({ data: csv }); }}>复制到剪贴板</Button>
          <Button variant="ghost" onClick={onClose}>关闭</Button>
        </>
      )}
    >
      <Text className="text-muted" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{csv}</Text>
    </TaskSheet>
  );
}
