import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { clearMobileSession, mobileApi, readMobileSession, writeMobileSession, type MobileSession } from "./api";

type TabKey = "home" | "org" | "apartments" | "leases" | "bills";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "首页" },
  { key: "org", label: "组织" },
  { key: "apartments", label: "公寓" },
  { key: "leases", label: "租约" },
  { key: "bills", label: "账单" }
];

const sampleApartments = [
  { id: "1", name: "江湾公寓", rooms: 42, vacant: 6, location: "杨浦区政立路" },
  { id: "2", name: "南山青年社区", rooms: 28, vacant: 3, location: "南山区科技园" }
];

const sampleBills = [
  { id: "b1", roomNo: "302", tenant: "陈一", amount: "3280", status: "待收款" },
  { id: "b2", roomNo: "506", tenant: "李然", amount: "146", status: "水电待录入" }
];

type Membership = {
  organization: { id: string; name: string; code: string; description?: string; ownerId: string };
  role: { id: string; code: string; name: string; permissions: string[] };
};

type OrgRole = { id: string; code: string; name: string; permissions: string[] };

type OrgMember = {
  id: string;
  userId: string;
  roleId: string;
  user: { id: string; phone: string; username: string };
  role: OrgRole;
};

export default function App() {
  const [session, setSession] = useState<MobileSession | undefined>(() => readMobileSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [notice, setNotice] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [active, setActive] = useState<TabKey>("home");
  const [phone, setPhone] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "code">("code");
  const [orgName, setOrgName] = useState("");
  const [roomRows, setRoomRows] = useState("101\n102\n103");

  const title = useMemo(() => tabs.find((tab) => tab.key === active)?.label ?? "首页", [active]);
  const currentMembership = useMemo(() => memberships.find((item) => item.organization.id === currentOrgId), [currentOrgId, memberships]);
  const token = session?.token;

  const loadMe = async (nextToken = token) => {
    if (!nextToken) return;
    const me = await mobileApi<{ user: MobileSession["user"]; memberships: Membership[] }>("/auth/me", nextToken);
    setMemberships(me.memberships);
    setCurrentOrgId((old) => (old && me.memberships.some((item) => item.organization.id === old) ? old : me.memberships[0]?.organization.id));
  };

  const loadOrgData = async (organizationId = currentOrgId) => {
    if (!token || !organizationId) {
      setMembers([]);
      setRoles([]);
      return;
    }
    const [nextMembers, nextRoles] = await Promise.all([
      mobileApi<OrgMember[]>(`/organizations/${organizationId}/members`, token, { headers: { "x-organization-id": organizationId } }),
      mobileApi<OrgRole[]>(`/organizations/${organizationId}/roles`, token, { headers: { "x-organization-id": organizationId } })
    ]);
    setMembers(nextMembers);
    setRoles(nextRoles);
  };

  useEffect(() => {
    if (session?.token) {
      loadMe(session.token).catch((error) => setNotice(error.message));
    }
  }, []);

  useEffect(() => {
    loadOrgData().catch((error) => setNotice(error.message));
  }, [currentOrgId, token]);

  if (!session) {
    return (
      <LoginScreen
        phone={phone}
        setPhone={setPhone}
        mode={loginMode}
        setMode={setLoginMode}
        onSignedIn={(nextSession) => {
          writeMobileSession(nextSession);
          setSession(nextSession);
          loadMe(nextSession.token).catch((error) => setNotice(error.message));
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.product}>Tenant Hub</Text>
          <Text style={styles.subtitle}>{currentMembership?.organization.name ?? "尚未选择组织"}</Text>
        </View>
        <TouchableOpacity
          style={styles.userPill}
          onPress={() => setUserMenuOpen((value) => !value)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{session.user.username.slice(0, 1)}</Text>
          </View>
          <Text style={styles.userName}>{session.user.username}</Text>
        </TouchableOpacity>
      </View>
      {userMenuOpen ? (
        <View style={styles.userMenu}>
          <Text style={styles.userMenuName}>{session.user.username}</Text>
          <Text style={styles.userMenuPhone}>{session.user.phone}</Text>
          <View style={styles.menuDivider} />
          <Text style={styles.menuLabel}>切换组织</Text>
          {memberships.length === 0 ? <Text style={styles.muted}>暂无组织</Text> : null}
          {memberships.map((item) => (
            <TouchableOpacity
              key={item.organization.id}
              style={[styles.menuOrgItem, currentOrgId === item.organization.id && styles.menuOrgItemActive]}
              onPress={() => {
                setCurrentOrgId(item.organization.id);
                setUserMenuOpen(false);
              }}
            >
              <View>
                <Text style={styles.menuOrgName}>{item.organization.name}</Text>
                <Text style={styles.userMenuPhone}>{item.role.name} · {item.organization.code}</Text>
              </View>
              {currentOrgId === item.organization.id ? <Text style={styles.link}>当前</Text> : null}
            </TouchableOpacity>
          ))}
          <View style={styles.menuDivider} />
          <TouchableOpacity
            style={styles.menuLogout}
            onPress={() => {
              clearMobileSession();
              setSession(undefined);
            }}
          >
            <Text style={styles.smallDangerText}>退出登录</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {active === "home" ? <HomeScreen /> : null}
        {active === "org" ? (
          <OrgScreen
            token={session.token}
            currentUserId={session.user.id}
            memberships={memberships}
            currentMembership={currentMembership}
            currentOrgId={currentOrgId}
            setCurrentOrgId={setCurrentOrgId}
            members={members}
            roles={roles}
            orgName={orgName}
            setOrgName={setOrgName}
            setNotice={setNotice}
            reload={async () => {
              await loadMe();
              await loadOrgData();
            }}
          />
        ) : null}
        {active === "apartments" ? <ApartmentsScreen roomRows={roomRows} setRoomRows={setRoomRows} /> : null}
        {active === "leases" ? <LeasesScreen /> : null}
        {active === "bills" ? <BillsScreen /> : null}
      </ScrollView>

      <View style={styles.tabbar}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, active === tab.key && styles.tabActive]} onPress={() => setActive(tab.key)}>
            <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({
  phone,
  setPhone,
  mode,
  setMode,
  onSignedIn
}: {
  phone: string;
  setPhone: (value: string) => void;
  mode: "password" | "code";
  setMode: (value: "password" | "code") => void;
  onSignedIn: (session: MobileSession) => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = authMode === "register";

  const sendOtp = async () => {
    setError("");
    try {
      await mobileApi("/auth/otp", undefined, {
        method: "POST",
        body: JSON.stringify({ phone, purpose: isRegister ? "REGISTER" : "LOGIN" })
      });
      setError("验证码已发送，请查看后端控制台");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const path = isRegister ? "/auth/register" : mode === "password" ? "/auth/login/password" : "/auth/login/otp";
      const body = isRegister
        ? { phone, username, password, confirmPassword, code }
        : mode === "password"
          ? { phone, password }
          : { phone, code };
      const result = await mobileApi<MobileSession>(path, undefined, { method: "POST", body: JSON.stringify(body) });
      onSignedIn(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginShell}>
      <ScrollView contentContainerStyle={[styles.loginContent, isRegister && styles.loginContentCompact]} keyboardShouldPersistTaps="handled">
        <View style={styles.loginHeader}>
          <Text style={styles.loginEyebrow}>APARTMENT OPS</Text>
          <Text style={styles.loginProduct}>Tenant Hub</Text>
          <Text style={styles.loginSubtitle}>给二房东和小型物业公司的移动经营台</Text>
        </View>
        <View style={styles.loginPanel}>
          <View>
            <Text style={styles.formTitle}>{isRegister ? "注册账号" : "欢迎回来"}</Text>
            <Text style={styles.formSubTitle}>{isRegister ? "手机号验证后即可创建账号" : "使用手机号登录你的公寓经营工作台"}</Text>
          </View>
          {!isRegister ? (
            <View style={styles.segment}>
              <TouchableOpacity style={[styles.segmentItem, mode === "code" && styles.segmentItemActive]} onPress={() => setMode("code")}>
                <Text style={[styles.segmentText, mode === "code" && styles.segmentTextActive]}>验证码登录</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segmentItem, mode === "password" && styles.segmentItemActive]} onPress={() => setMode("password")}>
                <Text style={[styles.segmentText, mode === "password" && styles.segmentTextActive]}>密码登录</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.label}>手机号</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="请输入手机号" placeholderTextColor="#9a9488" />
          {isRegister ? (
            <>
              <Text style={styles.label}>用户名</Text>
              <TextInput value={username} onChangeText={setUsername} style={styles.input} placeholder="请输入用户名" placeholderTextColor="#9a9488" />
            </>
          ) : null}
          {mode === "password" || isRegister ? (
            <>
              <Text style={styles.label}>密码</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="至少 8 位密码" placeholderTextColor="#9a9488" />
              {isRegister ? (
                <>
                  <Text style={styles.label}>确认密码</Text>
                  <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry style={styles.input} placeholder="再次输入密码" placeholderTextColor="#9a9488" />
                </>
              ) : null}
            </>
          ) : null}
          {mode === "code" || isRegister ? (
            <>
              <Text style={styles.label}>验证码</Text>
              <View style={styles.codeRow}>
                <TextInput value={code} onChangeText={setCode} style={[styles.input, styles.codeInput]} placeholder="6 位验证码" placeholderTextColor="#9a9488" keyboardType="number-pad" />
                <TouchableOpacity style={styles.codeButton} onPress={sendOtp}>
                  <Text style={styles.secondaryButtonText}>获取验证码</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          {error ? <Text style={styles.formMessage}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>{busy ? "处理中" : isRegister ? "注册并登录" : "登录"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchAuthButton}
            onPress={() => {
              setAuthMode(isRegister ? "login" : "register");
              if (!isRegister) setMode("code");
            }}
          >
            <Text style={styles.switchAuthText}>{isRegister ? "已有账号，去登录" : "注册新账号"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen() {
  return (
    <>
      <View style={styles.metricRow}>
        <Metric label="公寓" value="2" />
        <Metric label="房间" value="70" />
        <Metric label="空置" value="9" />
      </View>
      {["水电读数待录入 1 条", "今日应收账单 3 条", "本月租约到期 2 份"].map((item) => (
        <View style={styles.notice} key={item}>
          <Text style={styles.noticeText}>{item}</Text>
          <Text style={styles.link}>处理</Text>
        </View>
      ))}
    </>
  );
}

function OrgScreen({
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

function ApartmentsScreen({ roomRows, setRoomRows }: { roomRows: string; setRoomRows: (value: string) => void }) {
  return (
    <>
      {sampleApartments.map((item) => (
        <View style={styles.card} key={item.id}>
          <View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.muted}>{item.location}</Text>
          </View>
          <Text style={styles.cardStat}>{item.vacant}/{item.rooms} 空置</Text>
        </View>
      ))}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>批量添加房间</Text>
        <TextInput value={roomRows} onChangeText={setRoomRows} style={[styles.input, styles.textarea]} multiline />
        <TextInput style={styles.input} placeholder="户型，例如 单间" />
        <TextInput style={styles.input} placeholder="设施，例如 空调，洗衣机，床" />
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>添加房间</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function LeasesScreen() {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>签订租约</Text>
        <TextInput style={styles.input} placeholder="房间号" />
        <TextInput style={styles.input} placeholder="租客姓名" />
        <TextInput style={styles.input} placeholder="租客手机号" keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="月租金" keyboardType="numeric" />
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>保存并生成账单</Text>
        </TouchableOpacity>
      </View>
      {["302 · 陈一 · 月付 · 生效中", "506 · 李然 · 季付 · 生效中"].map((item) => (
        <View style={styles.notice} key={item}>
          <Text style={styles.noticeText}>{item}</Text>
          <Text style={styles.link}>解约</Text>
        </View>
      ))}
    </>
  );
}

function BillsScreen() {
  return (
    <>
      {sampleBills.map((bill) => (
        <View style={styles.card} key={bill.id}>
          <View>
            <Text style={styles.cardTitle}>{bill.roomNo} · {bill.tenant}</Text>
            <Text style={styles.muted}>{bill.status}</Text>
          </View>
          <Text style={styles.cardStat}>¥{bill.amount}</Text>
        </View>
      ))}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>录入水电读数</Text>
        <TextInput style={styles.input} placeholder="账单房间号" />
        <TextInput style={styles.input} placeholder="本月水表" keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="本月电表" keyboardType="numeric" />
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>完成出账</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#f4f2ec" },
  loginShell: { flex: 1, backgroundColor: "#102522" },
  loginContent: { flexGrow: 1, justifyContent: "center", padding: 18, gap: 12 },
  loginContentCompact: { paddingVertical: 10, gap: 8 },
  loginHeader: { gap: 4 },
  loginEyebrow: { color: "#c7a85a", fontSize: 12, fontWeight: "700" },
  loginProduct: { color: "white", fontSize: 34, fontWeight: "700" },
  loginSubtitle: { color: "#cfe8df", fontSize: 14, lineHeight: 19 },
  loginPanel: {
    padding: 14,
    backgroundColor: "#fffaf0",
    borderRadius: 8,
    gap: 7,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  formTitle: { color: "#102522", fontSize: 21, fontWeight: "700" },
  formSubTitle: { color: "#66716d", marginTop: 2, fontSize: 13, lineHeight: 18 },
  formMessage: { padding: 8, borderRadius: 6, backgroundColor: "#eef6f2", color: "#146c5c" },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#102522", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  product: { fontSize: 22, fontWeight: "700", color: "white" },
  subtitle: { color: "#cfe8df", marginTop: 2 },
  badge: { color: "#102522", backgroundColor: "#d7efe6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, overflow: "hidden" },
  userPill: { flexDirection: "row", alignItems: "center", gap: 8, padding: 4, paddingRight: 9, borderRadius: 999, backgroundColor: "#183531" },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#d7efe6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#102522", fontWeight: "700" },
  userName: { color: "white", fontWeight: "700", maxWidth: 86 },
  userMenu: {
    position: "absolute",
    top: 62,
    right: 12,
    zIndex: 10,
    width: 260,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e3dece",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    gap: 8
  },
  userMenuName: { color: "#102522", fontSize: 16, fontWeight: "700" },
  userMenuPhone: { color: "#6b7471", fontSize: 12 },
  menuDivider: { height: 1, backgroundColor: "#ebe4d4", marginVertical: 2 },
  menuLabel: { color: "#394341", fontWeight: "700", fontSize: 13 },
  menuOrgItem: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ede7d8", flexDirection: "row", justifyContent: "space-between", gap: 8 },
  menuOrgItemActive: { borderColor: "#146c5c", backgroundColor: "#eef6f2" },
  menuOrgName: { color: "#102522", fontWeight: "700" },
  menuLogout: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 92 },
  title: { fontSize: 24, fontWeight: "700", color: "#102522" },
  noticeBanner: { padding: 10, borderRadius: 6, backgroundColor: "#e0f1ea", color: "#146c5c", fontWeight: "700" },
  panel: { padding: 14, backgroundColor: "white", borderRadius: 8, gap: 10 },
  label: { color: "#394341", fontWeight: "700", marginTop: 0, fontSize: 13 },
  sectionTitle: { color: "#102522", fontSize: 17, fontWeight: "700" },
  input: { minHeight: 40, borderWidth: 1, borderColor: "#d9d3c4", borderRadius: 6, paddingHorizontal: 10, color: "#102522", backgroundColor: "white" },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1 },
  codeButton: { width: 104, minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: "#146c5c", alignItems: "center", justifyContent: "center" },
  textarea: { minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
  button: { minHeight: 40, borderRadius: 6, backgroundColor: "#146c5c", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  secondaryButton: { minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: "#146c5c", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#146c5c", fontWeight: "700" },
  switchAuthButton: { minHeight: 28, alignItems: "center", justifyContent: "center" },
  switchAuthText: { color: "#146c5c", fontWeight: "700" },
  segment: { flexDirection: "row", padding: 3, borderRadius: 6, backgroundColor: "#ece5d5" },
  segmentItem: { flex: 1, minHeight: 34, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: "white" },
  segmentText: { color: "#596460", fontWeight: "700" },
  segmentTextActive: { color: "#102522" },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, backgroundColor: "white", borderRadius: 8, padding: 12 },
  metricValue: { marginTop: 4, fontSize: 24, color: "#102522", fontWeight: "700" },
  notice: { padding: 14, backgroundColor: "white", borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  noticeText: { color: "#102522", fontSize: 15 },
  link: { color: "#146c5c", fontWeight: "700" },
  card: { padding: 14, backgroundColor: "white", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: "#102522", fontSize: 17, fontWeight: "700" },
  cardStat: { color: "#146c5c", fontWeight: "700" },
  muted: { color: "#6b7471" },
  orgOption: { padding: 12, borderWidth: 1, borderColor: "#e3dece", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  orgOptionActive: { borderColor: "#146c5c", backgroundColor: "#eef6f2" },
  memberCard: { padding: 12, borderWidth: 1, borderColor: "#e3dece", borderRadius: 8, gap: 10, backgroundColor: "#fffdf7" },
  memberHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  roleBadge: { color: "#146c5c", fontWeight: "700" },
  roleActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: "#d9d3c4", alignItems: "center", justifyContent: "center" },
  smallButtonActive: { backgroundColor: "#146c5c", borderColor: "#146c5c" },
  smallButtonText: { color: "#394341", fontWeight: "700" },
  smallButtonTextActive: { color: "white" },
  smallDangerButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: "#c8674e", alignItems: "center", justifyContent: "center" },
  smallDangerText: { color: "#b14f38", fontWeight: "700" },
  tabbar: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 64, padding: 8, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e4dece", flexDirection: "row", gap: 6 },
  tab: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#146c5c" },
  tabText: { color: "#4f5b58", fontSize: 13 },
  tabTextActive: { color: "white", fontWeight: "700" }
});
