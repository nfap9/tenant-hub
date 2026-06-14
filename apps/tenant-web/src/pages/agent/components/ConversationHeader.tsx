import { Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import styles from '../AgentChatPage.module.scss';

interface ConversationHeaderProps {
  title: string;
  onDelete: () => void;
  deleting?: boolean;
}

export function ConversationHeader({
  title,
  onDelete,
  deleting,
}: ConversationHeaderProps) {
  return (
    <div className={styles.chatHeader}>
      <div className={styles.chatTitle}>{title || '新对话'}</div>
      <Popconfirm
        title="删除对话"
        description="删除后将无法恢复，确定继续吗？"
        onConfirm={onDelete}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: deleting }}
      >
        <Button type="text" danger icon={<DeleteOutlined />} loading={deleting}>
          删除
        </Button>
      </Popconfirm>
    </div>
  );
}
