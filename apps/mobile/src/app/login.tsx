import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HttpError } from '@/api/client';
import { useSessionStore } from '@/store/sessionStore';
import { Button, Field } from '@/ui/components';
import { colors, fontSize, spacing } from '@/ui/theme';

const PHONE_RE = /^1[3-9]\d{9}$/;

export default function LoginScreen() {
  const login = useSessionStore((s) => s.login);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!PHONE_RE.test(phone.trim())) {
      setError('手机号格式不正确');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(phone.trim(), password);
      // 成功后 store 状态流转，根布局守卫自动跳转
    } catch (e) {
      setError(e instanceof HttpError ? e.message : '网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="business" size={28} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>租务通</Text>
          <Text style={styles.brandDesc}>轻量化公寓租赁管理</Text>
        </View>

        <Field
          label="手机号"
          value={phone}
          onChangeText={setPhone}
          placeholder="请输入手机号"
          keyboardType="phone-pad"
          autoCapitalize="none"
          maxLength={11}
        />
        <Field
          label="密码"
          value={password}
          onChangeText={setPassword}
          placeholder="请输入密码"
          secureToggle
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title="登录"
          onPress={() => void submit()}
          loading={submitting}
          style={{ marginTop: spacing(2) }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing(6),
  },
  brand: { alignItems: 'center', marginBottom: spacing(8) },
  brandIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(3),
  },
  brandTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  brandDesc: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing(1),
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.danger,
    marginBottom: spacing(2),
  },
});
