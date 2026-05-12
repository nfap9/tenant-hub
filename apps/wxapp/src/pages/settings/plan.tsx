import { View } from '@tarojs/components';
import { EmptyState } from '../../components/ui';

export default function PlanPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <EmptyState
        emoji="💎"
        title="付费计划"
        subtitle="这里将展示套餐购买和用量"
      />
    </View>
  );
}
