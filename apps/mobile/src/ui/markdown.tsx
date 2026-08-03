import React, { type ReactNode } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Renderer, useMarkdown, type MarkedStyles } from 'react-native-marked';
import { colors, fontSize, radius, spacing } from './theme';

/** 等宽字体（代码块/行内代码用） */
const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/** 列数不超过该值时表格均分气泡宽度、文字换行；超过则横向滚动 */
const TABLE_ADAPTIVE_MAX_COLS = 4;
/** 横向滚动表格的单列最小宽度 */
const TABLE_WIDE_COL_MIN_WIDTH = 88;

/**
 * 代码块文字样式：库默认复用 em（斜体）样式渲染代码文本，
 * 这里覆盖为等宽非斜体，容器样式仍走 styles.code
 */
class ChatMarkdownRenderer extends Renderer {
  code(
    text: string,
    language?: string,
    containerStyle?: ViewStyle,
    textStyle?: TextStyle
  ): ReactNode {
    return super.code(text, language, containerStyle, {
      ...(textStyle ?? {}),
      fontFamily: MONO_FONT,
      fontSize: fontSize.sm,
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: 20,
    });
  }

  /**
   * 表格：覆盖库默认实现（默认每列固定 43% 屏宽，气泡内必溢出）。
   * 窄表（<= TABLE_ADAPTIVE_MAX_COLS 列）各列 flex 均分气泡宽度、文字换行；
   * 宽表退化为横向滚动，列宽设下限并显示滚动条提示可滑。
   */
  table(
    header: ReactNode[],
    rows: ReactNode[][],
    tableStyle?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle
  ): ReactNode {
    const flat = StyleSheet.flatten(tableStyle) ?? {};
    const { marginVertical, ...boxStyle } = flat;
    const borderColor = boxStyle.borderColor ?? colors.border;
    const cols = header.length;
    const wide = cols > TABLE_ADAPTIVE_MAX_COLS;
    const colWidth = wide
      ? Math.max(
          TABLE_WIDE_COL_MIN_WIDTH,
          Math.floor(Dimensions.get('window').width / 4)
        )
      : 0;

    const grid = (
      <View
        style={[
          boxStyle,
          { borderColor, borderRadius: radius.sm, overflow: 'hidden' },
        ]}
      >
        {[header, ...rows].map((cells, r) => (
          <View
            key={this.getKey()}
            style={[
              rowStyle,
              r > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor,
              },
              r === 0 && { backgroundColor: colors.bg },
            ]}
          >
            {cells.map((cell, c) => (
              <View
                key={this.getKey()}
                style={[
                  cellStyle,
                  wide ? { width: colWidth } : { flex: 1 },
                  c > 0 && {
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderColor,
                  },
                ]}
              >
                {cell}
              </View>
            ))}
          </View>
        ))}
      </View>
    );

    if (!wide) {
      return (
        <View key={this.getKey()} style={{ marginVertical }}>
          {grid}
        </View>
      );
    }
    return (
      <ScrollView
        key={this.getKey()}
        horizontal
        showsHorizontalScrollIndicator
        style={{ marginVertical }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {grid}
      </ScrollView>
    );
  }
}

const renderer = new ChatMarkdownRenderer();

const mdTheme = {
  colors: {
    text: colors.text,
    link: colors.primary,
    border: colors.border,
    code: colors.bg,
  },
};

/** 聊天气泡 markdown 样式：标题层级收敛、代码浅色底等宽、表格带边框、链接用主色 */
const mdStyles: MarkedStyles = {
  text: { fontSize: fontSize.md, lineHeight: 22, color: colors.text },
  paragraph: { paddingVertical: spacing(1) },
  h1: {
    fontSize: fontSize.xl,
    lineHeight: 26,
    fontWeight: '700',
    marginVertical: spacing(1.5),
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  h2: {
    fontSize: fontSize.lg,
    lineHeight: 24,
    fontWeight: '700',
    marginVertical: spacing(1),
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  h3: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: '700',
    marginVertical: spacing(1),
  },
  h4: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: '600',
    marginVertical: spacing(1),
  },
  h5: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
    marginVertical: spacing(0.5),
  },
  h6: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
    marginVertical: spacing(0.5),
  },
  link: { color: colors.primary, fontStyle: 'normal' },
  codespan: {
    fontFamily: MONO_FONT,
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: fontSize.sm,
    backgroundColor: colors.bg,
  },
  code: {
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    marginVertical: spacing(1),
  },
  blockquote: {
    borderLeftColor: colors.border,
    borderLeftWidth: 2,
    paddingLeft: spacing(2.5),
    marginVertical: spacing(1),
    opacity: 0.85,
  },
  hr: { borderBottomColor: colors.border, marginVertical: spacing(2) },
  li: { fontSize: fontSize.md, lineHeight: 22, color: colors.text },
  table: { borderColor: colors.border, marginVertical: spacing(1) },
  tableCell: { padding: spacing(1.5) },
};

/**
 * AI 回复 markdown 渲染。
 * 用 useMarkdown 直接输出元素数组（不走库内部 FlatList），
 * 避免气泡在外层 FlatList cell 内产生嵌套 VirtualizedList 告警。
 */
export const AssistantMarkdown = ({ content }: { content: string }) => {
  const elements = useMarkdown(content, {
    colorScheme: 'light',
    renderer,
    theme: mdTheme,
    styles: mdStyles,
  });
  return <View>{elements}</View>;
};
