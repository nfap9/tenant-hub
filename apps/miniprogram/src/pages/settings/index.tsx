import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { Button, Card, EmptyState, Badge } from '../../components/ui';
import './index.scss';

export default function SettingsPage() {
  const {
    session,
    memberships,
    currentOrgId,
    currentMembership,
    setCurrentOrgId,
    signOut,
    reload,
    platformInfo,
    quotaLimitEnabled,
  } = useAppSession();

  usePullDownRefresh(() => {
    reload().finally(() => Taro.stopPullDownRefresh());
  });

  const goTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  if (memberships.length === 0) {
    return (
      <View className="page-container">
        <Card title="账号信息">
          <View className="profile-row">
            <View className="profile-avatar">
              <Text className="profile-avatar__text">
                {session?.user.username?.slice(0, 1) || '用'}
              </Text>
            </View>
            <View className="profile-main">
              <Text className="profile-name">{session?.user.username}</Text>
              <Text className="profile-phone">{session?.user.phone}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <EmptyState
            icon="apartment"
            title="还没有组织"
            subtitle={`创建或加入一个组织，开始使用 ${platformInfo.name}`}
          />
        </Card>

        <Card title="功能入口" padding="sm">
          <View
            className="settings-link"
            onClick={() => goTo('/pages/settings/organization')}
          >
            <View>
              <Text className="card-title">创建组织</Text>
              <Text className="text-muted">新建自己的公寓管理空间</Text>
            </View>
          </View>
          <View
            className="settings-link"
            onClick={() => goTo('/pages/settings/organization')}
          >
            <View>
              <Text className="card-title">加入组织</Text>
              <Text className="text-muted">使用邀请码加入已有团队</Text>
            </View>
          </View>
          <View
            className="settings-link"
            onClick={() => goTo('/pages/settings/account')}
          >
            <View>
              <Text className="card-title">账号设置</Text>
              <Text className="text-muted">修改密码和登录信息</Text>
            </View>
          </View>
        </Card>

        <Button variant="danger" onClick={signOut}>
          退出登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card title="账号信息">
        <View className="profile-row">
          <View className="profile-avatar">
            <Text className="profile-avatar__text">
              {session?.user.username?.slice(0, 1) || '用'}
            </Text>
          </View>
          <View className="profile-main">
            <Text className="profile-name">{session?.user.username}</Text>
            <Text className="profile-phone">{session?.user.phone}</Text>
          </View>
        </View>
        <View className="profile-meta">
          <View className="profile-meta__item">
            <Text className="text-muted">当前组织</Text>
            <Text className="card-title">
              {currentMembership?.organization.name}
            </Text>
          </View>
          <View className="profile-meta__item">
            <Text className="text-muted">角色</Text>
            <Badge tone="primary">{currentMembership?.role.name}</Badge>
          </View>
        </View>
      </Card>

      {memberships.length > 1 ? (
        <Card title="切换组织" padding="sm">
          <View className="segment">
            {memberships.map((m) => (
              <View
                key={m.organization.id}
                className={`segment-item ${currentOrgId === m.organization.id ? 'segment-item--active' : ''}`}
                onClick={() => setCurrentOrgId(m.organization.id)}
              >
                <Text
                  className={`segment-text ${currentOrgId === m.organization.id ? 'segment-text--active' : ''}`}
                >
                  {m.organization.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card title="功能入口" padding="sm">
        <View
          className="settings-link"
          onClick={() => goTo('/pages/settings/leases')}
        >
          <View>
            <Text className="card-title">所有租约</Text>
            <Text className="text-muted">查看全部租约记录</Text>
          </View>
        </View>
        <View
          className="settings-link"
          onClick={() => goTo('/pages/settings/organization')}
        >
          <View>
            <Text className="card-title">组织管理</Text>
            <Text className="text-muted">组织信息、成员和权限</Text>
          </View>
        </View>
        <View
          className="settings-link"
          onClick={() => goTo('/pages/settings/account')}
        >
          <View>
            <Text className="card-title">账号设置</Text>
            <Text className="text-muted">修改密码和登录信息</Text>
          </View>
        </View>
        {quotaLimitEnabled ? (
          <View
            className="settings-link"
            onClick={() => goTo('/pages/settings/plan')}
          >
            <View>
              <Text className="card-title">套餐与付费</Text>
              <Text className="text-muted">查看当前套餐和用量</Text>
            </View>
          </View>
        ) : null}
      </Card>

      <Button
        variant="danger"
        onClick={() => {
          signOut();
          Taro.reLaunch({ url: '/pages/login/index' });
        }}
      >
        退出登录
      </Button>
    </View>
  );
}
