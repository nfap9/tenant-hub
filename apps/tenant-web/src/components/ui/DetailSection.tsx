import { Card } from 'antd';
import type { ReactNode } from 'react';

interface DetailSectionProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DetailSection({
  title,
  actions,
  children,
}: DetailSectionProps) {
  return (
    <Card
      size="small"
      title={<span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>}
      extra={actions}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Card>
  );
}
