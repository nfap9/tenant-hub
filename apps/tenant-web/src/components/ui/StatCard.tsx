import { Card } from 'antd';
import styles from './StatCard.module.scss';

interface StatCardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  icon?: React.ReactNode;
}

const colorMap = {
  primary: 'var(--th-primary)',
  success: 'var(--th-success)',
  warning: 'var(--th-warning)',
  danger: 'var(--th-danger)',
  accent: 'var(--th-accent)',
};

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  color = 'primary',
  icon,
}: StatCardProps) {
  return (
    <Card size="small" className={styles.card} bodyStyle={{ padding: '16px' }}>
      <div className={styles.title}>
        {icon && <span className={styles.icon}>{icon}</span>}
        {title}
      </div>
      <div className={styles.value} style={{ color: colorMap[color] }}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        {value}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </Card>
  );
}
