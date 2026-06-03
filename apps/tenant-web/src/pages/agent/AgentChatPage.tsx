import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, Avatar, message as antMessage } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  DeleteOutlined,
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
  return Math.random().toString(36).slice(2, 9);
}

function usePersistedMessages(orgId: string) {
  const storageKey = `agent_chat_${orgId}`;

  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (m: DisplayMessage) => !m.loading
          ) as DisplayMessage[];
        }
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });

  // persist whenever messages change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore storage errors (e.g. quota exceeded)
    }
  }, [messages, storageKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { messages, setMessages, clearMessages };
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
  const [input, setInput] = useState('');
  const { messages, setMessages, clearMessages } = usePersistedMessages(
    currentOrgId || 'default'
  );
  const [isLoading, setIsLoading] = useState(false);
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
      if (!text.trim() || !currentOrgId || isLoading) return;

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
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsLoading(true);
      abortRef.current = false;

      const history: ChatMessage[] = [];
      for (const m of messages.slice(-10)) {
        if (m.role === 'user' || m.role === 'assistant') {
          history.push({ role: m.role, content: m.content });
        }
      }

      try {
        const stream = chatWithAgent(text.trim(), history, currentOrgId);
        let fullContent = '';

        for await (const chunk of stream) {
          if (abortRef.current) break;

          if (chunk.type === 'status') {
            // 保持 loading 状态，可选更新 status 显示
          } else if (chunk.type === 'message') {
            fullContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: false }
                  : m
              )
            );
          } else if (chunk.type === 'chart') {
            try {
              const chartData = JSON.parse(chunk.content) as ChartConfig;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullContent, chartData, loading: false }
                    : m
                )
              );
            } catch {
              // 图表数据解析失败，忽略
            }
          } else if (chunk.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      role: 'error',
                      content: chunk.content,
                      loading: false,
                    }
                  : m
              )
            );
            break;
          } else if (chunk.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, role: 'error', content: errorMsg, loading: false }
              : m
          )
        );
        antMessage.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [currentOrgId, isLoading, messages]
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

  return (
    <div className={styles.agentChatPage}>
      <div className={styles.chatContainer}>
        <div className={styles.messagesArea}>
          {messages.length > 0 && (
            <div className={styles.chatToolbar}>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={clearMessages}
              >
                清空对话
              </Button>
            </div>
          )}
          {messages.length === 0 && (
            <div className={styles.welcomeCard}>
              <RobotOutlined
                style={{
                  fontSize: 48,
                  color: '#2563eb',
                  marginBottom: 16,
                }}
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
          )}

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

        <div className={styles.inputArea}>
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
              disabled={!input.trim() || !currentOrgId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
