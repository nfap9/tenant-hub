// PAGE-601: 组织内角色权限管理页面
import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Spin, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getOrganizationMembers,
  getOrganizationRoles,
} from '@/api/organization';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { OrgMember, OrgRole } from '@/types/domain';

const permissionLabels: Record<string, string> = {
  'apartment:view': '公寓查看',
  'apartment:manage': '公寓管理',
  'room:view': '房间查看',
  'room:manage': '房间管理',
  'lease:view': '租约查看',
  'lease:manage': '租约管理',
  'bill:view': '账单查看',
  'bill:manage': '账单管理',
  'deposit:view': '押金查看',
  'deposit:manage': '押金管理',
  'tenant:view': '租客查看',
  'tenant:manage': '租客管理',
  'meter:view': '表具查看',
  'meter:manage': '表具管理',
  'account:view': '账户查看',
  'account:manage': '账户管理',
  '*': '全部权限',
};

export default function RolesPage() {
  const { currentOrgId } = useAppSession();
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        getOrganizationRoles(currentOrgId),
        getOrganizationMembers(currentOrgId),
      ]);
      setRoles(r);
      setMembers(m);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '角色',
      key: 'role',
      render: (_: unknown, record: OrgRole) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div className="text-muted">{record.code}</div>
        </div>
      ),
    },
    {
      title: '系统角色',
      dataIndex: 'system',
      key: 'system',
      render: (v: boolean) =>
        v ? <Tag color="blue">是</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '成员数',
      key: 'count',
      render: (_: unknown, record: OrgRole) =>
        members.filter((m) => m.roleId === record.id).length,
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_: unknown, record: OrgRole) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {record.permissions.map((p) => (
            <Tag key={p} color="processing">
              {permissionLabels[p] || p}
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        back="/settings"
        breadcrumb={[
          { label: '设置', path: '/settings' },
          { label: '角色权限' },
        ]}
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      <Spin spinning={loading}>
        {roles.length === 0 ? (
          <EmptyState title="暂无角色" description="请联系平台管理员配置角色" />
        ) : (
          <Card>
            <Table
              rowKey="id"
              dataSource={roles}
              columns={columns}
              pagination={false}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
}
