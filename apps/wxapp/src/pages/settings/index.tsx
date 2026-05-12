import { View, Text } from '@tarojs/components';
import { navigateTo } from '@tarojs/taro';

const menuItems = [
  { key: 'leases', label: '所有租约', path: '/pages/settings/leases' },
  { key: 'organization', label: '团队管理', path: '/pages/settings/organization' },
  { key: 'account', label: '账号设置', path: '/pages/settings/account' },
  { key: 'plan', label: '付费计划', path: '/pages/settings/plan' }
];

export default function SettingsPage() {
  return (
    <View style={{ padding: 'var(--spacing-4)' }}>
      {menuItems.map((item) => (
        <View
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-5) var(--spacing-4)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-3)',
            boxShadow: 'var(--shadow-card)'
          }}
          onClick={() => navigateTo({ url: item.path })}
        >
          <Text style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text)' }}>
            {item.label}
          </Text>
          <Text style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-placeholder)' }}>
            ›
          </Text>
        </View>
      ))}
    </View>
  );
}
