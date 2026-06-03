import { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import {
  updateOrganization,
  updateMemberRole as apiUpdateMemberRole,
  removeMember as apiRemoveMember,
  transferOwnership as apiTransferOwnership,
  createOrganization as apiCreateOrganization,
  joinOrganization as apiJoinOrganization,
  refreshInviteCode,
} from '../../api/organization';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';
import { TaskSheet } from '../../components/TaskSheet';
import type { OrgMember, OrgRole } from '../../types/domain';
import './index.scss';

export default function OrganizationPage() {
  const { currentOrgId, members, roles, currentMembership, reload } =
    useAppSession();
  const canManageOrg = useHasPermission('org:manage');
  const canManageMember = useHasPermission('member:manage');

  const [orgName, setOrgName] = useState('');
  const [editingMemberId, setEditingMemberId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferPhone, setTransferPhone] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useDidShow(() => {
    if (currentMembership?.organization.name) {
      setOrgName(currentMembership.organization.name);
    }
  });

  usePullDownRefresh(() => {
    reload().finally(() => Taro.stopPullDownRefresh());
  });

  const updateOrgName = async () => {
    if (!currentOrgId || !orgName.trim()) return;
    if (!canManageOrg)
      return Taro.showToast({ title: '没有管理组织权限', icon: 'none' });
    try {
      await updateOrganization(currentOrgId, { name: orgName.trim() });
      Taro.showToast({ title: '组织名称已更新', icon: 'success' });
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '更新失败',
        icon: 'none',
      });
    }
  };

  const updateMemberRole = async (memberId: string) => {
    if (!currentOrgId || !selectedRoleId) return;
    if (!canManageMember)
      return Taro.showToast({ title: '没有管理成员权限', icon: 'none' });
    try {
      await apiUpdateMemberRole(currentOrgId, memberId, selectedRoleId);
      Taro.showToast({ title: '角色已更新', icon: 'success' });
      setEditingMemberId('');
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '更新失败',
        icon: 'none',
      });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!currentOrgId) return;
    if (!canManageMember)
      return Taro.showToast({ title: '没有管理成员权限', icon: 'none' });
    try {
      await apiRemoveMember(currentOrgId, memberId);
      Taro.showToast({ title: '成员已移除', icon: 'success' });
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '移除失败',
        icon: 'none',
      });
    }
  };

  const transferOwnership = async (userId: string) => {
    if (!currentOrgId || !userId) return;
    if (!canManageOrg)
      return Taro.showToast({ title: '没有管理组织权限', icon: 'none' });
    try {
      await apiTransferOwnership(currentOrgId, userId);
      Taro.showToast({ title: '所有权已转移', icon: 'success' });
      setShowTransferForm(false);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '转移失败',
        icon: 'none',
      });
    }
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) {
      Taro.showToast({ title: '请输入组织名称', icon: 'none' });
      return;
    }
    try {
      await apiCreateOrganization({
        name: newOrgName.trim(),
        description: newOrgDescription.trim() || undefined,
      });
      Taro.showToast({ title: '组织创建成功', icon: 'success' });
      setNewOrgName('');
      setNewOrgDescription('');
      await reload();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '创建失败',
        icon: 'none',
      });
    }
  };

  const joinOrganization = async () => {
    if (!inviteCode.trim()) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    try {
      await apiJoinOrganization({ inviteCode: inviteCode.trim() });
      Taro.showToast({ title: '加入组织成功', icon: 'success' });
      setInviteCode('');
      await reload();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加入失败',
        icon: 'none',
      });
    }
  };

  if (!currentOrgId) {
    return (
      <View className="page-container">
        <Card>
          <EmptyState
            icon="apartment"
            title="还没有组织"
            subtitle="创建或加入一个组织后即可开始管理公寓"
          />
        </Card>

        <Card title="创建组织">
          <Input
            label="组织名称"
            value={newOrgName}
            onChange={setNewOrgName}
            placeholder="例如：阳光公寓"
          />
          <Input
            label="组织描述（可选）"
            value={newOrgDescription}
            onChange={setNewOrgDescription}
            placeholder="简要描述你的组织"
          />
          <Button onClick={createOrganization}>创建组织</Button>
        </Card>

        <Card title="加入组织">
          <Input
            label="邀请码"
            value={inviteCode}
            onChange={setInviteCode}
            placeholder="请输入 8 位邀请码"
          />
          <Button variant="secondary" onClick={joinOrganization}>
            加入组织
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card title="组织信息">
        <Input
          label="组织名称"
          placeholder="请输入组织名称"
          value={orgName}
          onChange={setOrgName}
        />
        {canManageOrg ? (
          <Button size="small" onClick={updateOrgName}>
            更新名称
          </Button>
        ) : null}
      </Card>

      <Card title="成员管理" subtitle={`共 ${members.length} 人`}>
        {members.map((member) => (
          <View key={member.id} className="member-row">
            <View className="detail-row">
              <View>
                <Text className="card-title">{member.user.username}</Text>
                <Text className="text-muted">{member.user.phone}</Text>
              </View>
              <Badge tone="neutral">{member.role.name}</Badge>
            </View>
            {canManageMember &&
            member.userId !== currentMembership?.organization.ownerId ? (
              <View className="action-row-inline">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setEditingMemberId(member.id);
                    setSelectedRoleId(member.roleId);
                  }}
                >
                  修改角色
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() =>
                    Taro.showModal({
                      title: '移除成员',
                      content: `确认移除 ${member.user.username}？`,
                      confirmText: '确认移除',
                      confirmColor: '#c2413d',
                    }).then((res) => {
                      if (res.confirm) removeMember(member.id);
                    })
                  }
                >
                  移除
                </Button>
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <TaskSheet
        visible={!!editingMemberId}
        title="修改成员角色"
        onClose={() => setEditingMemberId('')}
        footer={
          <>
            <Button
              size="small"
              onClick={() => updateMemberRole(editingMemberId)}
            >
              保存
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setEditingMemberId('')}
            >
              取消
            </Button>
          </>
        }
      >
        <Text className="field-label">选择新角色</Text>
        <View className="segment">
          {roles.map((role) => (
            <View
              key={role.id}
              className={`segment-item ${selectedRoleId === role.id ? 'segment-item--active' : ''}`}
              onClick={() => setSelectedRoleId(role.id)}
            >
              <Text
                className={`segment-text ${selectedRoleId === role.id ? 'segment-text--active' : ''}`}
              >
                {role.name}
              </Text>
            </View>
          ))}
        </View>
      </TaskSheet>

      {canManageOrg ? (
        <Card title="转移所有权">
          <Button
            variant="danger"
            size="small"
            onClick={() => setShowTransferForm(true)}
          >
            转移所有权
          </Button>
        </Card>
      ) : null}

      <TaskSheet
        visible={showTransferForm}
        variant="dialog"
        title="转移所有权"
        onClose={() => setShowTransferForm(false)}
        footer={
          <Button
            variant="ghost"
            size="small"
            onClick={() => setShowTransferForm(false)}
          >
            取消
          </Button>
        }
      >
        {members
          .filter((m) => m.userId !== currentMembership?.organization.ownerId)
          .map((m) => (
            <View
              key={m.id}
              className="detail-row"
              onClick={() => transferOwnership(m.userId)}
            >
              <Text className="card-title">{m.user.username}</Text>
              <Text className="text-muted">{m.user.phone}</Text>
            </View>
          ))}
      </TaskSheet>
    </View>
  );
}
