import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMemo, useState } from "react";

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

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [active, setActive] = useState<TabKey>("home");
  const [phone, setPhone] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "code">("code");
  const [orgName, setOrgName] = useState("");
  const [roomRows, setRoomRows] = useState("101\n102\n103");

  const title = useMemo(() => tabs.find((tab) => tab.key === active)?.label ?? "首页", [active]);

  if (!signedIn) {
    return <LoginScreen phone={phone} setPhone={setPhone} mode={loginMode} setMode={setLoginMode} onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.product}>Tenant Hub</Text>
          <Text style={styles.subtitle}>公寓经营 App</Text>
        </View>
        <TouchableOpacity onPress={() => setSignedIn(false)}>
          <Text style={styles.badge}>退出</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {active === "home" ? <HomeScreen /> : null}
        {active === "org" ? <OrgScreen orgName={orgName} setOrgName={setOrgName} /> : null}
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
  onSignedIn: () => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const isRegister = authMode === "register";

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
              <TextInput style={styles.input} placeholder="请输入用户名" placeholderTextColor="#9a9488" />
            </>
          ) : null}
          {mode === "password" || isRegister ? (
            <>
              <Text style={styles.label}>密码</Text>
              <TextInput secureTextEntry style={styles.input} placeholder="至少 8 位密码" placeholderTextColor="#9a9488" />
              {isRegister ? (
                <>
                  <Text style={styles.label}>确认密码</Text>
                  <TextInput secureTextEntry style={styles.input} placeholder="再次输入密码" placeholderTextColor="#9a9488" />
                </>
              ) : null}
            </>
          ) : null}
          {mode === "code" || isRegister ? (
            <>
              <Text style={styles.label}>验证码</Text>
              <View style={styles.codeRow}>
                <TextInput style={[styles.input, styles.codeInput]} placeholder="6 位验证码" placeholderTextColor="#9a9488" keyboardType="number-pad" />
                <TouchableOpacity style={styles.codeButton}>
                  <Text style={styles.secondaryButtonText}>获取验证码</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={onSignedIn}>
            <Text style={styles.buttonText}>{isRegister ? "注册并登录" : "登录"}</Text>
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

function OrgScreen({ orgName, setOrgName }: { orgName: string; setOrgName: (value: string) => void }) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.label}>创建组织</Text>
        <TextInput value={orgName} onChangeText={setOrgName} style={styles.input} placeholder="组织名称" />
        <TextInput style={[styles.input, styles.textarea]} multiline placeholder="组织描述" />
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>创建组织</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>加入组织</Text>
        <TextInput style={styles.input} placeholder="输入组织编码" />
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>申请加入</Text>
        </TouchableOpacity>
      </View>
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
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#102522", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  product: { fontSize: 22, fontWeight: "700", color: "white" },
  subtitle: { color: "#cfe8df", marginTop: 2 },
  badge: { color: "#102522", backgroundColor: "#d7efe6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, overflow: "hidden" },
  content: { padding: 16, gap: 12, paddingBottom: 92 },
  title: { fontSize: 24, fontWeight: "700", color: "#102522" },
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
  tabbar: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 64, padding: 8, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e4dece", flexDirection: "row", gap: 6 },
  tab: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#146c5c" },
  tabText: { color: "#4f5b58", fontSize: 13 },
  tabTextActive: { color: "white", fontWeight: "700" }
});
