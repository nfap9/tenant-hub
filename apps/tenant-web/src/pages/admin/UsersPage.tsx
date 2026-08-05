import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Select, message, Modal } from 'antd';
import {
  listAllUsers,
  updateUserSystemRole,
  type AdminUser,
} from '@/api/admin';
import type { SystemRole } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: '系统管理员',
  OPERATOR: '运营人员',
};

const SYSTEM_ROLE_COLORS: Record<string, string> = {
  SYSTEM_ADMIN: 'purple',
  OPERATOR: 'blue',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAllUsers();
      setUsers(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (userId: string, role: SystemRole) => {
    const user = users.find((u) => u.id === userId);
    const label = role ? SYSTEM_ROLE_LABELS[role] : '普通用户';
    const action = role ? `设为${label}` : `取消系统角色（设为普通用户）`;

    Modal.confirm({
      title: `确认${action}？`,
      content: user ? `用户：${user.username}（${user.phone}）` : '',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setUpdatingId(userId);
        try {
          await updateUserSystemRole(userId, role);
          message.success('已更新');
          await load();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '更新失败');
        } finally {
          setUpdatingId(null);
        }
      },
    });
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '系统角色',
      key: 'systemRole',
      render: (_: unknown, record: AdminUser) => {
        if (record.systemRole) {
          return (
            <Tag color={SYSTEM_ROLE_COLORS[record.systemRole] ?? 'default'}>
              {SYSTEM_ROLE_LABELS[record.systemRole] ?? record.systemRole}
            </Tag>
          );
        }
        return <Tag>普通用户</Tag>;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AdminUser) => (
        <Select
          value={record.systemRole}
          style={{ width: 150 }}
          loading={updatingId === record.id}
          onChange={(value: SystemRole) => handleRoleChange(record.id, value)}
          options={[
            { value: null, label: '普通用户' },
            { value: 'OPERATOR', label: '运营人员' },
            { value: 'SYSTEM_ADMIN', label: '系统管理员' },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '系统管理' }, { label: '用户管理' }]} />

      {!loading && users.length === 0 ? (
        <EmptyState title="暂无用户" description="系统中还没有任何用户" />
      ) : (
        <Table
          dataSource={users}
          columns={columns}
          rowKey={(record) => record.id}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  );
}
