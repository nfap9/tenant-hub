import { Card, Row, Col } from 'antd';
import {
  HomeOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';

export default function Dashboard() {
  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '首页' }]} />

      <Row gutter={16} className="mb-16">
        <Col xs={12} sm={6}>
          <StatCard
            title="公寓总数"
            value={0}
            prefix="栋"
            color="primary"
            icon={<HomeOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="在住租客"
            value={0}
            prefix="人"
            color="success"
            icon={<TeamOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="有效租约"
            value={0}
            prefix="份"
            color="accent"
            icon={<FileTextOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="本月应收"
            value="0.00"
            prefix="¥"
            color="warning"
            icon={<DollarOutlined />}
          />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card size="small" title="入住率趋势" className="mb-16">
            <div
              style={{
                height: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--th-foreground-subtle)',
              }}
            >
              暂无数据
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="近期账单" className="mb-16">
            <div
              style={{
                height: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--th-foreground-subtle)',
              }}
            >
              暂无数据
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
