import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input, Button, Avatar, message as antMessage } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  DeleteOutlined,
  FolderOutlined,
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
import {
  chatWithAgent,
  type ChatMessage,
  type ChartConfig,
  getConversations,
  getConversation,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
  saveMessages,
  type ServerConversation,
} from '@/api/agent';
import styles from './AgentChatPage.module.scss';

const QUICK_QUESTIONS = [
  '查看公寓概览',
  '查询空置房间',
  '本月经营数据',
  '查询未缴账单',
  '即将到期的租约',
];

const MAX_LOCAL_CACHE = 10;

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
  serverId?: string;
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
  const storageKey = `agent_conv_${orgId}_cache`;

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
        window.dispatchEvent(new Event('agent-conversations-change'));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const convs = readStorage();
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

  const [serverList, setServerList] = useState<ServerConversation[]>([]);

  // 加载后端列表
  useEffect(() => {
    getConversations({ limit: 20 })
      .then((res) => setServerList(res.items))
      .catch(() => {});
  }, [orgId]);

  // persist to localStorage on change
  useEffect(() => {
    writeStorage(conversations);
  }, [conversations, writeStorage]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const persistConv = useCallback(
    (convId: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === convId ? updater(c) : c));
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
          window.dispatchEvent(new Event('agent-conversations-change'));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  const createConversation = useCallback(async () => {
    try {
      const serverConv = await apiCreateConversation('');
      const newConv: Conversation = {
        id: serverConv.id,
        serverId: serverConv.id,
        title: '',
        messages: [],
        createdAt: new Date(serverConv.createdAt).getTime(),
        updatedAt: new Date(serverConv.updatedAt).getTime(),
      };
      setConversations((prev) => {
        const next = [newConv, ...prev].slice(0, MAX_LOCAL_CACHE);
        writeStorage(next);
        return next;
      });
      setActiveId(newConv.id);
      // 刷新后端列表
      getConversations({ limit: 20 })
        .then((res) => setServerList(res.items))
        .catch(() => {});
    } catch {
      // 降级到本地创建
      const newConv: Conversation = {
        id: generateId(),
        title: '',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations((prev) => {
        const next = [newConv, ...prev].slice(0, MAX_LOCAL_CACHE);
        writeStorage(next);
        return next;
      });
      setActiveId(newConv.id);
    }
  }, [writeStorage]);

  const deleteConversation = useCallback(
    async (id: string) => {
      activeStreams.delete(id);
      const conv = conversations.find((c) => c.id === id);
      if (conv?.serverId) {
        try {
          await apiDeleteConversation(conv.serverId);
        } catch {
          // ignore
        }
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        writeStorage(remaining);
        if (activeId === id) {
          setActiveId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
      setServerList((prev) => prev.filter((c) => c.id !== id));
    },
    [activeId, conversations, writeStorage]
  );

  const archiveConversation = useCallback(
    async (id: string, archived: boolean) => {
      const conv = conversations.find((c) => c.id === id);
      const serverId = conv?.serverId ?? id;
      try {
        await apiUpdateConversation(serverId, { archived });
        antMessage.success(archived ? '已归档' : '已取消归档');
      } catch {
        antMessage.error('操作失败');
        return;
      }
      if (archived) {
        setConversations((prev) => {
          const remaining = prev.filter((c) => c.id !== id);
          writeStorage(remaining);
          return remaining;
        });
        if (activeId === id) {
          setActiveId(null);
        }
      }
      // 刷新后端列表
      getConversations({ limit: 20 })
        .then((res) => setServerList(res.items))
        .catch(() => {});
    },
    [activeId, conversations, writeStorage]
  );

  const switchConversation = useCallback(
    async (id: string) => {
      const localConv = conversations.find((c) => c.id === id);
      if (localConv && localConv.messages.length > 0) {
        setActiveId(id);
        return;
      }
      // 从后端拉取
      try {
        const detail = await getConversation(id);
        const conv: Conversation = {
          id: detail.id,
          serverId: detail.id,
          title: detail.title,
          messages: detail.messages.map((m) => ({
            id: m.id,
            role: m.role as DisplayMessage['role'],
            content: m.content,
            chartData: m.chartData,
            thinking: m.thinking,
          })),
          createdAt: new Date(detail.createdAt).getTime(),
          updatedAt: new Date(detail.updatedAt).getTime(),
        };
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== id);
          const next = [conv, ...filtered].slice(0, MAX_LOCAL_CACHE);
          writeStorage(next);
          return next;
        });
        setActiveId(id);
      } catch {
        antMessage.error('加载会话失败');
      }
    },
    [conversations, writeStorage]
  );

  const clearCurrent = useCallback(() => {
    if (activeId) {
      deleteConversation(activeId);
    }
  }, [activeId, deleteConversation]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let convId = activeConversation?.id;
      let serverConvId = activeConversation?.serverId;
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
        // 没有活跃会话，尝试创建后端会话
        try {
          const serverConv = await apiCreateConversation(
            text.trim().slice(0, 30)
          );
          convId = serverConv.id;
          serverConvId = serverConv.id;
          initialMessages = [];
          const newConv: Conversation = {
            id: convId,
            serverId: serverConvId,
            title: text.trim().slice(0, 30),
            messages: [],
            createdAt: new Date(serverConv.createdAt).getTime(),
            updatedAt: new Date(serverConv.updatedAt).getTime(),
          };
          setConversations((prev) => {
            const next = [newConv, ...prev].slice(0, MAX_LOCAL_CACHE);
            writeStorage(next);
            return next;
          });
          setActiveId(convId);
        } catch {
          // 降级到本地创建
          convId = generateId();
          serverConvId = undefined;
          initialMessages = [];
        }
      } else {
        initialMessages = activeConversation?.messages ?? [];
      }

      const currentMessages = [...initialMessages, userMsg, assistantMsg];

      activeStreams.set(convId, true);

      persistConv(convId, (c) => ({
        ...c,
        messages: currentMessages,
        title: c.title || text.trim().slice(0, 30),
        updatedAt: Date.now(),
        loading: true,
      }));

      if (!activeConversation?.id) {
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === convId);
          if (!exists) {
            const newConv: Conversation = {
              id: convId,
              serverId: serverConvId,
              title: text.trim().slice(0, 30),
              messages: currentMessages,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              loading: true,
            };
            const next = [newConv, ...prev].slice(0, MAX_LOCAL_CACHE);
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
                serverId: serverConvId,
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
          window.dispatchEvent(new Event('agent-conversations-change'));
        } catch {
          // ignore
        }
      };

      const patchMsg = (patcher: (msg: DisplayMessage) => DisplayMessage) => {
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
        const stream = chatWithAgent(text.trim(), history, orgId, serverConvId);
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

        // 保存到后端
        if (serverConvId) {
          const allConvs = readConvList();
          const currentConv = allConvs.find((x) => x.id === convId);
          if (currentConv) {
            const msgsToSave = currentConv.messages
              .filter((m) => !m.loading && m.role !== 'status')
              .map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                chartData: m.chartData,
                thinking: m.thinking,
              }));
            try {
              await saveMessages(serverConvId, msgsToSave);
              // 刷新后端列表
              import('@/api/agent')
                .then(({ getConversations: apiGetConversations }) =>
                  apiGetConversations({ limit: 20 })
                )
                .then((res) => setServerList(res.items))
                .catch(() => {});
            } catch {
              // 静默失败
            }
          }
        }
      }
    },
    [orgId, activeConversation, persistConv, writeStorage]
  );

  return {
    conversations,
    serverList,
    activeConversation,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    archiveConversation,
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

export default function AgentChatPage() {
  const { currentOrgId } = useAppSession();
  const orgId = currentOrgId || 'default';
  const navigate = useNavigate();
  const location = useLocation();
  const processedSearchRef = useRef('');

  const {
    activeConversation,
    createConversation,
    switchConversation,
    clearCurrent,
    sendMessage,
    archiveConversation,
  } = useConversations(orgId);

  // 响应 URL 参数（从主菜单进入）
  useEffect(() => {
    const search = location.search;
    if (processedSearchRef.current === search) return;
    processedSearchRef.current = search;

    const params = new URLSearchParams(search);
    const action = params.get('action');
    const convId = params.get('conv');

    if (action === 'new') {
      createConversation();
      navigate('/agent', { replace: true });
    } else if (convId && convId !== activeConversation?.id) {
      switchConversation(convId);
    }
  }, [location.search]);

  const messages = activeConversation?.messages ?? [];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const handleArchive = useCallback(async () => {
    if (!activeConversation?.id) return;
    await archiveConversation(activeConversation.id, true);
  }, [activeConversation, archiveConversation]);

  const hasMessages = messages.length > 0;
  const isConvLoading = activeConversation?.loading ?? false;

  return (
    <div className={styles.agentChatPage}>
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
                icon={<FolderOutlined />}
                onClick={handleArchive}
                disabled={isLoading}
              >
                归档对话
              </Button>
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
