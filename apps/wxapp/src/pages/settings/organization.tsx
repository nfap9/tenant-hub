import { useState, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge } from '../../components/ui';
import type { OrgMember, OrgRole } from '../../types/domain';
import './index.scss';

export default function OrganizationPage() {
  const { currentOrgId, members, roles, currentMembership, reload } = useAppSession();
  const canManageOrg = useHasPermission("org:manage");
  const canManageMember = useHasPermission("member:manage");

  const [orgName, setOrgName] = useState("");
  const [editingMemberId, setEditingMemberId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferPhone, setTransferPhone] = useState("");

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
    if (!canManageOrg) return Taro.showToast({ title: "没有管理组织权限", icon: "none" });
    try {
      await apiClient(`/organizations/${currentOrgId}`, { method: "PUT", body: { name: orgName.trim() }, organizationId: currentOrgId });
      Taro.showToast({ title: "组织名称已更新", icon: "success" });
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新失败", icon: "none" });
    }
  };

  const updateMemberRole = async (memberId: string) => {
    if (!currentOrgId || !selectedRoleId) return;
    if (!canManageMember) return Taro.showToast({ title: "没有管理成员权限", icon: "none" });
    try {
      await apiClient(`/organizations/${currentOrgId}/members/${memberId}/role`, { method: "PUT", body: { roleId: selectedRoleId }, organizationId: currentOrgId });
      Taro.showToast({ title: "角色已更新", icon: "success" });
      setEditingMemberId("");
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新失败", icon: "none" });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!currentOrgId) return;
    if (!canManageMember) return Taro.showToast({ title: "没有管理成员权限", icon: "none" });
    try {
      await apiClient(`/organizations/${currentOrgId}/members/${memberId}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "成员已移除", icon: "success" });
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "移除失败", icon: "none" });
    }
  };

  const transferOwnership = async (userId: string) => {
    if (!currentOrgId || !userId) return;
    if (!canManageOrg) return Taro.showToast({ title: "没有管理组织权限", icon: "none" });
    try {
      await apiClient(`/organizations/${currentOrgId}/transfer-owner`, { method: "POST", body: { userId }, organizationId: currentOrgId });
      Taro.showToast({ title: "所有权已转移", icon: "success" });
      setShowTransferForm(false);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "转移失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return (
      <View className="page-container">
        <Card><EmptyState emoji="🏢" title="尚未选择组织" subtitle="请先从更多页中选择一个组织" /></Card>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card title="组织信息">
        <Text className="field-label">组织名称</Text>
        <Input placeholder="组织名称" value={orgName} onInput={(e) => setOrgName(e.detail.value)} />
        {canManageOrg ? <Button size="small" onClick={updateOrgName}>更新名称</Button> : null}
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
            {canManageMember && member.userId !== currentMembership?.organization.ownerId ? (
              <View className="action-row-inline">
                <Button variant="secondary" size="small" onClick={() => { setEditingMemberId(member.id); setSelectedRoleId(member.roleId); }}>修改角色</Button>
                <Button variant="danger" size="small" onClick={() => removeMember(member.id)}>移除</Button>
              </View>
            ) : null}
            {editingMemberId === member.id ? (
              <View className="form-panel">
                <Text className="field-label">选择新角色</Text>
                <View className="segment">
                  {roles.map((role) => (
                    <View key={role.id} className={`segment-item ${selectedRoleId === role.id ? 'segment-item--active' : ''}`} onClick={() => setSelectedRoleId(role.id)}>
                      <Text className={`segment-text ${selectedRoleId === role.id ? 'segment-text--active' : ''}`}>{role.name}</Text>
                    </View>
                  ))}
                </View>
                <View className="action-row-inline">
                  <Button size="small" onClick={() => updateMemberRole(member.id)}>保存</Button>
                  <Button variant="ghost" size="small" onClick={() => setEditingMemberId("")}>取消</Button>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      {canManageOrg ? (
        <Card title="转移所有权">
          {showTransferForm ? (
            <>
              <Text className="field-label">选择新所有者</Text>
              {members.filter((m) => m.userId !== currentMembership?.organization.ownerId).map((m) => (
                <View key={m.id} className="detail-row" onClick={() => transferOwnership(m.userId)}>
                  <Text className="card-title">{m.user.username}</Text>
                  <Text className="text-muted">{m.user.phone}</Text>
                </View>
              ))}
              <Button variant="ghost" size="small" onClick={() => setShowTransferForm(false)}>取消</Button>
            </>
          ) : (
            <Button variant="danger" size="small" onClick={() => setShowTransferForm(true)}>转移所有权</Button>
          )}
        </Card>
      ) : null}
    </View>
  );
}
