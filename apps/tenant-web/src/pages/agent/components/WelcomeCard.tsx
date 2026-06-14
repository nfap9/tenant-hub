import { RobotOutlined } from '@ant-design/icons';
import styles from '../AgentChatPage.module.scss';

interface WelcomeCardProps {
  onPromptClick?: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  '本月租金收入是多少？',
  '哪些房间空置？',
  '最近 30 天有哪些账单未缴？',
  '帮我统计各公寓的入住率',
];

export function WelcomeCard({ onPromptClick }: WelcomeCardProps) {
  return (
    <div className={styles.welcomeCard}>
      <RobotOutlined style={{ fontSize: 48, color: '#22c55e' }} />
      <h3>智能助手</h3>
      <p>
        我可以帮你查询公寓、房间、租约、账单等数据，并通过图表展示分析结果。
      </p>
      <div className={styles.quickActions}>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.quickBtn}
            onClick={() => onPromptClick?.(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
