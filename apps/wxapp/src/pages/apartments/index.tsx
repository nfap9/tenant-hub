import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function ApartmentsPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="🏢"
        title="公寓管理"
        subtitle="这里将展示公寓列表和房间管理功能"
      />
    </View>
  );
}
