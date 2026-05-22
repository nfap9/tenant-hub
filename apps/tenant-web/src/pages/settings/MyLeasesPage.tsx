import { Card } from 'antd';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import './MyLeasesPage.scss';

export default function MyLeasesPage() {
  return (
    <div className="page-content">
      <PageHeader
        back="/settings"
        breadcrumb={[
          { label: '设置', path: '/settings' },
          { label: '我的租约' },
        ]}
      />
      <Card className="settings-card">
        <EmptyState title="暂无租约" description="当前没有关联的租约记录" />
      </Card>
    </div>
  );
}
