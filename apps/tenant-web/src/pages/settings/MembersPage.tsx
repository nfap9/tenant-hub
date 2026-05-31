// PAGE-006: 组织成员管理页面
import { useState, useEffect, useCallback } from 'react';

import {
  Card,
  Table,
  Tag,
  Select,
  Button,
  message,
  Spin,
  Modal,
  Form,
  Input,
} from 'antd';
import { ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getOrganizationMembers,
  getOrganizationRoles,
  updateMemberRole,
  removeMember,
  addMemberByPhone,
} from '@/api/organization';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { OrgMember, OrgRole } from '@/types/domain';
import styles from './MembersPage.module.scss';

export default function MembersPage() {
  const { currentOrgId, roles: ctxRoles } = useAppSession();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>(ctxRoles);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm] = Form.useForm();
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [m, r] = await Promise.all([
        getOrganizationMembers(currentOrgId),
        getOrganizationRoles(currentOrgId),
      ]);
      setMembers(m);
      setRoles(r);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (memberId: string, roleId: string) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '修改角色',
      content: '确定要修改该成员的角色吗？',
      onOk: async () => {
        try {
          await updateMemberRole(currentOrgId, memberId, roleId);
          message.success('角色已更新');
          loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '更新失败');
        }
      },
    });
  };

  const handleRemove = async (memberId: string) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '移除成员',
      content: '确定要将该成员移出组织吗？',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeMember(currentOrgId, memberId);
          message.success('成员已移除');
          loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '移除失败');
        }
      },
    });
  };

  const handleInviteByPhone = async (values: { phone: string }) => {
    if (!currentOrgId) return;
    setInviteLoading(true);
    try {
      await addMemberByPhone(currentOrgId, values.phone.trim());
      message.success('成员已添加');
      setInviteModalOpen(false);
      inviteForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加失败');
    } finally {
      setInviteLoading(false);
    }
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: OrgMember) => (
        <div>
          <div>{record.user.username || record.user.phone}</div>
          <div className="text-muted">{record.user.phone}</div>
        </div>
      ),
    },
    {
      title: '角色',
      key: 'role',
      render: (_: unknown, record: OrgMember) => (
        <Select
          value={record.roleId}
          style={{ width: 160 }}
          onChange={(value) => handleRoleChange(record.id, value)}
          options={roles.map((r) => ({
            value: r.id,
            label: r.name,
          }))}
        />
      ),
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_: unknown, record: OrgMember) => (
        <div className={styles.permissionTags}>
          {record.role.permissions.includes('*') ? (
            <Tag color="success">全部权限</Tag>
          ) : (
            record.role.permissions
              .slice(0, 3)
              .map((p) => <Tag key={p}>{p}</Tag>)
          )}
          {record.role.permissions.length > 3 && (
            <Tag>+{record.role.permissions.length - 3}</Tag>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: OrgMember) => (
        <Button type="link" danger onClick={() => handleRemove(record.id)}>
          移除
        </Button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        back="/settings"
        breadcrumb={[
          { label: '设置', path: '/settings' },
          { label: '成员管理' },
        ]}
        actions={
          <>
            <Button
              icon={<UserAddOutlined />}
              onClick={() => setInviteModalOpen(true)}
            >
              邀请成员
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
          </>
        }
      />

      <Spin spinning={loading}>
        {members.length === 0 ? (
          <EmptyState
            title="暂无成员"
            description="邀请用户加入组织后，成员将显示在这里"
          />
        ) : (
          <Card>
            <Table
              rowKey="id"
              dataSource={members}
              columns={columns}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}
      </Spin>

      <Modal
        title="通过手机号添加成员"
        open={inviteModalOpen}
        onCancel={() => setInviteModalOpen(false)}
        onOk={() => inviteForm.submit()}
        confirmLoading={inviteLoading}
      >
        <Form
          form={inviteForm}
          layout="vertical"
          onFinish={handleInviteByPhone}
        >
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input placeholder="请输入用户手机号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
