import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Tag, message, Table, Modal, Space } from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  HomeOutlined,
  UserAddOutlined,
  BuildOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  createOrganization,
  joinOrganization,
  refreshOrganizationInviteCode,
} from '@/api/organization';
import type { Membership } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import styles from './OrganizationPage.module.scss';

export default function OrganizationPage() {
  const { memberships, reload, session } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [refreshingOrgId, setRefreshingOrgId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setCreateModalOpen(true);
    } else if (action === 'join') {
      setJoinModalOpen(true);
    }
    if (action) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const handleRefreshInviteCode = async (organizationId: string) => {
    setRefreshingOrgId(organizationId);
    try {
      await refreshOrganizationInviteCode(organizationId);
      message.success('邀请码已刷新');
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setRefreshingOrgId(null);
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
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '组织编码',
      dataIndex: ['organization', 'code'],
      key: 'code',
    },
    {
      title: '邀请码',
      key: 'inviteCode',
      render: (_: unknown, record: Membership) => {
        const isOrgOwner = record.organization.ownerId === session?.user.id;
        if (!isOrgOwner) return '-';
        const code = record.organization.inviteCode;
        if (!code) {
          return (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              loading={refreshingOrgId === record.organization.id}
              onClick={() => handleRefreshInviteCode(record.organization.id)}
            >
              生成邀请码
            </Button>
          );
        }
        return (
          <Space>
            <span style={{ fontFamily: 'monospace' }}>{code}</span>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyInviteCode(code)}
            >
              复制
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              loading={refreshingOrgId === record.organization.id}
              onClick={() => handleRefreshInviteCode(record.organization.id)}
            >
              刷新
            </Button>
          </Space>
        );
      },
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

      <DetailSection>
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
      </DetailSection>

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
    </div>
  );
}
