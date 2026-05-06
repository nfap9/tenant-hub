import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Membership, OrgInvite, OrgMember, OrgRole } from "../../types";

type OrganizationSettingsSubPageProps = {
  token: string;
  currentUserId: string;
  memberships: Membership[];
  currentMembership?: Membership;
  currentOrgId?: string;
  setCurrentOrgId: (value: string) => void;
  members: OrgMember[];
  roles: OrgRole[];
  orgName: string;
  setOrgName: (value: string) => void;
  setNotice: (value: string) => void;
  reload: () => Promise<void>;
  onBack: () => void;
};

export default function OrganizationSettingsSubPage({
  token,
  currentUserId,
  memberships,
  currentMembership,
  currentOrgId,
  setCurrentOrgId,
  members,
  roles,
  orgName,
  setOrgName,
  setNotice,
  reload,
  onBack
}: OrganizationSettingsSubPageProps) {
  const [orgDescription, setOrgDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [onboardingAction, setOnboardingAction] = useState<"create" | "join">();
  const [editingOrg, setEditingOrg] = useState(false);
  const [activeRoleMemberId, setActiveRoleMemberId] = useState<string>();
  const [editName, setEditName] = useState(currentMembership?.organization.name ?? "");
  const [editDescription, setEditDescription] = useState(currentMembership?.organization.description ?? "");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const canManageMembers = currentMembership?.role.permissions.includes("*") || currentMembership?.role.permissions.includes("member:manage");
  const canManageOrg = currentMembership?.role.permissions.includes("*") || currentMembership?.role.permissions.includes("org:manage");
  const managerRoles = roles.filter((role) => role.code !== "owner");
  const roleEditingMember = members.find((member) => member.id === activeRoleMemberId);
  const inviteAvailable = (invite: OrgInvite) => new Date(invite.expiresAt).getTime() > Date.now() && invite.usedCount < invite.maxUses;

  useEffect(() => {
    setEditName(currentMembership?.organization.name ?? "");
    setEditDescription(currentMembership?.organization.description ?? "");
    setEditingOrg(false);
    setActiveRoleMemberId(undefined);
    setOnboardingAction(undefined);
    setDeleteConfirmName("");
  }, [currentMembership?.organization.id]);

  const run = async (fn: () => Promise<void>, success: string) => {
    try {
      await fn();
      setNotice(success);
      await reload();
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const loadInvites = async () => {
    if (!currentOrgId || !canManageMembers) {
      setInvites([]);
      return;
    }
    try {
      const data = await mobileApi<OrgInvite[]>(`/organizations/${currentOrgId}/invites`, token, {
        headers: { "x-organization-id": currentOrgId }
      });
      setInvites(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "邀请码加载失败");
    }
  };

  useEffect(() => {
    loadInvites();
  }, [currentOrgId, canManageMembers]);

  return (
    <>
      <View style={styles.subPageHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>
      </View>

      {memberships.length === 0 ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>团队管理</Text>
            <Text style={styles.muted}>首次使用需要先创建组织，或输入管理员生成的邀请码加入已有团队。</Text>
            {!onboardingAction ? (
              <>
                <TouchableOpacity style={styles.settingItem} onPress={() => setOnboardingAction("create")}>
                  <Text style={styles.settingItemText}>创建团队</Text>
                  <Text style={styles.link}>进入</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingItem} onPress={() => setOnboardingAction("join")}>
                  <Text style={styles.settingItemText}>加入团队</Text>
                  <Text style={styles.link}>进入</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {onboardingAction === "create" ? (
              <View style={styles.detailPanel}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>创建团队</Text>
                  <TouchableOpacity style={styles.smallButton} onPress={() => setOnboardingAction(undefined)}>
                    <Text style={styles.smallButtonText}>返回</Text>
                  </TouchableOpacity>
                </View>
                <TextInput value={orgName} onChangeText={setOrgName} style={styles.input} placeholder="组织名称" />
                <TextInput value={orgDescription} onChangeText={setOrgDescription} style={[styles.input, styles.textarea]} multiline placeholder="组织描述" />
                <TouchableOpacity
                  style={styles.button}
                  onPress={() =>
                    run(async () => {
                      const org = await mobileApi<{ id: string }>("/organizations", token, {
                        method: "POST",
                        body: JSON.stringify({ name: orgName, description: orgDescription })
                      });
                      setCurrentOrgId(org.id);
                      setOrgName("");
                      setOrgDescription("");
                      setOnboardingAction(undefined);
                    }, "组织已创建")
                  }
                >
                  <Text style={styles.buttonText}>创建组织</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {onboardingAction === "join" ? (
              <View style={styles.detailPanel}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>加入团队</Text>
                  <TouchableOpacity style={styles.smallButton} onPress={() => setOnboardingAction(undefined)}>
                    <Text style={styles.smallButtonText}>返回</Text>
                  </TouchableOpacity>
                </View>
                <TextInput value={inviteCode} onChangeText={setInviteCode} style={styles.input} placeholder="输入邀请码" autoCapitalize="characters" />
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    run(async () => {
                      const result = await mobileApi<{ organization: { id: string } }>("/organizations/join", token, {
                        method: "POST",
                        body: JSON.stringify({ inviteCode })
                      });
                      setCurrentOrgId(result.organization.id);
                      setInviteCode("");
                      setOnboardingAction(undefined);
                    }, "已加入组织")
                  }
                >
                  <Text style={styles.secondaryButtonText}>加入组织</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </>
      ) : null}
      {currentMembership && roleEditingMember ? (
        <>
          <View style={styles.subPageHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveRoleMemberId(undefined)}>
              <Text style={styles.backButtonText}>返回成员管理</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>调整成员角色</Text>
            <View style={styles.detailPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>成员</Text>
                <Text style={styles.cardTitle}>{roleEditingMember.user.username}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>手机号</Text>
                <Text style={styles.muted}>{roleEditingMember.user.phone}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>当前角色</Text>
                <Text style={styles.roleBadge}>{roleEditingMember.role.name}</Text>
              </View>
            </View>
            {managerRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[styles.feeItem, roleEditingMember.roleId === role.id && styles.feeItemActive]}
                onPress={() =>
                  run(async () => {
                    await mobileApi(`/organizations/${currentOrgId}/members/${roleEditingMember.id}/role`, token, {
                      method: "PUT",
                      headers: { "x-organization-id": currentOrgId! },
                      body: JSON.stringify({ roleId: role.id })
                    });
                    setActiveRoleMemberId(undefined);
                  }, "成员角色已更新")
                }
              >
                <Text style={styles.cardTitle}>{role.name}</Text>
                <Text style={roleEditingMember.roleId === role.id ? styles.cardStat : styles.muted}>
                  {roleEditingMember.roleId === role.id ? "当前" : "选择"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : currentMembership ? (
        <>
          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>组织信息</Text>
              {canManageOrg ? (
                <TouchableOpacity style={styles.smallButton} onPress={() => setEditingOrg((old) => !old)}>
                  <Text style={styles.smallButtonText}>{editingOrg ? "收起" : "编辑"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.detailPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>组织名称</Text>
                <Text style={styles.cardTitle}>{currentMembership.organization.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>组织编码</Text>
                <Text style={styles.cardStat}>{currentMembership.organization.code}</Text>
              </View>
              <Text style={styles.muted}>组织编码仅用于识别组织，不能直接加入团队。</Text>
              <View style={styles.detailRow}>
                <Text style={styles.muted}>组织描述</Text>
                <Text style={styles.muted}>{currentMembership.organization.description || "未填写"}</Text>
              </View>
            </View>
            {editingOrg ? (
              <View style={styles.detailPanel}>
                <Text style={styles.sectionTitle}>编辑组织信息</Text>
                <TextInput value={editName} onChangeText={setEditName} style={styles.input} placeholder="组织名称" />
                <TextInput value={editDescription} onChangeText={setEditDescription} style={[styles.input, styles.textarea]} multiline placeholder="组织描述" />
                <TouchableOpacity
                  style={styles.button}
                  onPress={() =>
                    run(async () => {
                      await mobileApi(`/organizations/${currentMembership.organization.id}`, token, {
                        method: "PUT",
                        headers: { "x-organization-id": currentMembership.organization.id },
                        body: JSON.stringify({ name: editName, description: editDescription })
                      });
                      setEditingOrg(false);
                    }, "组织信息已更新")
                  }
                >
                  <Text style={styles.buttonText}>保存组织信息</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {currentMembership.organization.ownerId === currentUserId ? (
              <View style={styles.detailPanel}>
                <Text style={styles.sectionTitle}>删除组织</Text>
                <Text style={styles.muted}>仅所有者可删除。请输入组织名称确认，存在有效订阅时不能删除。</Text>
                <TextInput value={deleteConfirmName} onChangeText={setDeleteConfirmName} style={styles.input} placeholder={currentMembership.organization.name} />
                <TouchableOpacity
                  style={styles.smallDangerButton}
                  onPress={() =>
                    run(async () => {
                      await mobileApi(`/organizations/${currentMembership.organization.id}`, token, {
                        method: "DELETE",
                        headers: { "x-organization-id": currentMembership.organization.id },
                        body: JSON.stringify({ confirmName: deleteConfirmName })
                      });
                      setDeleteConfirmName("");
                    }, "组织已删除")
                  }
                >
                  <Text style={styles.smallDangerText}>确认删除组织</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>成员管理</Text>
            {canManageMembers ? (
              <View style={styles.detailPanel}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>邀请成员</Text>
                    <Text style={styles.muted}>邀请码 24 小时有效且仅可使用一次。</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() =>
                      run(async () => {
                        const invite = await mobileApi<OrgInvite>(`/organizations/${currentOrgId}/invites`, token, {
                          method: "POST",
                          headers: { "x-organization-id": currentOrgId! },
                          body: JSON.stringify({ expiresInHours: 24 })
                        });
                        setInvites((old) => [invite, ...old]);
                      }, "邀请码已生成")
                    }
                  >
                    <Text style={styles.smallButtonText}>生成邀请码</Text>
                  </TouchableOpacity>
                </View>
                {invites.slice(0, 3).map((invite) => (
                  <View style={styles.detailRow} key={invite.id}>
                    <View>
                      <Text style={inviteAvailable(invite) ? styles.cardTitle : styles.muted}>{invite.code}</Text>
                      <Text style={styles.muted}>过期时间 {invite.expiresAt.slice(0, 16).replace("T", " ")}</Text>
                    </View>
                    <Text style={inviteAvailable(invite) ? styles.cardStat : styles.muted}>{inviteAvailable(invite) ? "可用" : "已失效"}</Text>
                  </View>
                ))}
                {invites.length === 0 ? <Text style={styles.muted}>暂无邀请码，点击生成后发给新成员。</Text> : null}
              </View>
            ) : null}
            {members.map((member) => (
              <View style={styles.memberCard} key={member.id}>
                <View style={styles.memberHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{member.user.username}</Text>
                    <Text style={styles.muted}>{member.user.phone}</Text>
                  </View>
                  <Text style={styles.roleBadge}>{member.role.name}</Text>
                </View>
                {canManageMembers && member.role.code !== "owner" ? (
                  <View style={styles.roleActions}>
                    <TouchableOpacity style={styles.smallButton} onPress={() => setActiveRoleMemberId(member.id)}>
                      <Text style={styles.smallButtonText}>调整角色</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() =>
                        run(async () => {
                          await mobileApi(`/organizations/${currentOrgId}/members/${member.id}`, token, {
                            method: "DELETE",
                            headers: { "x-organization-id": currentOrgId! }
                          });
                        }, "成员已移除")
                      }
                    >
                      <Text style={styles.smallDangerText}>移除</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {currentMembership.organization.ownerId === currentUserId && member.userId !== currentUserId ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() =>
                      run(async () => {
                        await mobileApi(`/organizations/${currentOrgId}/transfer-owner`, token, {
                          method: "POST",
                          headers: { "x-organization-id": currentOrgId! },
                          body: JSON.stringify({ userId: member.userId })
                        });
                      }, "所有者已转移")
                    }
                  >
                    <Text style={styles.secondaryButtonText}>转移所有者给该成员</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}
