import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function BillsPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="💰"
        title="账单中心"
        subtitle="这里将展示月度账单、收款和抄表功能"
      />
    </View>
  );
}
