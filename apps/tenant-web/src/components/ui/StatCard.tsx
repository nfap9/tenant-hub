import { Card } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import styles from './StatCard.module.scss';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  icon?: React.ReactNode;
  onClick?: () => void;
}

const colorMap = {
  primary: { bg: 'rgba(15, 118, 110, 0.08)', icon: '#0F766E', text: '#0F766E' },
  success: { bg: 'rgba(34, 197, 94, 0.08)', icon: '#22C55E', text: '#22C55E' },
  warning: { bg: 'rgba(234, 88, 12, 0.08)', icon: '#EA580C', text: '#EA580C' },
  danger: { bg: 'rgba(220, 38, 38, 0.08)', icon: '#DC2626', text: '#DC2626' },
  accent: { bg: 'rgba(3, 105, 161, 0.08)', icon: '#0369A1', text: '#0369A1' },
};

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  trend,
  trendLabel,
  color = 'primary',
  icon,
  onClick,
}: StatCardProps) {
  const c = colorMap[color];
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <Card
      className={clsx(styles.statCard, onClick && styles.clickable)}
      bodyStyle={{ padding: 'var(--th-space-6)' }}
      onClick={onClick}
      hoverable={!!onClick}
    >
      <div className={styles.statCardHeader}>
        <div
          className={styles.statCardIcon}
          style={{ background: c.bg, color: c.icon }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={styles.statCardTrend}
            style={{
              color: trendUp ? '#22C55E' : '#DC2626',
              background: trendUp
                ? 'rgba(34, 197, 94, 0.08)'
                : 'rgba(220, 38, 38, 0.08)',
            }}
          >
            {trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={styles.statCardValue}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        {value}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      <div className={styles.statCardTitleRow}>
        <span className={styles.statCardTitle}>{title}</span>
        {trendLabel && (
          <span className={styles.statCardTrendLabel}>{trendLabel}</span>
        )}
      </div>
    </Card>
  );
}
