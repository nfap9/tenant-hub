import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';
import { listConversations } from '@/api/ai/rest';
import { useChatStore } from '@/store/chatStore';
import { Button, EmptyState } from '@/ui/components';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function ConversationsScreen() {
  const conversations = useChatStore((s) => s.conversations);
  const openConversation = useChatStore((s) => s.openConversation);
  const newConversation = useChatStore((s) => s.newConversation);
  const archive = useChatStore((s) => s.archive);
  const [refreshing, setRefreshing] = useState(false);

  // modal 每次打开时拉一次最新列表（发送消息后端会更新 updatedAt）
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listConversations();
      useChatStore.setState({ conversations: list });
    } catch {
      // 忽略：保留现有列表
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onOpen = (id: string) => {
    void openConversation(id);
    router.back();
  };

  const onNew = () => {
    newConversation();
    router.back();
  };

  const onArchive = (id: string, title: string) => {
    Alert.alert('归档会话', `确定归档「${title}」吗？归档后不再显示。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '归档',
        style: 'destructive',
        onPress: () => {
          archive(id).catch((err) =>
            Alert.alert(
              '操作失败',
              err instanceof Error ? err.message : '请稍后重试'
            )
          );
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button title="新建对话" onPress={onNew} />
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        contentContainerStyle={
          conversations.length === 0 ? { flex: 1 } : undefined
        }
        ListEmptyComponent={
          <EmptyState text="暂无会话" hint="点击上方「新建对话」开始" />
        }
        renderItem={({ item }) => {
          const title = item.title?.trim() || '未命名会话';
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() => onOpen(item.id)}
              onLongPress={() => onArchive(item.id, title)}
              activeOpacity={0.7}
            >
              <View style={styles.itemIcon}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.itemTime}>
                  {dayjs(item.updatedAt).format('MM-DD HH:mm')}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          );
        }}
      />
      <Text style={styles.tip}>长按会话可归档</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing(4), paddingBottom: spacing(2) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.card,
    marginHorizontal: spacing(4),
    marginBottom: spacing(2),
    padding: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemTime: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tip: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing(3),
  },
});
