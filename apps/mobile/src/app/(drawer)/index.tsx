import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isActionPending,
  useChatStore,
  type ChatItem,
} from '@/store/chatStore';
import {
  MessageBubble,
  PendingActionCard,
  SuggestionChips,
  ToolCallLine,
} from '@/ui/chat';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function AssistantScreen() {
  const {
    ready,
    sending,
    items,
    pendingActions,
    models,
    selectedModelId,
    init,
    send,
    stop,
    confirm,
    reject,
    selectModel,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const listRef = useRef<FlatList<ChatItem>>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // 待确认操作：固定在输入框上方，不随对话流滚动
  const pendingList = Object.values(pendingActions)
    .filter(isActionPending)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const doSend = (text: string) => {
    if (!text.trim() || sending) return;
    setInput('');
    void send(text);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const doConfirm = (actionId: string) => {
    confirm(actionId).catch((err) =>
      Alert.alert('操作失败', err instanceof Error ? err.message : '请稍后重试')
    );
  };

  const doReject = (actionId: string) => {
    reject(actionId).catch((err) =>
      Alert.alert('操作失败', err instanceof Error ? err.message : '请稍后重试')
    );
  };

  const renderItem = ({ item }: { item: ChatItem }) => {
    if (item.kind === 'tool') {
      return <ToolCallLine summary={item.summary} />;
    }
    if (item.kind === 'action') {
      const action = pendingActions[item.actionId];
      // 待确认卡片只出现在固定面板，消息流里不重复渲染
      if (!action || isActionPending(action)) return null;
      return (
        <PendingActionCard
          action={action}
          onConfirm={() => {}}
          onReject={() => {}}
        />
      );
    }
    return (
      <MessageBubble
        role={item.role}
        content={item.content}
        streaming={item.streaming}
        error={item.error}
      />
    );
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing(1) }]}>
        <TouchableOpacity
          onPress={() =>
            (
              navigation as unknown as { toggleDrawer: () => void }
            ).toggleDrawer()
          }
          style={styles.floatBtn}
          accessibilityLabel="打开菜单"
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setModelPickerVisible(true)}
            style={[styles.floatBtn, styles.modelBtn]}
            accessibilityLabel="选择模型"
          >
            <Ionicons
              name="hardware-chip-outline"
              size={18}
              color={colors.text}
            />
            <Text style={styles.modelBtnText} numberOfLines={1}>
              {selectedModel?.displayName ?? '模型'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/conversations' as Href)}
            style={styles.floatBtn}
            accessibilityLabel="会话列表"
          >
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: spacing(3), flexGrow: 1 }}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          ready ? (
            <View style={styles.welcome}>
              <View style={styles.welcomeIcon}>
                <Ionicons name="sparkles" size={28} color={colors.primary} />
              </View>
              <Text style={styles.welcomeTitle}>你好，我是租务助手</Text>
              <Text style={styles.welcomeDesc}>
                可以帮你查房源、看租约、抄水电表、出账单、催租金。
                {'\n'}试试下面的快捷指令：
              </Text>
            </View>
          ) : null
        }
      />

      {!sending && pendingList.length === 0 && (
        <View style={{ paddingBottom: spacing(1) }}>
          <SuggestionChips onPick={doSend} />
        </View>
      )}

      {pendingList.length > 0 && (
        <View style={styles.pendingPanel}>
          <Text style={styles.pendingTitle}>
            待确认操作（{pendingList.length}）
          </Text>
          <ScrollView
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
          >
            {pendingList.map((a) => (
              <PendingActionCard
                key={a.id}
                action={a}
                onConfirm={() => doConfirm(a.id)}
                onReject={() => doReject(a.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.inputBar, { marginBottom: spacing(2.5) }]}>
        <TextInput
          style={styles.input}
          placeholder="输入指令，如：102 电表抄 2350"
          placeholderTextColor={colors.textTertiary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => doSend(input)}
          returnKeyType="send"
          multiline
        />
        {sending ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.danger }]}
            onPress={stop}
            accessibilityLabel="停止生成"
          >
            <Ionicons name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
            onPress={() => doSend(input)}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {!keyboardVisible && (
        <Text
          style={[
            styles.aiNote,
            { paddingBottom: Math.max(insets.bottom, spacing(2)) },
          ]}
        >
          内容由 AI 生成，请核对后操作
        </Text>
      )}

      <Modal
        visible={modelPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerMask}
          activeOpacity={1}
          onPress={() => setModelPickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>选择模型</Text>
            {models.map((m) => {
              const active = m.id === selectedModelId;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    selectModel(m.id);
                    setModelPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      active && { color: colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {m.displayName}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
            {models.length === 0 && (
              <Text style={styles.pickerEmpty}>暂无可用模型</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(2),
    backgroundColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  floatBtn: {
    height: 40,
    minWidth: 40,
    borderRadius: 20,
    paddingHorizontal: spacing(2.5),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  modelBtn: { maxWidth: 180 },
  modelBtnText: { fontSize: fontSize.sm, color: colors.text, flexShrink: 1 },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(3),
  },
  welcomeTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing(2),
  },
  welcomeDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: spacing(3),
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
    paddingVertical: spacing(2),
    backgroundColor: colors.card,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: spacing(2),
  },
  input: {
    flex: 1,
    paddingTop: spacing(2.5),
    paddingBottom: spacing(2.5),
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 24,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiNote: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  pendingPanel: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing(2),
  },
  pendingTitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    paddingHorizontal: spacing(4),
    marginBottom: spacing(1),
  },
  pickerMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing(8),
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing(4),
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing(2),
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerItemText: { fontSize: fontSize.md, color: colors.text },
  pickerEmpty: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    paddingVertical: spacing(3),
  },
});
