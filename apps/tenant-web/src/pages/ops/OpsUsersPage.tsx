import { useEffect, useState } from 'react';
import { Input, Select, Table, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getAdminUsers, updateUserPlatformRole } from '@/api/admin';
import PageHeader from '@/components/ui/PageHeader';
import styles from './OpsUsersPage.module.scss';

const platformRoleOptions = [
  { value: 'USER', label: '普通用户' },
  { value: 'SUPER_ADMIN', label: '超级管理员' },
];

const platformRoleMap = new Map(
  platformRoleOptions.map((item) => [item.value, item.label])
);

export default function OpsUsersPage() {
  const [users, setUsers] = useState<
    Array<{
      id: string;
      username: string;
      phone: string;
      platformRole: string;
      _count?: { memberships: number };
    }>
  >([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminUsers(keyword || undefined)
      .then(setUsers)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '运营端' }, { label: '用户管理' }]}
        actions={
          <Input.Search
            allowClear
            placeholder="搜索手机号或用户名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={load}
            prefix={<SearchOutlined className="text-subtle" />}
            className={styles.searchInput}
          />
        }
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '用户名', dataIndex: 'username', ellipsis: true },
          { title: '手机号', dataIndex: 'phone' },
          {
            title: '组织数',
            render: (_: unknown, row: (typeof users)[0]) =>
              row._count?.memberships ?? 0,
          },
          {
            title: '运营权限',
            dataIndex: 'platformRole',
            render: (value: string) => (
              <Tag color={value === 'USER' ? 'default' : 'success'}>
                {platformRoleMap.get(value) ?? value}
              </Tag>
            ),
          },
          {
            title: '操作',
            fixed: 'right',
            render: (_: unknown, row: (typeof users)[0]) => (
              <Select
                value={row.platformRole}
                className={styles.roleSelect}
                size="small"
                options={platformRoleOptions}
                onChange={async (platformRole) => {
                  try {
                    await updateUserPlatformRole(row.id, platformRole);
                    message.success('运营权限已更新');
                    load();
                  } catch (e) {
                    message.error(
                      e instanceof Error ? e.message : '运营权限更新失败'
                    );
                    load();
                  }
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
