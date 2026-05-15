import { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';
import type { OrgInvite } from '../../types/domain';
import './index.scss';

export default function SettingsPage() {
  const { session, memberships, currentOrgId, currentMembership, setCurrentOrgId, members, roles, signOut, reload, platformInfo } = useAppSession();
  const canManageOrg = useHasPermission("org:manage");
  const canManageMember = useHasPermission("member:manage");

  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const loadInvites = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<OrgInvite[]>(`/organizations/${currentOrgId}/invites`, { organizationId: currentOrgId });
      setInvites(data);
    } catch (e) {
      // ignore
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadInvites();
  });

  usePullDownRefresh(() => {
    Promise.all([reload(), loadInvites()]).finally(() => Taro.stopPullDownRefresh());
  });

  const createInvite = async () => {
    if (!currentOrgId) return;
    if (!canManageMember) return Taro.showToast({ title: "没有管理成员权限", icon: "none" });
    try {
      await apiClient(`/organizations/${currentOrgId}/invites`, {
        method: "POST",
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "邀请码已创建", icon: "success" });
      setShowInviteForm(false);
      await loadInvites();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "创建失败", icon: "none" });
    }
  };

  const copyInviteCode = (code: string) => {
    Taro.setClipboardData({ data: code });
  };

  const createOrganization = async () => {
    if (!orgName.trim()) {
      Taro.showToast({ title: "请输入组织名称", icon: "none" });
      return;
    }
    try {
      await apiClient('/organizations', {
        method: 'POST',
        body: { name: orgName.trim(), description: orgDescription.trim() || undefined }
      });
      Taro.showToast({ title: '组织创建成功', icon: 'success' });
      setShowCreateOrg(false);
      setOrgName('');
      setOrgDescription('');
      await reload();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '创建失败', icon: 'none' });
    }
  };

  const joinOrganization = async () => {
    if (!inviteCode.trim()) {
      Taro.showToast({ title: "请输入邀请码", icon: "none" });
      return;
    }
    try {
      await apiClient('/organizations/join', {
        method: 'POST',
        body: { inviteCode: inviteCode.trim() }
      });
      Taro.showToast({ title: '加入组织成功', icon: 'success' });
      setShowJoinOrg(false);
      setInviteCode('');
      await reload();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '加入失败', icon: 'none' });
    }
  };

  // 无组织引导
  if (memberships.length === 0) {
    return (
      <View className="page-container">
        <Card>
          <EmptyState icon="apartment" title="还没有组织" subtitle={`创建或加入一个组织，开始使用 ${platformInfo.name}`} />
        </Card>

        <Card title="创建组织">
          <View style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <Input
              label="组织名称"
              value={orgName}
              onChange={setOrgName}
              placeholder="例如：阳光公寓"
            />
            <Input
              label="组织描述（可选）"
              value={orgDescription}
              onChange={setOrgDescription}
              placeholder="简要描述你的组织"
            />
            <Button onClick={createOrganization}>创建组织</Button>
          </View>
        </Card>

        <Card title="加入组织">
          <View style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <Input
              label="邀请码"
              value={inviteCode}
              onChange={setInviteCode}
              placeholder="请输入 8 位邀请码"
            />
            <Button variant="secondary" onClick={joinOrganization}>加入组织</Button>
          </View>
        </Card>

        <Button variant="danger" onClick={signOut}>退出登录</Button>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card title="账号信息">
        <View className="detail-row">
          <Text className="text-muted">用户名</Text>
          <Text className="card-title">{session?.user.username}</Text>
        </View>
        <View className="detail-row">
          <Text className="text-muted">手机号</Text>
          <Text className="card-title">{session?.user.phone}</Text>
        </View>
      </Card>

      <Card title="当前组织" subtitle={currentMembership?.organization.name}>
        {memberships.length > 1 ? (
          <View className="segment">
            {memberships.map((m) => (
              <View key={m.organization.id} className={`segment-item ${currentOrgId === m.organization.id ? 'segment-item--active' : ''}`} onClick={() => setCurrentOrgId(m.organization.id)}>
                <Text className={`segment-text ${currentOrgId === m.organization.id ? 'segment-text--active' : ''}`}>{m.organization.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="detail-row">
          <Text className="text-muted">角色</Text>
          <Badge tone="primary">{currentMembership?.role.name}</Badge>
        </View>
        <View className="detail-row">
          <Text className="text-muted">权限</Text>
          <Text className="text-muted">{currentMembership?.role.permissions.length} 项</Text>
        </View>
        <View style={{ marginTop: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-3)' }}>
          <Button variant="secondary" size="small" onClick={() => setShowCreateOrg(true)}>创建组织</Button>
          <Button variant="ghost" size="small" onClick={() => setShowJoinOrg(true)}>加入组织</Button>
        </View>

        {showCreateOrg && (
          <View className="form-panel" style={{ marginTop: 'var(--spacing-4)' }}>
            <Input label="组织名称" value={orgName} onChange={setOrgName} placeholder="例如：阳光公寓" />
            <Input label="组织描述（可选）" value={orgDescription} onChange={setOrgDescription} placeholder="简要描述你的组织" />
            <View className="action-row">
              <Button size="small" onClick={createOrganization}>创建</Button>
              <Button variant="ghost" size="small" onClick={() => { setShowCreateOrg(false); setOrgName(''); setOrgDescription(''); }}>取消</Button>
            </View>
          </View>
        )}

        {showJoinOrg && (
          <View className="form-panel" style={{ marginTop: 'var(--spacing-4)' }}>
            <Input label="邀请码" value={inviteCode} onChange={setInviteCode} placeholder="请输入 8 位邀请码" />
            <View className="action-row">
              <Button size="small" onClick={joinOrganization}>加入</Button>
              <Button variant="ghost" size="small" onClick={() => { setShowJoinOrg(false); setInviteCode(''); }}>取消</Button>
            </View>
          </View>
        )}
      </Card>

      <Card title="组织成员" subtitle={`共 ${members.length} 人`}>
        {members.map((member) => (
          <View key={member.id} className="detail-row">
            <Text className="card-title">{member.user.username}</Text>
            <View className="action-row-inline">
              <Text className="text-muted">{member.user.phone}</Text>
              <Badge tone="neutral">{member.role.name}</Badge>
            </View>
          </View>
        ))}
        {members.length === 0 ? <Text className="text-muted">暂无成员</Text> : null}
      </Card>

      <Card title="邀请码" headerAction={canManageMember ? <Button variant="secondary" size="small" onClick={() => setShowInviteForm(!showInviteForm)}>创建邀请</Button> : undefined}>
        {showInviteForm && canManageMember ? (
          <View className="form-panel">
            <View className="action-row">
              <Button size="small" onClick={createInvite}>生成邀请码</Button>
              <Button variant="ghost" size="small" onClick={() => setShowInviteForm(false)}>取消</Button>
            </View>
          </View>
        ) : null}
        {invites.map((invite) => (
          <View key={invite.id} className="detail-row">
            <Text className="card-title" onClick={() => copyInviteCode(invite.code)}>{invite.code}</Text>
            <Text className="text-muted">{invite.usedCount}/{invite.maxUses} 次</Text>
          </View>
        ))}
        {invites.length === 0 ? <Text className="text-muted">暂无邀请码</Text> : null}
      </Card>

      <Card title="更多设置">
        <View className="settings-link" onClick={() => Taro.navigateTo({ url: '/pages/settings/leases' })}>
          <Text className="card-title">所有租约</Text>
          <Text className="text-muted">查看全部租约记录</Text>
        </View>
        <View className="settings-link" onClick={() => Taro.navigateTo({ url: '/pages/settings/organization' })}>
          <Text className="card-title">组织管理</Text>
          <Text className="text-muted">管理组织信息和成员权限</Text>
        </View>
        <View className="settings-link" onClick={() => Taro.navigateTo({ url: '/pages/settings/account' })}>
          <Text className="card-title">账号设置</Text>
          <Text className="text-muted">修改密码和登录信息</Text>
        </View>
        <View className="settings-link" onClick={() => Taro.navigateTo({ url: '/pages/settings/plan' })}>
          <Text className="card-title">套餐与付费</Text>
          <Text className="text-muted">查看当前套餐和用量</Text>
        </View>
      </Card>

      <Button variant="danger" onClick={() => {
        signOut();
        Taro.reLaunch({ url: '/pages/login/index' });
      }}>退出登录</Button>
    </View>
  );
}
