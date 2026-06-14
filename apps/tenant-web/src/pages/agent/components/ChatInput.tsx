import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import styles from '../AgentChatPage.module.scss';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  disabled,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        <Input.TextArea
          className={styles.textInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题，按 Enter 发送，Shift+Enter 换行..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={disabled || loading}
        />
        <Button
          type="primary"
          className={styles.sendBtn}
          icon={<SendOutlined />}
          onClick={onSend}
          loading={loading}
          disabled={disabled || !value.trim() || loading}
        />
      </div>
    </div>
  );
}
