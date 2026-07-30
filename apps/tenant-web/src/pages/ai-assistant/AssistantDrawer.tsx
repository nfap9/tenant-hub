import { useEffect, useMemo, useRef } from 'react';
import {
  Drawer,
  Button,
  Input,
  Space,
  Typography,
  Tooltip,
  Dropdown,
  Spin,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  PlusOutlined,
  HistoryOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import useAiChat from './useAiChat';
import ModelSelector from './ModelSelector';
import MessageBubble from './MessageBubble';
import EmptyState from '@/components/ui/EmptyState';
import styles from './AssistantDrawer.module.scss';

const DEFAULT_TITLE = '新对话';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AssistantDrawer({ open, onClose }: Props) {
  const {
    models,
    modelId,
    setModelId,
    conversations,
    currentConv,
    messages,
    input,
    setInput,
    streaming,
    loadingHistory,
    busyActionId,
    startNewConversation,
    selectConversation,
    handleArchive,
    handleConfirm,
    handleReject,
    send,
    handleAbort,
  } = useAiChat(open);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const conversationMenu = useMemo(
    () => ({
      items: conversations.map((c) => ({
        key: c.id,
        label: (
          <div className={styles.menuItem}>
            <span className={styles.menuItemTitle}>
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
          <RobotOutlined className={styles.brandIcon} />
          <Typography.Text strong>租务助手</Typography.Text>
        </Space>
      }
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      mask={false}
      classNames={{ body: styles.drawerBody }}
    >
      <div className={styles.toolbar}>
        <ModelSelector
          className={styles.modelSelect}
          models={models}
          value={modelId}
          onChange={setModelId}
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

      <div className={styles.messages}>
        {!currentConv && messages.length === 0 && (
          <EmptyState
            title="租务助手"
            description="在下方输入消息，即可开始新对话"
          />
        )}
        {currentConv && loadingHistory && (
          <div className={styles.historyLoading}>
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

      <div className={styles.composer}>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="输入消息，回车发送（Shift+Enter 换行）"
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
        <div className={styles.composerActions}>
          {streaming ? (
            <Button danger icon={<StopOutlined />} onClick={handleAbort}>
              中止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!input.trim()}
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
