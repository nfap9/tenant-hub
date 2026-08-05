import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, type Href } from 'expo-router';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSessionStore } from '@/store/sessionStore';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const restore = useSessionStore((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  // 路由守卫：按会话状态强制跳转
  const guardHref: Href | null =
    status === 'signedOut'
      ? '/login'
      : status === 'needsOrg'
        ? '/select-org'
        : status === 'ready'
          ? '/(drawer)'
          : null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="select-org" options={{ headerShown: false }} />
          <Stack.Screen
            name="conversations"
            options={{ presentation: 'modal', title: '会话列表' }}
          />
        </Stack>
        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>加载中…</Text>
          </View>
        ) : guardHref ? (
          <Redirect href={guardHref} />
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing(3),
  },
});
