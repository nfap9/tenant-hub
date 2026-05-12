import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function RoomsPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="🛏️"
        title="房间管理"
        subtitle="这里将展示房间列表和租约管理功能"
      />
    </View>
  );
}
