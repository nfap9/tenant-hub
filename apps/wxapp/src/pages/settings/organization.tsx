import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function OrganizationPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="👥"
        title="团队管理"
        subtitle="这里将展示组织信息和成员管理"
      />
    </View>
  );
}
