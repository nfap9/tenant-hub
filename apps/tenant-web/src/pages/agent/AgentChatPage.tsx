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

function useConversations(orgId: string) {
  const storageKey = `agent_conv_${orgId}`;

  const [conversations, setConversations] = useState<Conversation[]>(() => {
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
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (conversations.length > 0) return conversations[0].id;
    return null;
  });

  // persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations, storageKey]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const updateMessages = useCallback(
    (messages: DisplayMessage[]) => {
      setConversations((prev) => {
        if (!activeId) return prev;
        return prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages,
                title:
                  c.title ||
                  messages
                    .find((m) => m.role === 'user')
                    ?.content.slice(0, 30) ||
                  '新对话',
                updatedAt: Date.now(),
              }
            : c
        );
      });
    },
    [activeId]
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
      return next;
    });
    setActiveId(newConv.id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activeId]
  );

  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const clearCurrent = useCallback(() => {
    if (activeId) {
      deleteConversation(activeId);
    }
  }, [activeId, deleteConversation]);

  return {
    conversations,
    activeConversation,
    activeId,
    setConversations,
    setActiveId,
    updateMessages,
    createConversation,
    deleteConversation,
    switchConversation,
    clearCurrent,
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
    setConversations,
    setActiveId,
    createConversation,
    deleteConversation,
    switchConversation,
    clearCurrent,
  } = useConversations(orgId);

  const messages = activeConversation?.messages ?? [];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !orgId || isLoading) return;

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

      // auto-create conversation if none active
      let convId = activeConversation?.id;
      let initialMessages: DisplayMessage[];

      if (!convId) {
        convId = generateId();
        initialMessages = [];
        const newConv: Conversation = {
          id: convId,
          title: text.trim().slice(0, 30),
          messages: initialMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setConversations((prev) =>
          [newConv, ...prev].slice(0, MAX_CONVERSATION_LIMIT)
        );
        setActiveId(convId);
      } else {
        initialMessages = messages;
      }

      const currentMessages = [...initialMessages, userMsg, assistantMsg];
      setIsLoading(true);
      setInput('');
      abortRef.current = false;

      // use a helper to update in the conversation list directly
      const updateConv = (
        updater: (msgs: DisplayMessage[]) => DisplayMessage[]
      ) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: updater(c.messages),
                  title: c.title || text.trim().slice(0, 30),
                  updatedAt: Date.now(),
                }
              : c
          )
        );
      };
      updateConv(() => currentMessages);

      const history: ChatMessage[] = [];
      for (const m of initialMessages.slice(-10)) {
        if (m.role === 'user' || m.role === 'assistant') {
          history.push({ role: m.role, content: m.content });
        }
      }

      try {
        const stream = chatWithAgent(text.trim(), history, orgId);
        let fullContent = '';

        for await (const chunk of stream) {
          if (abortRef.current) break;

          if (chunk.type === 'status') {
            updateConv((msgs) =>
              msgs.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, thinking: [...(m.thinking || []), chunk.content] }
                  : m
              )
            );
          } else if (chunk.type === 'message') {
            fullContent += chunk.content;
            updateConv((msgs) =>
              msgs.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: false }
                  : m
              )
            );
          } else if (chunk.type === 'chart') {
            try {
              const chartData = JSON.parse(chunk.content) as ChartConfig;
              updateConv((msgs) =>
                msgs.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullContent, chartData, loading: false }
                    : m
                )
              );
            } catch {
              // ignore
            }
          } else if (chunk.type === 'error') {
            updateConv((msgs) =>
              msgs.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      role: 'error' as const,
                      content: chunk.content,
                      loading: false,
                    }
                  : m
              )
            );
            break;
          } else if (chunk.type === 'done') {
            updateConv((msgs) =>
              msgs.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: false }
                  : m
              )
            );
            break;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '请求失败，请重试';
        updateConv((msgs) =>
          msgs.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  role: 'error' as const,
                  content: errorMsg,
                  loading: false,
                }
              : m
          )
        );
        antMessage.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId, isLoading, messages, activeConversation, setConversations]
  );

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (q: string) => {
    sendMessage(q);
  };

  const handleNewChat = () => {
    createConversation();
  };

  const hasMessages = messages.length > 0;

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
              <MessageOutlined className={styles.conversationIcon} />
              <div className={styles.conversationInfo}>
                <div className={styles.conversationTitle}>
                  {conv.title || '新对话'}
                </div>
                <div className={styles.conversationMeta}>
                  {formatTime(conv.updatedAt)} ·{' '}
                  {conv.messages.length > 0
                    ? `${Math.ceil(conv.messages.filter((m) => m.role === 'user').length)} 轮对话`
                    : '空'}
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
          {!activeConversation || (!hasMessages && activeConversation) ? (
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
                {msg.loading && msg.role === 'assistant' ? (
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
