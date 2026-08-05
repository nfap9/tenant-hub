import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import {
  TeamOutlined,
  ApartmentOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { listAllOrganizations, listAllUsers } from '@/api/admin';
import { listManagedAiModels } from '@/api/aiModels';
import { listPresetRoles } from '@/api/admin';
import PageHeader from '@/components/ui/PageHeader';

export default function AdminDashboardPage() {
  const [orgCount, setOrgCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [modelCount, setModelCount] = useState(0);
  const [roleCount, setRoleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listAllOrganizations().catch(() => []),
      listAllUsers().catch(() => []),
      listManagedAiModels().catch(() => []),
      listPresetRoles().catch(() => []),
    ]).then(([orgs, users, models, roles]) => {
      setOrgCount(orgs.length);
      setUserCount(users.length);
      setModelCount(models.length);
      setRoleCount(roles.length);
      setLoading(false);
    });
  }, []);

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '概览' }]} />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="组织数"
              value={orgCount}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="用户数"
              value={userCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="AI 模型"
              value={modelCount}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="预设角色"
              value={roleCount}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
