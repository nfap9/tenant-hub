import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/store/sessionStore';
import { Button, EmptyState } from '@/ui/components';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function SelectOrgScreen() {
  const status = useSessionStore((s) => s.status);
  const memberships = useSessionStore((s) => s.memberships);
  const selectOrg = useSessionStore((s) => s.selectOrg);
  const logout = useSessionStore((s) => s.logout);
  const [selecting, setSelecting] = useState<string | null>(null);

  // 只有一个组织时自动进入
  useEffect(() => {
    if (status === 'needsOrg' && memberships.length === 1) {
      void selectOrg(memberships[0].organization.id);
    }
  }, [status, memberships, selectOrg]);

  const choose = async (orgId: string) => {
    setSelecting(orgId);
    try {
      await selectOrg(orgId);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>选择组织</Text>
        <Text style={styles.hint}>选择要进入的组织</Text>

        {memberships.length === 0 ? (
          <EmptyState text="暂无可用组织" hint="请联系组织管理员邀请你加入" />
        ) : (
          memberships.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.orgCard}
              onPress={() => void choose(m.organization.id)}
              disabled={selecting != null}
              activeOpacity={0.7}
            >
              <View style={styles.orgIcon}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.orgInfo}>
                <Text style={styles.orgName}>{m.organization.name}</Text>
                <Text style={styles.orgRole}>{m.role.name}</Text>
              </View>
              {selecting === m.organization.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="退出登录"
          variant="ghost"
          onPress={() => void logout()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing(6), paddingTop: spacing(20) },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing(1),
    marginBottom: spacing(6),
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  orgIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  orgInfo: { flex: 1 },
  orgName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  orgRole: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  footer: { padding: spacing(6) },
});
