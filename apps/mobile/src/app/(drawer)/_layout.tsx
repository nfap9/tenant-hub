import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Drawer,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

function DrawerContent({
  state,
  descriptors,
  navigation,
}: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  return (
    <DrawerContentScrollView
      contentContainerStyle={{ paddingTop: insets.top + spacing(2) }}
    >
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Ionicons name="business" size={24} color={colors.primary} />
        </View>
        <Text style={styles.brandTitle}>租务通</Text>
        <Text style={styles.brandDesc}>轻量化公寓租赁管理</Text>
      </View>
      {/* 用 RNGH 的 Pressable 替代 DrawerItemList：与抽屉滑动手势协调，
          右滑关闭时手势接管会取消按压，避免误触发菜单跳转 */}
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const options = descriptors[route.key].options;
        const color = focused ? colors.primary : colors.textSecondary;
        const label = (options.title as string) ?? route.name;
        return (
          <Pressable
            key={route.key}
            style={[styles.item, focused && styles.itemActive]}
            onPress={() => navigation.navigate(route.name)}
          >
            {options.drawerIcon?.({ color, size: 22, focused })}
            <Text style={[styles.itemLabel, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '700' },
        headerTintColor: colors.text,
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primaryLight,
        drawerInactiveTintColor: colors.textSecondary,
        drawerLabelStyle: { fontSize: fontSize.md, fontWeight: '600' },
        drawerItemStyle: { borderRadius: radius.md },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'AI 助手',
          // 聊天主页自带沉浸式头部（模型选择/会话列表入口），隐藏 Drawer 默认头部
          headerShown: false,
          drawerIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="assets"
        options={{
          title: '资产',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="finance"
        options={{
          title: '财务',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="meter"
        options={{
          title: '抄表',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="speedometer" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: '设置',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  brand: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(4),
    marginBottom: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  brandTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  brandDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginHorizontal: spacing(2),
    marginVertical: 2,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.primaryLight },
  itemLabel: { fontSize: fontSize.md, fontWeight: '600' },
});
