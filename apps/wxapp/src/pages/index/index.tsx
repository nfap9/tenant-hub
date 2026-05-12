import { View, Text } from '@tarojs/components';
import { Card, Badge, Button } from '../../components/ui';

export default function HomePage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      <Card title="经营概览" subtitle="本月数据">
        <View style={{ display: 'flex', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 'var(--font-size-metric)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
              ¥12,500
            </Text>
            <Text style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>
              本月预估收入
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 'var(--font-size-metric)', fontWeight: 'bold', color: 'var(--color-success)' }}>
              ¥8,200
            </Text>
            <Text style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>
              已收金额
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ marginTop: 'var(--spacing-4)' }}>
        <Badge tone="warning">3 条待办</Badge>
        <Badge tone="danger" style={{ marginLeft: 'var(--spacing-3)' }}>2 笔逾期</Badge>
      </View>

      <View style={{ marginTop: 'var(--spacing-6)' }}>
        <Button onClick={() => console.log('登记收款')}>登记收款</Button>
      </View>
    </View>
  );
}
