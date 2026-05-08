import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, View } from "react-native";
import Toast from "../../components/Toast";
import { Button, Input } from "../../components/ui";
import { Card } from "../../components/ui/Card";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { MobileSession } from "../../types";

export default function LoginScreen({
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
  const [otpBusy, setOtpBusy] = useState(false);
  const isRegister = authMode === "register";

  const sendOtp = async () => {
    if (otpBusy || busy) return;
    setOtpBusy(true);
    setError("");
    try {
      await mobileApi("/auth/otp", undefined, {
        method: "POST",
        body: JSON.stringify({ phone, purpose: isRegister ? "REGISTER" : "LOGIN" })
      });
      setError("验证码已发送，请查看后端控制台");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOtpBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
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
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView contentContainerStyle={[styles.loginContent, isRegister && styles.loginContentCompact]} keyboardShouldPersistTaps="always">
        <View style={styles.loginHeader}>
          <Text style={styles.loginEyebrow}>APARTMENT OPS</Text>
          <Text style={styles.loginProduct}>Tenant Hub</Text>
          <Text style={styles.loginSubtitle}>给二房东和小型物业公司的移动经营台</Text>
        </View>
        <Card variant="warm" padding="lg" gap={12}>
          <View>
            <Text style={styles.formTitle}>{isRegister ? "注册账号" : "欢迎回来"}</Text>
            <Text style={styles.formSubTitle}>{isRegister ? "手机号验证后即可创建账号" : "使用手机号登录你的公寓经营工作台"}</Text>
          </View>
          {!isRegister ? (
            <View style={styles.segment}>
              <View style={[styles.segmentItem, mode === "code" && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, mode === "code" && styles.segmentTextActive]} onPress={() => setMode("code")}>验证码登录</Text>
              </View>
              <View style={[styles.segmentItem, mode === "password" && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, mode === "password" && styles.segmentTextActive]} onPress={() => setMode("password")}>密码登录</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.label}>手机号</Text>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="请输入手机号" />
          {isRegister ? (
            <>
              <Text style={styles.label}>用户名</Text>
              <Input value={username} onChangeText={setUsername} placeholder="请输入用户名" />
            </>
          ) : null}
          {mode === "password" || isRegister ? (
            <>
              <Text style={styles.label}>密码</Text>
              <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="至少 8 位密码" />
              {isRegister ? (
                <>
                  <Text style={styles.label}>确认密码</Text>
                  <Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="再次输入密码" />
                </>
              ) : null}
            </>
          ) : null}
          {mode === "code" || isRegister ? (
            <>
              <Text style={styles.label}>验证码</Text>
              <View style={styles.codeRow}>
                <Input value={code} onChangeText={setCode} style={{ flex: 1 }} placeholder="6 位验证码" keyboardType="number-pad" />
                <Button variant="secondary" size="small" loading={otpBusy} disabled={otpBusy || busy} onPress={sendOtp}>
                  {otpBusy ? "发送中" : "获取验证码"}
                </Button>
              </View>
            </>
          ) : null}
          <Toast message={error} onDismiss={() => setError("")} />
          <Button loading={busy} disabled={busy} onPress={submit} icon={isRegister ? "person-add-outline" : "log-in-outline"}>
            {busy ? "处理中" : isRegister ? "注册并登录" : "登录"}
          </Button>
          <Button variant="ghost" size="small" onPress={() => {
            setAuthMode(isRegister ? "login" : "register");
            if (!isRegister) setMode("code");
          }}>
            {isRegister ? "已有账号，去登录" : "注册新账号"}
          </Button>
        </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
