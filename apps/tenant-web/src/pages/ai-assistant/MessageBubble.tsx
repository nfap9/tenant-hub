import { Typography, Tag, Collapse, Empty } from 'antd';
import { ToolOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import type { ChatMessage } from './types';
import PendingActionCard from './PendingActionCard';
import type { ChatPendingAction } from './types';

type Props = {
  message: ChatMessage;
  onConfirmAction: (action: ChatPendingAction) => void;
  onRejectAction: (action: ChatPendingAction) => void;
  busyActionId?: string;
};

const roleLabel: Record<string, string> = {
  user: '我',
  assistant: '助手',
  tool: '系统',
};

export default function MessageBubble({
  message,
  onConfirmAction,
  onRejectAction,
  busyActionId,
}: Props) {
  if (message.role === 'tool') {
    return (
      <div style={{ margin: '4px 0', textAlign: 'center' }}>
        <Tag color="default" icon={<ToolOutlined />}>
          {message.text}
        </Tag>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const icon = isUser ? <UserOutlined /> : <RobotOutlined />;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser ? '#2563eb' : '#f0f0f0',
          color: isUser ? '#fff' : '#666',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          maxWidth: '78%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#999',
            marginBottom: 2,
          }}
        >
          {roleLabel[message.role]}
        </div>
        {(message.text ||
          message.pending ||
          (!message.toolCalls?.length && !message.pendingActions?.length)) && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: isUser ? '#2563eb' : '#f5f7fa',
              color: isUser ? '#fff' : '#1f1f1f',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.text || (message.pending ? '思考中…' : '')}
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <Collapse
            size="small"
            style={{ marginTop: 6, width: '100%' }}
            items={message.toolCalls.map((tc, i) => ({
              key: i,
              label: (
                <span style={{ fontSize: 12 }}>
                  <ToolOutlined /> {tc.name}
                </span>
              ),
              children: (
                <Typography.Paragraph style={{ margin: 0 }}>
                  {tc.summary || '执行中…'}
                </Typography.Paragraph>
              ),
            }))}
          />
        )}

        {message.pendingActions && message.pendingActions.length > 0 && (
          <div style={{ marginTop: 6, width: '100%' }}>
            {message.pendingActions.map((action) => (
              <PendingActionCard
                key={action.id}
                action={action}
                onConfirm={onConfirmAction}
                onReject={onRejectAction}
                busy={busyActionId === action.id}
              />
            ))}
          </div>
        )}

        {message.error && (
          <Tag color="red" style={{ marginTop: 4 }}>
            {message.text || '执行出错'}
          </Tag>
        )}

        {!message.text &&
          !message.toolCalls?.length &&
          !message.pendingActions?.length &&
          !message.pending &&
          !message.error && <Empty description={false} />}
      </div>
    </div>
  );
}
