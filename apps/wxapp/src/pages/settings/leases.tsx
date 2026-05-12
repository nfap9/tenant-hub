import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function LeasesPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="📋"
        title="所有租约"
        subtitle="这里将展示全部租约列表"
      />
    </View>
  );
}
