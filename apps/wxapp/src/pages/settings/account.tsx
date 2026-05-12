import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function AccountPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="🔐"
        title="账号设置"
        subtitle="这里将展示密码修改功能"
      />
    </View>
  );
}
