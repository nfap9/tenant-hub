import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { clearMobileSession, mobileApi, readMobileSession, writeMobileSession, type MobileSession } from "./api";
import { styles } from "./styles";
import type { TabKey, Membership, OrgMember, OrgRole } from "./types";
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import RoomsScreen from "./screens/RoomsScreen";
import BillsScreen from "./screens/BillsScreen";
import ApartmentsScreen from "./screens/ApartmentsScreen";
import SettingsScreen from "./screens/SettingsScreen";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "首页" },
  { key: "rooms", label: "房间" },
  { key: "bills", label: "账单" },
  { key: "apartments", label: "公寓" },
  { key: "settings", label: "设置" }
];

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
        <TouchableOpacity style={styles.userPill} onPress={() => setUserMenuOpen((value) => !value)}>
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
        {active === "rooms" ? <RoomsScreen /> : null}
        {active === "bills" ? <BillsScreen /> : null}
        {active === "apartments" ? <ApartmentsScreen /> : null}
        {active === "settings" ? (
          <SettingsScreen
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
