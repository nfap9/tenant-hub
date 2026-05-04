import { useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
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
