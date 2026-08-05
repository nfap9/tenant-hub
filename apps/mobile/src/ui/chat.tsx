import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from './theme';
import { Badge, Button, Card } from './components';
import { AssistantMarkdown } from './markdown';
import type { UiPendingAction } from '@/store/chatStore';

/** 简单加粗渲染：支持 **加粗**（仅用户消息气泡用，AI 消息走 markdown） */
const renderInline = (text: string, baseColor: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700', color: baseColor }}>
          {p.slice(2, -2)}
        </Text>
      );
    }
    return (
      <Text key={i} style={{ color: baseColor }}>
        {p}
      </Text>
    );
  });
};

/** 聊天气泡 */
export const MessageBubble = ({
  role,
  content,
  streaming,
  error,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  error?: boolean;
}) => {
  const isUser = role === 'user';
  if (!content && streaming) {
    return (
      <View style={[styles.bubbleRow, styles.assistantRow]}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </View>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>思考中…</Text>
        </View>
      </View>
    );
  }
  if (!content) return null;
  return (
    <View
      style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}
    >
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          error && { borderColor: colors.danger },
        ]}
      >
        {isUser ? (
          <Text selectable style={styles.userText}>
            {renderInline(content, '#fff')}
          </Text>
        ) : (
          // 流式光标直接拼进 markdown 文本，跟随最后一段内容的排版
          <AssistantMarkdown content={streaming ? `${content}▍` : content} />
        )}
      </View>
    </View>
  );
};

/** 工具调用记录：小字系统样式，夹在消息流中 */
export const ToolCallLine = ({ summary }: { summary: string }) => (
  <View style={styles.toolRow}>
    <Ionicons name="construct-outline" size={12} color={colors.textTertiary} />
    <Text style={styles.toolText} numberOfLines={2}>
      {summary}
    </Text>
  </View>
);

const riskMeta: Record<string, { label: string; fg: string; bg: string }> = {
  low: { label: '低风险', fg: colors.success, bg: colors.successLight },
  medium: { label: '中风险', fg: colors.warning, bg: colors.warningLight },
  high: { label: '高风险', fg: colors.danger, bg: colors.dangerLight },
};

const formatValue = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** 待确认操作卡片：标题 + 风险 Badge + diff 明细 + 确认/取消 + 状态结果条 */
export const PendingActionCard = ({
  action,
  pending,
  disabled,
  onConfirm,
  onReject,
}: {
  action: UiPendingAction;
  /** 是否仍可操作（id 在后端 interrupts 集合中），由调用方依据 store 状态传入 */
  pending: boolean;
  /** 流式请求进行中时禁用按钮 */
  disabled?: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) => {
  const { summary, status } = action;
  const risk = riskMeta[summary.riskLevel] ?? riskMeta.low;
  const expired = status === 'EXPIRED' || (status === 'PENDING' && !pending);

  return (
    <Card style={styles.actionCard}>
      <View style={styles.actionHeader}>
        <View style={styles.actionHeaderLeft}>
          <Ionicons name="flash" size={16} color={colors.primary} />
          <Text style={styles.actionTitle} numberOfLines={2}>
            {summary.title}
          </Text>
        </View>
        <Badge label={risk.label} fg={risk.fg} bg={risk.bg} />
      </View>

      {!!summary.description && (
        <Text style={styles.actionDesc}>{summary.description}</Text>
      )}

      {summary.diff.length > 0 && (
        <View style={styles.actionBody}>
          {summary.diff.map((d, i) => (
            <View key={i} style={styles.actionLine}>
              <Text style={styles.actionLineLabel}>{d.field}</Text>
              <Text style={styles.actionLineValue}>
                {d.oldValue !== undefined && d.oldValue !== null
                  ? `${formatValue(d.oldValue)} → ${formatValue(d.newValue)}`
                  : formatValue(d.newValue)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {pending && (
        <View style={styles.actionFooter}>
          <Button
            title="取消"
            variant="ghost"
            onPress={onReject}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <Button
            title="确认执行"
            variant={summary.riskLevel === 'high' ? 'danger' : 'primary'}
            onPress={onConfirm}
            disabled={disabled}
            style={{ flex: 2 }}
          />
        </View>
      )}
      {status === 'CONFIRMED' && (
        <View
          style={[
            styles.actionResult,
            { backgroundColor: colors.successLight },
          ]}
        >
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.actionResultText, { color: colors.success }]}>
            已执行：{action.resultSummary ?? '成功'}
          </Text>
        </View>
      )}
      {status === 'REJECTED' && (
        <View style={[styles.actionResult, { backgroundColor: '#F3F4F6' }]}>
          <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
          <Text
            style={[styles.actionResultText, { color: colors.textTertiary }]}
          >
            已取消
          </Text>
        </View>
      )}
      {expired && (
        <View
          style={[
            styles.actionResult,
            { backgroundColor: colors.warningLight },
          ]}
        >
          <Ionicons name="time" size={14} color={colors.warning} />
          <Text style={[styles.actionResultText, { color: colors.warning }]}>
            已过期（10 分钟有效期）
          </Text>
        </View>
      )}
    </Card>
  );
};

const DEFAULT_SUGGESTIONS = [
  '查看房间出租情况',
  '101 水表 126 电表 1780，记一下',
  '一键出账',
  '逾期租金汇总',
  '帮我分析租金定价',
  '张三交房租 2000',
];

export const SuggestionChips = ({
  items,
  onPick,
}: {
  items?: string[];
  onPick: (text: string) => void;
}) => {
  const list = items && items.length > 0 ? items : DEFAULT_SUGGESTIONS;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.suggestions}
    >
      {list.map((s) => (
        <TouchableOpacity
          key={s}
          style={styles.suggestionChip}
          onPress={() => onPick(s)}
          activeOpacity={0.7}
        >
          <Text style={styles.suggestionText} numberOfLines={1}>
            {s}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing(3),
    paddingHorizontal: spacing(4),
  },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(2),
    marginTop: 2,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
  },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistantBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  userText: { color: '#fff', fontSize: fontSize.md, lineHeight: 22 },
  assistantText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(3),
    paddingHorizontal: spacing(4),
    paddingLeft: spacing(4) + 26 + spacing(2),
  },
  toolText: { fontSize: fontSize.xs, color: colors.textTertiary, flex: 1 },
  actionCard: {
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    padding: spacing(3.5),
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
    gap: spacing(2),
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    flex: 1,
  },
  actionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  actionDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  actionBody: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  actionLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: spacing(2),
  },
  actionLineLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  actionLineValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  actionFooter: { flexDirection: 'row', gap: spacing(2) },
  actionResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    borderRadius: radius.sm,
    padding: spacing(2.5),
  },
  actionResultText: { fontSize: fontSize.sm, flex: 1 },
  suggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
  },
  suggestionChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  suggestionText: { fontSize: fontSize.sm, color: colors.primary },
});
