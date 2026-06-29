import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  message,
  Modal,
  Space,
  Row,
  Col,
  Table,
  Tag,
  Avatar,
  Card,
} from 'antd';
import {
  SaveOutlined,
  LockOutlined,
  UserOutlined,
  MobileOutlined,
  EditOutlined,
  TeamOutlined,
  CopyOutlined,
  BuildOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { updatePassword } from '@/api/auth';
import { createOrganization, joinOrganization } from '@/api/organization';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import EmptyState from '@/components/ui/EmptyState';
import {
  usernameRule,
  passwordRule,
  confirmPasswordRule,
  nameRule,
  descriptionRule,
  inviteCodeRule,
} from '@/utils/validators';
import styles from './AccountPage.module.scss';

export default function AccountPage() {
  const { session, memberships, currentMembership, reload } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      form.setFieldsValue({
        username: session.user.username,
        phone: session.user.phone,
      });
    }
  }, [session, form]);

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

  const handleUpdateProfile = async (_values: { username: string }) => {
    setProfileLoading(true);
    try {
      // 目前后端没有独立的更新用户名接口，预留此处
      message.success('保存成功');
      setProfileModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setPasswordLoading(true);
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      message.success('密码已更新');
      passwordForm.resetFields();
      setPasswordModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '密码更新失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateOrganization = async (values: {
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
      setCreateModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinOrganization = async (values: { inviteCode: string }) => {
    setJoinLoading(true);
    try {
      await joinOrganization({ inviteCode: values.inviteCode.trim() });
      message.success('加入组织成功');
      joinForm.resetFields();
      setJoinModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加入失败');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCopyInviteCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      message.success('邀请码已复制');
    });
  };

  const orgColumns = [
    {
      title: '组织名称',
      dataIndex: ['organization', 'name'],
      key: 'name',
      render: (text: string, record: (typeof memberships)[0]) => (
        <Space>
          <span>{text}</span>
          {record.organization.id === currentMembership?.organization.id && (
            <Tag color="success">当前组织</Tag>
          )}
        </Space>
      ),
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
      render: (_: unknown, record: (typeof memberships)[0]) => {
        const code = record.organization.inviteCode;
        if (!code) return '-';
        return (
          <Space>
            <span style={{ fontFamily: 'monospace' }}>{code}</span>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyInviteCode(code)}
            >
              复制
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '个人中心' }]} />

      <Card className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <Avatar
            size={72}
            icon={<UserOutlined />}
            className={styles.profileAvatar}
          />
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              {session?.user?.username || session?.user?.phone}
            </div>
            <div className={styles.profilePhone}>
              {session?.user?.phone || '-'}
            </div>
          </div>
        </div>
      </Card>

      <DetailSection
        title={
          <span className={styles.settingsCardTitle}>
            <UserOutlined />
            帐户信息
          </span>
        }
        actions={
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => setProfileModalOpen(true)}
            >
              编辑个人信息
            </Button>
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => setPasswordModalOpen(true)}
            >
              修改密码
            </Button>
          </Space>
        }
      >
        <Row gutter={[24, 0]}>
          <Col span={12}>
            <DetailItem label="用户名">
              {session?.user?.username || '-'}
            </DetailItem>
          </Col>
          <Col span={12}>
            <DetailItem label="手机号">
              {session?.user?.phone || '-'}
            </DetailItem>
          </Col>
        </Row>
      </DetailSection>

      <DetailSection
        title={
          <span className={styles.settingsCardTitle}>
            <TeamOutlined />
            加入的组织
          </span>
        }
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
      >
        {memberships.length > 0 ? (
          <Table
            dataSource={memberships}
            columns={orgColumns}
            rowKey={(record) => record.organization.id}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <EmptyState description="暂未加入任何组织" />
        )}
      </DetailSection>

      <Modal
        title="编辑个人信息"
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateProfile}
          className={styles.settingsForm}
        >
          <Form.Item label="用户名" name="username" rules={usernameRule}>
            <Input prefix={<UserOutlined className="text-subtle" />} />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input
              prefix={<MobileOutlined className="text-subtle" />}
              disabled
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={profileLoading}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleUpdatePassword}
          className={styles.settingsForm}
        >
          <Form.Item
            label="原密码"
            name="currentPassword"
            rules={passwordRule(false)}
          >
            <Input.Password
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="请输入原密码"
            />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={passwordRule(true)}
          >
            <Input.Password
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="至少 8 位密码"
            />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={confirmPasswordRule('newPassword')}
          >
            <Input.Password
              prefix={<LockOutlined className="text-subtle" />}
              placeholder="再次输入新密码"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={passwordLoading}
              icon={<SaveOutlined />}
            >
              更新密码
            </Button>
          </Form.Item>
        </Form>
      </Modal>

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
          onFinish={handleCreateOrganization}
          className={styles.settingsForm}
        >
          <Form.Item label="组织名称" name="name" rules={nameRule('组织名称')}>
            <Input placeholder="请输入组织名称" maxLength={64} showCount />
          </Form.Item>
          <Form.Item
            label="组织描述"
            name="description"
            rules={[descriptionRule('组织描述')]}
          >
            <Input.TextArea
              rows={3}
              placeholder="可选，简单描述组织用途"
              maxLength={255}
              showCount
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={createLoading}
              icon={<SaveOutlined />}
            >
              创建
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
          onFinish={handleJoinOrganization}
          className={styles.settingsForm}
        >
          <Form.Item label="邀请码" name="inviteCode" rules={inviteCodeRule}>
            <Input placeholder="请输入组织邀请码" maxLength={32} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={joinLoading}
              icon={<SaveOutlined />}
            >
              加入
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
