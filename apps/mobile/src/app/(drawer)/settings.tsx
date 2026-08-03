import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useSessionStore } from '@/store/sessionStore';
import { Button, Card, Row, SectionHeader } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function SettingsScreen() {
  const user = useSessionStore((s) => s.user);
  const memberships = useSessionStore((s) => s.memberships);
  const currentOrgId = useSessionStore((s) => s.currentOrgId);
  const switchOrg = useSessionStore((s) => s.switchOrg);
  const logout = useSessionStore((s) => s.logout);

  const current = memberships.find((m) => m.organization.id === currentOrgId);

  const confirmLogout = () =>
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => void logout() },
    ]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionHeader title="账号" />
      <Card>
        <Row label="用户名" value={user?.username ?? '-'} />
        <Row label="手机号" value={user?.phone ?? '-'} />
      </Card>

      <SectionHeader title="组织" />
      <Card>
        <Row label="当前组织" value={current?.organization.name ?? '-'} />
        <Row label="角色" value={current?.role.name ?? '-'} />
        <Button
          title="切换组织"
          variant="outline"
          onPress={switchOrg}
          style={{ marginTop: spacing(3) }}
        />
      </Card>

      <Button
        title="退出登录"
        variant="danger"
        onPress={confirmLogout}
        style={{ marginTop: spacing(6) }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4) },
});
