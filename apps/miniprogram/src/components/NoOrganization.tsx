import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Card, EmptyState, Button } from './ui';

export function NoOrganization() {
  return (
    <View className="page-container">
      <Card>
        <EmptyState
          icon="apartment"
          title="还没有组织"
          subtitle="创建或加入一个组织后，即可开始管理公寓"
        />
        <View
          style={{
            display: 'flex',
            gap: 'var(--spacing-3)',
            marginTop: 'var(--spacing-4)',
          }}
        >
          <Button
            variant="secondary"
            onClick={() => Taro.switchTab({ url: '/pages/settings/index' })}
          >
            去创建组织
          </Button>
        </View>
      </Card>
    </View>
  );
}
