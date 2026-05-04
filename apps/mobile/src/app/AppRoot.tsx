import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useMemo, useState } from "react";
import MainTabBar from "../navigation/MainTabBar";
import { tabItems } from "../navigation/tabs";
import ApartmentsScreen from "../screens/apartments/ApartmentsScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import BillsScreen from "../screens/bills/BillsScreen";
import HomeScreen from "../screens/home/HomeScreen";
import RoomsScreen from "../screens/rooms/RoomsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import { styles } from "../theme/styles";
import type { TabKey } from "../types";
import { useAppSession } from "./useAppSession";

export default function AppRoot() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [active, setActive] = useState<TabKey>("home");
  const [phone, setPhone] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "code">("code");
  const [orgName, setOrgName] = useState("");
  const {
    session,
    memberships,
    currentMembership,
    currentOrgId,
    setCurrentOrgId,
    members,
    roles,
    notice,
    setNotice,
    signIn,
    signOut,
    reload
  } = useAppSession();

  const title = useMemo(() => tabItems.find((tab) => tab.key === active)?.label ?? "首页", [active]);

  if (!session) {
    return (
      <LoginScreen
        phone={phone}
        setPhone={setPhone}
        mode={loginMode}
        setMode={setLoginMode}
        onSignedIn={signIn}
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
            onPress={signOut}
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
            reload={reload}
          />
        ) : null}
      </ScrollView>

      <MainTabBar active={active} onChange={setActive} />
    </SafeAreaView>
  );
}
