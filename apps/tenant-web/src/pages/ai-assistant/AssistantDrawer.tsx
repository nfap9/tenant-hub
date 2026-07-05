import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Drawer,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Tooltip,
  Dropdown,
  Spin,
  message,
  Empty,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  PlusOutlined,
  HistoryOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  AiModelOption,
  AiConversationSummary,
  AiMessageRecord,
  streamAiChat,
  listAiModels,
  listAiConversations,
  createAiConversation,
  listAiMessages,
  confirmAiAction,
  rejectAiAction,
  archiveAiConversation,
} from '@/api/ai';
import MessageBubble from './MessageBubble';
import type { ChatMessage, ChatPendingAction } from './types';

const DEFAULT_TITLE = '新对话';

const isExpired = (expiresAt: string) =>
  new Date(expiresAt).getTime() < Date.now();

const messageFromRecord = (record: AiMessageRecord): ChatMessage => {
  if (record.role === 'USER') {
    return {
      id: record.id,
      role: 'user',
      text: typeof record.content === 'string' ? record.content : '',
    };
  }
  if (record.role === 'ASSISTANT') {
    const obj = record.content as { text?: string; toolCalls?: unknown[] };
    return {
      id: record.id,
      role: 'assistant',
      text: obj?.text ?? '',
      toolCalls: (obj?.toolCalls ?? []).map((t, i) => {
        const tc = t as { name?: string; arguments?: unknown };
        return { name: tc?.name ?? `tool-${i}`, summary: '已调用' };
      }),
    };
  }
  if (record.role === 'TOOL') {
    const obj = record.content as { content?: string };
    return {
      id: record.id,
      role: 'tool',
      text: obj?.content ?? '',
    };
  }
  return { id: record.id, role: 'tool', text: '' };
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AssistantDrawer({ open, onClose }: Props) {
  useAppSession();

  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<AiConversationSummary[]>(
    []
  );
  const [currentConv, setCurrentConv] = useState<AiConversationSummary | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await listAiConversations();
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const list = await listAiModels();
      setModels(list);
      setModelId((prev) => prev ?? list[0]?.id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadModels();
      loadConversations();
    }
  }, [open, loadModels, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewConversation = useCallback(async () => {
    if (!modelId) {
      message.warning('暂无可用模型');
      return;
    }
    try {
      const conv = await createAiConversation(modelId);
      setCurrentConv(conv);
      setMessages([]);
      setConversations((prev) => [conv, ...prev]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建会话失败');
    }
  }, [modelId]);

  const selectConversation = useCallback(
    async (conv: AiConversationSummary) => {
      setCurrentConv(conv);
      setModelId(conv.modelId);
      setLoadingHistory(true);
      try {
        const records = await listAiMessages(conv.id);
        setMessages(records.map(messageFromRecord));
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载历史失败');
      } finally {
        setLoadingHistory(false);
      }
    },
    []
  );

  const handleArchive = useCallback(
    async (conv: AiConversationSummary) => {
      try {
        await archiveAiConversation(conv.id);
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (currentConv?.id === conv.id) {
          setCurrentConv(null);
          setMessages([]);
        }
        message.success('已归档');
      } catch (e) {
        message.error(e instanceof Error ? e.message : '归档失败');
      }
    },
    [currentConv]
  );

  const updatePendingAction = useCallback(
    (actionId: string, patch: Partial<ChatPendingAction>) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.pendingActions) return m;
          return {
            ...m,
            pendingActions: m.pendingActions.map((a) =>
              a.id === actionId ? { ...a, ...patch } : a
            ),
          };
        })
      );
    },
    []
  );

  const handleConfirm = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      updatePendingAction(action.id, { state: 'confirming' });
      try {
        const result = await confirmAiAction(action.id);
        updatePendingAction(action.id, {
          state: result.ok ? 'confirmed' : 'expired',
          resultSummary: result.summary,
        });
        if (!result.ok) {
          message.warning(result.summary);
        }
      } catch (e) {
        updatePendingAction(action.id, { state: 'pending' });
        message.error(e instanceof Error ? e.message : '确认失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [updatePendingAction]
  );

  const handleReject = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      try {
        await rejectAiAction(action.id);
        updatePendingAction(action.id, {
          state: 'rejected',
          resultSummary: '用户已拒绝',
        });
      } catch (e) {
        message.error(e instanceof Error ? e.message : '拒绝失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [updatePendingAction]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (!currentConv) {
        message.warning('请先新建会话');
        return;
      }

      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: `pending-${Date.now()}`,
        role: 'assistant',
        text: '',
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setStreaming(true);

      abortRef.current = streamAiChat({
        conversationId: currentConv.id,
        message: trimmed,
        modelId,
        onEvent: (event) => {
          if (event.type === 'text_delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, text: m.text + event.delta }
                  : m
              )
            );
          } else if (event.type === 'assistant_message') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, text: event.text, pending: false }
                  : m
              )
            );
          } else if (event.type === 'tool_call') {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsg.id) return m;
                const toolCalls = m.toolCalls ?? [];
                const last = toolCalls[toolCalls.length - 1];
                if (last && last.name === event.name && !last.summary) {
                  return {
                    ...m,
                    toolCalls: [
                      ...toolCalls.slice(0, -1),
                      { ...last, summary: event.summary },
                    ],
                  };
                }
                return {
                  ...m,
                  toolCalls: [
                    ...toolCalls,
                    { name: event.name, summary: event.summary },
                  ],
                };
              })
            );
          } else if (event.type === 'pending_action') {
            const pending: ChatPendingAction = {
              ...event.action,
              state: isExpired(event.action.expiresAt) ? 'expired' : 'pending',
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      pendingActions: [...(m.pendingActions ?? []), pending],
                    }
                  : m
              )
            );
          } else if (event.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      pending: false,
                      error: true,
                      text: m.text || event.message,
                    }
                  : m
              )
            );
            message.error(event.message);
          } else if (event.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, pending: false } : m
              )
            );
          }
        },
        onError: (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    pending: false,
                    error: true,
                    text: m.text || error.message,
                  }
                : m
            )
          );
          message.error(error.message);
        },
        onClose: () => {
          setStreaming(false);
          abortRef.current = null;
          loadConversations();
        },
      });
    },
    [currentConv, modelId, streaming, loadConversations]
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.pending ? { ...m, pending: false, text: m.text || '已中止' } : m
      )
    );
  }, []);

  const conversationMenu = useMemo(
    () => ({
      items: conversations.map((c) => ({
        key: c.id,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              minWidth: 220,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.title || `${DEFAULT_TITLE} · ${c.updatedAt.slice(0, 10)}`}
            </span>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(c);
              }}
            />
          </div>
        ),
        onClick: () => selectConversation(c),
      })),
    }),
    [conversations, handleArchive, selectConversation]
  );

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#2563eb' }} />
          <Typography.Text strong>租务助手</Typography.Text>
        </Space>
      }
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      mask={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <Select
          size="small"
          style={{ flex: 1 }}
          placeholder="选择模型"
          value={modelId}
          onChange={setModelId}
          options={models.map((m) => ({
            value: m.id,
            label: m.displayName,
          }))}
        />
        <Dropdown
          menu={conversationMenu}
          trigger={['click']}
          placement="bottomRight"
        >
          <Tooltip title="历史会话">
            <Button size="small" icon={<HistoryOutlined />} />
          </Tooltip>
        </Dropdown>
        <Tooltip title="新建会话">
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={startNewConversation}
          />
        </Tooltip>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          background: '#fafafa',
        }}
      >
        {!currentConv && (
          <Empty
            style={{ marginTop: 80 }}
            description="点击右上角 + 开始新对话"
          />
        )}
        {currentConv && loadingHistory && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onConfirmAction={handleConfirm}
            onRejectAction={handleReject}
            busyActionId={busyActionId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder={
            currentConv
              ? '输入消息，回车发送（Shift+Enter 换行）'
              : '请先新建会话'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={streaming}
        />
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {streaming ? (
            <Button danger icon={<StopOutlined />} onClick={handleAbort}>
              中止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!input.trim() || !currentConv}
              onClick={() => send(input)}
            >
              发送
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
