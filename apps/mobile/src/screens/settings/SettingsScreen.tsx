import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Membership, OrgMember, OrgRole } from "../../types";

export default function SettingsScreen({
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
  reload
}: {
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
}) {
  const [subPage, setSubPage] = useState<"menu" | "team" | "account" | "plan">("menu");

  if (subPage === "team") {
    return (
      <OrgSubPage
        token={token}
        currentUserId={currentUserId}
        memberships={memberships}
        currentMembership={currentMembership}
        currentOrgId={currentOrgId}
        setCurrentOrgId={setCurrentOrgId}
        members={members}
        roles={roles}
        orgName={orgName}
        setOrgName={setOrgName}
        setNotice={setNotice}
        reload={reload}
        onBack={() => setSubPage("menu")}
      />
    );
  }

  if (subPage === "account") {
    return (
      <>
        <View style={styles.subPageHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSubPage("menu")}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
          </View>
        <View style={styles.panel}>
          <Text style={styles.muted}>账号设置功能开发中</Text>
        </View>
      </>
    );
  }

  if (subPage === "plan") {
    return (
      <>
        <View style={styles.subPageHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSubPage("menu")}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
          </View>
        <View style={styles.panel}>
          <Text style={styles.muted}>付费计划功能开发中</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("team")}>
        <Text style={styles.settingItemText}>团队管理</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("account")}>
        <Text style={styles.settingItemText}>账号设置</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.settingItem} onPress={() => setSubPage("plan")}>
        <Text style={styles.settingItemText}>付费计划</Text>
        <Text style={styles.link}>进入</Text>
      </TouchableOpacity>
    </>
  );
}

function OrgSubPage({
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
}: {
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
}) {
  const [orgDescription, setOrgDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [editName, setEditName] = useState(currentMembership?.organization.name ?? "");
  const [editDescription, setEditDescription] = useState(currentMembership?.organization.description ?? "");
  const canManageMembers = currentMembership?.role.permissions.includes("*") || currentMembership?.role.permissions.includes("member:manage");
  const canManageOrg = currentMembership?.role.permissions.includes("*") || currentMembership?.role.permissions.includes("org:manage");
  const managerRoles = roles.filter((role) => role.code !== "owner");

  useEffect(() => {
    setEditName(currentMembership?.organization.name ?? "");
    setEditDescription(currentMembership?.organization.description ?? "");
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
            <Text style={styles.sectionTitle}>创建组织</Text>
            <Text style={styles.muted}>首次使用需要先创建组织，或输入组织编码加入已有团队。</Text>
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
                }, "组织已创建")
              }
            >
              <Text style={styles.buttonText}>创建组织</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>加入组织</Text>
            <TextInput value={joinCode} onChangeText={setJoinCode} style={styles.input} placeholder="输入组织编码" />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                run(async () => {
                  const result = await mobileApi<{ organization: { id: string } }>("/organizations/join", token, {
                    method: "POST",
                    body: JSON.stringify({ code: joinCode })
                  });
                  setCurrentOrgId(result.organization.id);
                  setJoinCode("");
                }, "已加入组织")
              }
            >
              <Text style={styles.secondaryButtonText}>加入组织</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
      {currentMembership ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>组织信息</Text>
            <Text style={styles.muted}>组织编码 {currentMembership.organization.code}</Text>
            <TextInput value={editName} onChangeText={setEditName} editable={canManageOrg} style={styles.input} placeholder="组织名称" />
            <TextInput value={editDescription} onChangeText={setEditDescription} editable={canManageOrg} style={[styles.input, styles.textarea]} multiline placeholder="组织描述" />
            {canManageOrg ? (
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  run(async () => {
                    await mobileApi(`/organizations/${currentMembership.organization.id}`, token, {
                      method: "PUT",
                      headers: { "x-organization-id": currentMembership.organization.id },
                      body: JSON.stringify({ name: editName, description: editDescription })
                    });
                  }, "组织信息已更新")
                }
              >
                <Text style={styles.buttonText}>保存组织信息</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>成员管理</Text>
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
                    {managerRoles.map((role) => (
                      <TouchableOpacity
                        key={role.id}
                        style={[styles.smallButton, member.roleId === role.id && styles.smallButtonActive]}
                        onPress={() =>
                          run(async () => {
                            await mobileApi(`/organizations/${currentOrgId}/members/${member.id}/role`, token, {
                              method: "PUT",
                              headers: { "x-organization-id": currentOrgId! },
                              body: JSON.stringify({ roleId: role.id })
                            });
                          }, "成员角色已更新")
                        }
                      >
                        <Text style={[styles.smallButtonText, member.roleId === role.id && styles.smallButtonTextActive]}>{role.name}</Text>
                      </TouchableOpacity>
                    ))}
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
