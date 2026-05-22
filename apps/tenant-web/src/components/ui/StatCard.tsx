import { Card } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import './StatCard.scss';

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
      className={`stat-card ${onClick ? 'clickable' : ''}`}
      bodyStyle={{ padding: 'var(--th-space-6)' }}
      onClick={onClick}
      hoverable={!!onClick}
    >
      <div className="stat-card-header">
        <div
          className="stat-card-icon"
          style={{ background: c.bg, color: c.icon }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className="stat-card-trend"
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
      <div className="stat-card-value">
        {prefix && <span className="prefix">{prefix}</span>}
        {value}
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      <div className="stat-card-title-row">
        <span className="stat-card-title">{title}</span>
        {trendLabel && (
          <span className="stat-card-trend-label">{trendLabel}</span>
        )}
      </div>
    </Card>
  );
}
