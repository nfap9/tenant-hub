import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Toast from "../components/Toast";
import { Button, Card, PressableScale } from "../components/ui";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import MainTabBar from "../navigation/MainTabBar";
import type { BillActionKey, BillTabKey, HomeNavigationIntent, RoomActionKey } from "../navigation/homeQuickActions";
import { tabItems } from "../navigation/tabs";
import ApartmentsScreen from "../screens/apartments/ApartmentsScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import BillsScreen from "../screens/bills/BillsScreen";
import HomeScreen from "../screens/home/HomeScreen";
import RoomsScreen from "../screens/rooms/RoomsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import { colors } from "../theme/tokens";
import { styles } from "../theme/styles";
import type { TabKey } from "../types";
import { useAppSession } from "./useAppSession";

export default function AppRoot() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [active, setActive] = useState<TabKey>("home");
  const [billsInitialTab, setBillsInitialTab] = useState<BillTabKey>("monthly");
  const [billsInitialAction, setBillsInitialAction] = useState<BillActionKey>();
  const [billsTabRequestKey, setBillsTabRequestKey] = useState(0);
  const [roomsInitialAction, setRoomsInitialAction] = useState<RoomActionKey>();
  const [roomsActionRequestKey, setRoomsActionRequestKey] = useState(0);
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

  const openTab = useCallback((key: TabKey) => {
    if (key === "bills") {
      setBillsInitialTab("monthly");
      setBillsInitialAction(undefined);
      setBillsTabRequestKey((value) => value + 1);
    }
    if (key === "rooms") {
      setRoomsInitialAction(undefined);
      setRoomsActionRequestKey((value) => value + 1);
    }
    setActive(key);
  }, []);

  const navigateFromHome = useCallback((intent: HomeNavigationIntent) => {
    if (intent.tab === "bills") {
      setBillsInitialTab(intent.billsTab ?? "monthly");
      setBillsInitialAction(intent.billsAction);
      setBillsTabRequestKey((value) => value + 1);
    }
    if (intent.tab === "rooms") {
      setRoomsInitialAction(intent.roomsAction);
      setRoomsActionRequestKey((value) => value + 1);
    }
    setActive(intent.tab);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [active, session?.user.id]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      if (userMenuOpen) {
        setUserMenuOpen(false);
        return true;
      }
      if (active !== "home") {
        openTab("home");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [userMenuOpen, active, openTab]);

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
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor={colors.primaryDark} />
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableScale scale={0.97} style={styles.userPill} onPress={() => setUserMenuOpen((value) => !value)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{session.user.username.slice(0, 1)}</Text>
              </View>
              <View style={styles.userPillText}>
                <Text style={styles.userName}>{session.user.username}</Text>
                <Text style={styles.userOrgName}>{currentMembership?.organization.name ?? "尚未选择组织"}</Text>
              </View>
            </View>
          </PressableScale>
        </View>
      </View>

      {userMenuOpen ? (
        <View style={styles.userMenu}>
          <Text style={styles.userMenuName}>{session.user.username}</Text>
          <Text style={styles.userMenuPhone}>{session.user.phone}</Text>
          <View style={styles.menuDivider} />
          <Text style={styles.menuLabel}>切换组织</Text>
          {memberships.length === 0 ? <Text style={styles.muted}>暂无组织</Text> : null}
          {memberships.map((item) => (
            <PressableScale
              key={item.organization.id}
              scale={0.98}
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
            </PressableScale>
          ))}
          <View style={styles.menuDivider} />
          <Button variant="danger" size="small" onPress={signOut}>退出登录</Button>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Toast message={notice} onDismiss={() => setNotice("")} />
        {memberships.length === 0 ? (
          <Card title="开始使用 Tenant Hub" subtitle="你还没有加入组织。先创建自己的组织，或输入管理员生成的邀请码加入已有团队。">
            <Button onPress={() => openTab("settings")}>创建或加入组织</Button>
          </Card>
        ) : null}
        {active === "home" ? <HomeScreen token={session.token} organizationId={currentOrgId} setNotice={setNotice} onNavigate={navigateFromHome} /> : null}
        {active === "rooms" ? (
          <RoomsScreen
            token={session.token}
            organizationId={currentOrgId}
            currentMembership={currentMembership}
            setNotice={setNotice}
            initialAction={roomsInitialAction}
            actionRequestKey={roomsActionRequestKey}
          />
        ) : null}
        {active === "bills" ? (
          <BillsScreen
            token={session.token}
            organizationId={currentOrgId}
            setNotice={setNotice}
            initialTab={billsInitialTab}
            initialAction={billsInitialAction}
            tabRequestKey={billsTabRequestKey}
          />
        ) : null}
        {active === "apartments" ? (
          <ApartmentsScreen token={session.token} organizationId={currentOrgId} currentMembership={currentMembership} setNotice={setNotice} />
        ) : null}
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
      </KeyboardAvoidingView>

      <MainTabBar active={active} onChange={openTab} />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}
