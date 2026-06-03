import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input, Button, Avatar, message as antMessage, Popconfirm } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  DeleteOutlined,
  PlusOutlined,
  MessageOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAppSession } from '@/context/AppSessionContext';
import { chatWithAgent, type ChatMessage } from '@/api/agent';
import styles from './AgentChatPage.module.scss';

const QUICK_QUESTIONS = [
  '查看公寓概览',
  '查询空置房间',
  '本月经营数据',
  '查询未缴账单',
  '即将到期的租约',
];

const MAX_CONVERSATION_LIMIT = 50;

interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'radar';
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
  unit?: string;
  colors?: string[];
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'status' | 'error';
  content: string;
  loading?: boolean;
  chartData?: ChartConfig;
  thinking?: string[];
}

interface Conversation {
  id: string;
  title: string;
  messages: DisplayMessage[];
  createdAt: number;
  updatedAt: number;
  loading?: boolean;
}

const CHART_COLORS = [
  '#2563eb',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 模块级活跃流追踪（组件卸载后仍继续运行）
const activeStreams = new Map<string, boolean>();

function useConversations(orgId: string) {
  const storageKey = `agent_conv_${orgId}`;

  const readStorage = useCallback((): Conversation[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }, [storageKey]);

  const writeStorage = useCallback(
    (convs: Conversation[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(convs));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const convs = readStorage();
    // 清除旧的 loading 标记
    let changed = false;
    const cleaned = convs.map((c) => {
      if (c.loading) {
        changed = true;
        return { ...c, loading: false };
      }
      return c;
    });
    if (changed) writeStorage(cleaned);
    return cleaned;
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (conversations.length > 0) return conversations[0].id;
    return null;
  });

  // persist to localStorage on change
  useEffect(() => {
    writeStorage(conversations);
  }, [conversations, writeStorage]);

  // sync from localStorage when remounting (background updates)
  useEffect(() => {
    const convs = readStorage();
    // merge: if any conversation has more messages than in state, use the stored version
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((pc) => {
        const sc = convs.find((c) => c.id === pc.id);
        if (
          sc &&
          sc.messages.length > pc.messages.length &&
          !activeStreams.has(pc.id)
        ) {
          changed = true;
          return { ...sc, loading: false };
        }
        return pc;
      });
      return changed ? next : prev;
    });
  }, [readStorage]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  // 更新对话 localStorage + state
  const persistConv = useCallback(
    (convId: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === convId ? updater(c) : c));
        // 直接写 localStorage 确保后台更新不丢失
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  const createConversation = useCallback(() => {
    const newConv: Conversation = {
      id: generateId(),
      title: '',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => {
      const next = [newConv, ...prev].slice(0, MAX_CONVERSATION_LIMIT);
      writeStorage(next);
      return next;
    });
    setActiveId(newConv.id);
  }, [writeStorage]);

  const deleteConversation = useCallback(
    (id: string) => {
      activeStreams.delete(id);
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        writeStorage(remaining);
        if (activeId === id) {
          setActiveId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activeId, writeStorage]
  );

  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const clearCurrent = useCallback(() => {
    if (activeId) {
      deleteConversation(activeId);
    }
  }, [activeId, deleteConversation]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let convId = activeConversation?.id;
      let initialMessages: DisplayMessage[];

      const userMsg: DisplayMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
      };

      const assistantMsg: DisplayMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        loading: true,
        thinking: [],
      };

      if (!convId) {
        convId = generateId();
        initialMessages = [];
      } else {
        initialMessages = activeConversation?.messages ?? [];
      }

      const currentMessages = [...initialMessages, userMsg, assistantMsg];

      // 标记流活跃 + 初始化对话
      activeStreams.set(convId, true);

      persistConv(convId, (c) => ({
        ...c,
        messages: currentMessages,
        title: c.title || text.trim().slice(0, 30),
        updatedAt: Date.now(),
        loading: true,
      }));

      // 确保非 auto-create 情况下 activeId 正确
      if (!activeConversation?.id) {
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === convId);
          if (!exists) {
            const newConv: Conversation = {
              id: convId,
              title: text.trim().slice(0, 30),
              messages: currentMessages,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              loading: true,
            };
            const next = [newConv, ...prev].slice(0, MAX_CONVERSATION_LIMIT);
            writeStorage(next);
            return next;
          }
          return prev;
        });
        setActiveId(convId);
      }

      const history: ChatMessage[] = [];
      for (const m of initialMessages.slice(-10)) {
        if (m.role === 'user' || m.role === 'assistant') {
          history.push({ role: m.role, content: m.content });
        }
      }

      // 读取 localStorage 中的最新对话列表
      const readConvList = (): Conversation[] => {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed;
          }
        } catch {
          // ignore
        }
        return [];
      };

      // 直接写 localStorage，不依赖 React state（确保后台更新不丢失）
      const syncToStorage = (
        msgs: DisplayMessage[],
        opts?: { final?: boolean }
      ) => {
        const convs = readConvList();
        const idx = convs.findIndex((c) => c.id === convId);
        const base: Conversation =
          idx >= 0
            ? convs[idx]
            : {
                id: convId,
                title: '',
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

        convs[idx >= 0 ? idx : convs.length] = {
          ...base,
          messages: msgs,
          title: base.title || text.trim().slice(0, 30),
          updatedAt: Date.now(),
          loading: opts?.final ? false : true,
        };

        try {
          localStorage.setItem(storageKey, JSON.stringify(convs));
        } catch {
          // ignore
        }
      };

      // 更新消息的辅助函数 — 从 localStorage 读取最新消息后应用 patch
      const patchMsg = (patcher: (msg: DisplayMessage) => DisplayMessage) => {
        // 1) React state 路径（挂载时）
        persistConv(convId, (c) => {
          const msgs = c.messages.map((m) =>
            m.id === assistantMsg.id ? patcher(m) : m
          );
          return {
            ...c,
            messages: msgs,
            title: c.title || text.trim().slice(0, 30),
            updatedAt: Date.now(),
            loading: true,
          };
        });

        // 2) 直接 localStorage 路径（后台时）
        const convs = readConvList();
        const c = convs.find((x) => x.id === convId);
        if (c) {
          const msgs = c.messages.map((m) =>
            m.id === assistantMsg.id ? patcher(m) : m
          );
          syncToStorage(msgs);
        }
      };

      try {
        const stream = chatWithAgent(text.trim(), history, orgId);
        let fullContent = '';

        for await (const chunk of stream) {
          if (chunk.type === 'status') {
            patchMsg((m) => ({
              ...m,
              thinking: [...(m.thinking || []), chunk.content],
            }));
          } else if (chunk.type === 'message') {
            fullContent += chunk.content;
            patchMsg((m) => ({
              ...m,
              content: fullContent,
              loading: false,
            }));
          } else if (chunk.type === 'chart') {
            try {
              const chartData = JSON.parse(chunk.content) as ChartConfig;
              patchMsg((m) => ({
                ...m,
                content: fullContent,
                chartData,
                loading: false,
              }));
            } catch {
              // ignore
            }
          } else if (chunk.type === 'error') {
            patchMsg((m) => ({
              ...m,
              role: 'error' as const,
              content: chunk.content,
              loading: false,
            }));
            break;
          } else if (chunk.type === 'done') {
            patchMsg((m) => ({
              ...m,
              content: fullContent,
              loading: false,
            }));
            break;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '请求失败，请重试';
        patchMsg((m) => ({
          ...m,
          role: 'error' as const,
          content: errorMsg,
          loading: false,
        }));
        antMessage.error(errorMsg);
      } finally {
        activeStreams.delete(convId);
        // 最终写入 localStorage（绕开 React state 确保后台完成）
        const convs = readConvList();
        const c = convs.find((x) => x.id === convId);
        if (c) {
          const finalMsgs = c.messages.map((m) =>
            m.loading ? { ...m, loading: false } : m
          );
          syncToStorage(finalMsgs, { final: true });
        }
        persistConv(convId, (c) => ({
          ...c,
          loading: false,
          messages: c.messages.map((m) =>
            m.loading ? { ...m, loading: false } : m
          ),
        }));
      }
    },
    [orgId, activeConversation, persistConv, writeStorage]
  );

  return {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    switchConversation,
    clearCurrent,
    sendMessage,
  };
}

const ChartRenderer: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { chartType, title, labels, datasets, colors } = config;
  const chartColors = colors || CHART_COLORS;

  const chartData = labels.map((label, i) => {
    const item: Record<string, string | number> = { name: label };
    datasets.forEach((ds) => {
      item[ds.label] = ds.data[i] ?? 0;
    });
    return item;
  });

  const dataKeys = datasets.map((ds) => ds.label);

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={chartColors[i % chartColors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[i % chartColors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={datasets[0]?.data.map((val, i) => ({
                name: labels[i],
                value: val,
              }))}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
            >
              {labels.map((_, i) => (
                <Cell key={i} fill={chartColors[i % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );
      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[i % chartColors.length]}
                fill={chartColors[i % chartColors.length]}
                fillOpacity={0.15}
              />
            ))}
          </AreaChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.chartTitle}>{title}</div>
      <ResponsiveContainer width="100%" height={320}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AgentChatPage() {
  const { currentOrgId } = useAppSession();
  const orgId = currentOrgId || 'default';
  const {
    conversations,
    activeConversation,
    createConversation,
    deleteConversation,
    switchConversation,
    clearCurrent,
    sendMessage,
  } = useConversations(orgId);

  const messages = activeConversation?.messages ?? [];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    setIsLoading(true);
    try {
      await sendMessage(text);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = useCallback(
    async (q: string) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        await sendMessage(q);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sendMessage]
  );

  const handleNewChat = () => {
    createConversation();
  };

  const hasMessages = messages.length > 0;
  const isConvLoading = activeConversation?.loading ?? false;

  return (
    <div className={styles.agentChatPage}>
      <div
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <Button
            type="primary"
            block={!sidebarCollapsed}
            shape={sidebarCollapsed ? 'circle' : undefined}
            icon={<PlusOutlined />}
            onClick={handleNewChat}
          >
            {sidebarCollapsed ? '' : '新对话'}
          </Button>
        </div>
        <div className={styles.conversationList}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`${styles.conversationItem} ${
                conv.id === activeConversation?.id
                  ? styles.conversationActive
                  : ''
              }`}
              onClick={() => switchConversation(conv.id)}
            >
              {conv.loading ? (
                <LoadingOutlined className={styles.conversationIcon} spin />
              ) : (
                <MessageOutlined className={styles.conversationIcon} />
              )}
              <div className={styles.conversationInfo}>
                <div className={styles.conversationTitle}>
                  {conv.title || '新对话'}
                </div>
                <div className={styles.conversationMeta}>
                  {conv.loading ? (
                    '生成中...'
                  ) : (
                    <>
                      {formatTime(conv.updatedAt)} ·{' '}
                      {conv.messages.length > 0
                        ? `${Math.ceil(conv.messages.filter((m) => m.role === 'user').length)} 轮对话`
                        : '空'}
                    </>
                  )}
                </div>
              </div>
              <Popconfirm
                title="确定删除此对话？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  deleteConversation(conv.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
                okText="删除"
                cancelText="取消"
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  className={styles.deleteConvBtn}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className={styles.noConversations}>暂无对话记录</div>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <Button
            type="text"
            size="small"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '展开' : '收起'}
          </Button>
        </div>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.messagesArea}>
          {!activeConversation || (!hasMessages && !isConvLoading) ? (
            <div className={styles.welcomeCard}>
              <RobotOutlined
                style={{ fontSize: 48, color: '#2563eb', marginBottom: 16 }}
              />
              <h3>智能助手</h3>
              <p>
                我是您的公寓管理助手，可以帮您查询公寓、房间、租约、账单等信息，
                <br />
                并进行数据分析和可视化展示。
              </p>
              <div className={styles.quickActions}>
                {QUICK_QUESTIONS.map((q) => (
                  <Button
                    key={q}
                    className={styles.quickBtn}
                    icon={<BulbOutlined />}
                    onClick={() => handleQuickQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${styles[msg.role]}`}
            >
              {msg.role === 'user' && (
                <Avatar
                  className={styles.avatar}
                  icon={<UserOutlined />}
                  style={{ background: '#2563eb' }}
                />
              )}
              {msg.role === 'assistant' && (
                <Avatar
                  className={styles.avatar}
                  icon={<RobotOutlined />}
                  style={{ background: '#22c55e' }}
                />
              )}
              {(msg.role === 'error' || msg.role === 'status') && (
                <div style={{ width: 40 }} />
              )}

              <div className={`${styles.messageBubble} ${styles[msg.role]}`}>
                {msg.loading ? (
                  <div className={styles.typingIndicator}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                ) : (
                  <>
                    {msg.thinking &&
                      msg.thinking.length > 0 &&
                      !msg.loading && (
                        <details className={styles.thinkingPanel}>
                          <summary className={styles.thinkingSummary}>
                            思考过程 ({msg.thinking.length} 步)
                          </summary>
                          <ol className={styles.thinkingList}>
                            {msg.thinking.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </details>
                      )}
                    {msg.content && (
                      <div className={styles.markdownBody}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.chartData && <ChartRenderer config={msg.chartData} />}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {activeConversation && (
          <div className={styles.inputArea}>
            <div className={styles.inputToolbar}>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearCurrent}
                disabled={isLoading}
              >
                清空对话
              </Button>
            </div>
            <div className={styles.inputWrapper}>
              <Input.TextArea
                className={styles.textInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题，按 Enter 发送，Shift+Enter 换行..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={isLoading}
              />
              <Button
                type="primary"
                className={styles.sendBtn}
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={isLoading}
                disabled={!input.trim() || !orgId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
