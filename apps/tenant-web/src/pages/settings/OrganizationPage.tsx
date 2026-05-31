// PAGE-005: 组织管理页面
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  List,
  Tag,
  message,
  Table,
  Modal,
  Space,
} from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  HomeOutlined,
  UserAddOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  createOrganization,
  joinOrganization,
  getOrganizationInvites,
  createOrganizationInvite,
  updateOrganization,
} from '@/api/organization';
import type { OrgInvite, Membership } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './OrganizationPage.module.scss';
import clsx from 'clsx';

export default function OrganizationPage() {
  const { memberships, currentOrgId, reload } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  const isInOrg = Boolean(currentOrgId);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setCreateModalOpen(true);
    } else if (action === 'join') {
      setJoinModalOpen(true);
    }
    // 清除 query param 避免刷新后重复触发
    if (action) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isInOrg && currentOrgId) {
      loadInvites();
    }
  }, [isInOrg, currentOrgId]);

  const loadInvites = async () => {
    if (!currentOrgId) return;
    try {
      const data = await getOrganizationInvites(currentOrgId);
      setInvites(data);
    } catch {
      // 无权限时静默失败
    }
  };

  const handleCreate = async (values: {
    name: string;
    description?: string;
  }) => {
    setCreateLoading(true);
    try {
      await createOrganization({
        name: values.name.trim(),
        description: values.description?.trim(),
      });
      message.success('组织创建成功');
      createForm.resetFields();
      await reload();
      setCreateModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (values: { inviteCode: string }) => {
    setJoinLoading(true);
    try {
      await joinOrganization({ inviteCode: values.inviteCode.trim() });
      message.success('加入组织成功');
      joinForm.resetFields();
      await reload();
      setJoinModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加入失败');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!currentOrgId) return;
    setInviteLoading(true);
    try {
      await createOrganizationInvite(currentOrgId);
      message.success('邀请码已创建');
      await loadInvites();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建邀请码失败');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEdit = async (values: { name: string; description?: string }) => {
    if (!currentOrgId) return;
    setEditLoading(true);
    try {
      await updateOrganization(currentOrgId, {
        name: values.name.trim(),
        description: values.description?.trim(),
      });
      message.success('组织信息已更新');
      editForm.resetFields();
      await reload();
      setEditModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      message.success('邀请码已复制');
    });
  };

  const orgColumns = [
    {
      title: '组织名称',
      dataIndex: ['organization', 'name'],
      key: 'name',
    },
    {
      title: '角色',
      dataIndex: ['role', 'name'],
      key: 'role',
      render: (text: string) => <Tag color="accent">{text}</Tag>,
    },
    {
      title: '组织编码',
      dataIndex: ['organization', 'code'],
      key: 'code',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Membership) =>
        record.organization.id === currentOrgId ? (
          <Button
            type="link"
            onClick={() => {
              editForm.setFieldsValue({
                name: record.organization.name,
                description: record.organization.description,
              });
              setEditModalOpen(true);
            }}
          >
            编辑
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        back="/settings"
        breadcrumb={[
          { label: '设置', path: '/settings' },
          { label: '组织管理' },
        ]}
        actions={
          <Space>
            <Button
              icon={<UserAddOutlined />}
              onClick={() => setJoinModalOpen(true)}
            >
              加入组织
            </Button>
            <Button
              type="primary"
              icon={<BuildOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              创建组织
            </Button>
          </Space>
        }
      />

      <Card className={clsx(styles.settingsCard, styles.settingsCardSpaced)}>
        {memberships.length > 0 ? (
          <Table
            dataSource={memberships}
            columns={orgColumns}
            rowKey={(record: Membership) => record.organization.id}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <div className={styles.emptyOrgState}>
            <EmptyState
              title="暂无组织"
              description="您还没有加入任何组织，请先创建或加入一个组织"
            />
            <Space className={styles.emptyOrgActions}>
              <Button
                icon={<UserAddOutlined />}
                onClick={() => setJoinModalOpen(true)}
              >
                加入组织
              </Button>
              <Button
                type="primary"
                icon={<BuildOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                创建组织
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {isInOrg && (
        <Card
          title={
            <span className={styles.settingsCardTitle}>
              <UserAddOutlined />
              邀请码管理
            </span>
          }
          className={styles.settingsCard}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateInvite}
            loading={inviteLoading}
            className="mb-16"
          >
            创建邀请码
          </Button>
          {invites.length > 0 ? (
            <List
              size="small"
              dataSource={invites}
              renderItem={(invite) => (
                <List.Item
                  actions={[
                    <Button
                      key="copy"
                      type="link"
                      icon={<CopyOutlined />}
                      onClick={() => copyInviteCode(invite.code)}
                    >
                      复制
                    </Button>,
                  ]}
                >
                  <div className="page-content">
                    <div className={styles.inviteCode}>{invite.code}</div>
                    <div className={styles.inviteMeta}>
                      有效期至 {invite.expiresAt.slice(0, 16).replace('T', ' ')}{' '}
                      · 已用 {invite.usedCount}/{invite.maxUses}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <EmptyState
              title="暂无邀请码"
              description="点击上方按钮创建邀请码"
              action={{
                label: '创建邀请码',
                onClick: handleCreateInvite,
              }}
            />
          )}
        </Card>
      )}

      <Modal
        title="创建组织"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          className={styles.settingsForm}
        >
          <Form.Item
            label="组织名称"
            name="name"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input
              prefix={<HomeOutlined className="text-subtle" />}
              placeholder="例如：阳光公寓"
            />
          </Form.Item>
          <Form.Item label="组织描述（可选）" name="description">
            <Input.TextArea
              placeholder="简要描述你的组织"
              rows={3}
              className="w-full"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={createLoading}
              icon={<PlusOutlined />}
            >
              创建组织
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="加入组织"
        open={joinModalOpen}
        onCancel={() => setJoinModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={joinForm}
          layout="vertical"
          onFinish={handleJoin}
          className={styles.settingsForm}
        >
          <Form.Item
            label="邀请码"
            name="inviteCode"
            rules={[{ required: true, message: '请输入邀请码' }]}
          >
            <Input placeholder="请输入邀请码" className="w-full" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={joinLoading}>
              加入组织
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑组织"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEdit}
          className={styles.settingsForm}
        >
          <Form.Item
            label="组织名称"
            name="name"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input
              prefix={<HomeOutlined className="text-subtle" />}
              placeholder="例如：阳光公寓"
            />
          </Form.Item>
          <Form.Item label="组织描述（可选）" name="description">
            <Input.TextArea
              placeholder="简要描述你的组织"
              rows={3}
              className="w-full"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={editLoading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
