import { useState } from 'react';
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
  Select,
  Card,
  Descriptions,
  Checkbox,
} from 'antd';
import {
  SaveOutlined,
  EditOutlined,
  CopyOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  DeleteOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  updateOrganization,
  deleteOrganization,
  refreshOrganizationInviteCode,
  transferOrganizationOwnership,
  disableOrganizationMember,
  updateOrganizationMemberRole,
  createOrganizationRole,
  updateOrganizationRole,
  deleteOrganizationRole,
} from '@/api/organization';
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  hasPermission,
} from '@/utils/permissions';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import EmptyState from '@/components/ui/EmptyState';
import { nameRule, descriptionRule } from '@/utils/validators';
import styles from './OrganizationPage.module.scss';

const PERMISSION_OPTIONS = Object.values(PERMISSIONS).map((value) => ({
  label: PERMISSION_LABELS[value] ?? value,
  value,
}));

export default function OrganizationPage() {
  const { session, currentMembership, members, roles, reload } =
    useAppSession();
  const [editForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [roleForm] = Form.useForm();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalTitle, setRoleModalTitle] = useState('创建角色');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleActionLoading, setRoleActionLoading] = useState<
    Record<string, boolean>
  >({});
  const [memberRoleLoading, setMemberRoleLoading] = useState<
    Record<string, boolean>
  >({});
  const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>(
    {}
  );

  if (!currentMembership) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: '组织设置' }]} />
        <EmptyState description="尚未加入任何组织，请先在个人中心创建或加入组织" />
      </div>
    );
  }

  const org = currentMembership.organization;
  const userPermissions = currentMembership.role.permissions ?? [];
  const isOwner = session?.user.id === org.ownerId;
  const canManageOrg = hasPermission(userPermissions, PERMISSIONS.ORG_MANAGE);
  const canManageMembers = hasPermission(
    userPermissions,
    PERMISSIONS.MEMBER_MANAGE
  );

  const ownerMember = members.find((m) => m.userId === org.ownerId);
  const nonOwnerMembers = members.filter((m) => m.userId !== org.ownerId);
  const transferableOptions = nonOwnerMembers.map((m) => ({
    value: m.userId,
    label: `${m.user.username} (${m.user.phone})`,
  }));

  const handleEditOpen = () => {
    editForm.setFieldsValue({
      name: org.name,
      description: org.description || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (values: {
    name: string;
    description?: string;
  }) => {
    setEditLoading(true);
    try {
      await updateOrganization(org.id, {
        name: values.name.trim(),
        description: values.description?.trim(),
      });
      message.success('组织信息已更新');
      setEditModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (!org.inviteCode) return;
    navigator.clipboard.writeText(org.inviteCode).then(() => {
      message.success('邀请码已复制');
    });
  };

  const handleRefreshInviteCode = async () => {
    setRefreshing(true);
    try {
      await refreshOrganizationInviteCode(org.id);
      message.success('邀请码已刷新');
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMemberRoleChange = async (memberId: string, roleId: string) => {
    setMemberRoleLoading((prev) => ({ ...prev, [memberId]: true }));
    try {
      await updateOrganizationMemberRole(org.id, memberId, roleId);
      message.success('角色已更新');
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    } finally {
      setMemberRoleLoading((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    Modal.confirm({
      title: '确认移除该成员？',
      icon: <ExclamationCircleOutlined />,
      content: '移除后该成员将无法再访问本组织数据。',
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setRemoveLoading((prev) => ({ ...prev, [memberId]: true }));
        try {
          await disableOrganizationMember(org.id, memberId);
          message.success('成员已移除');
          await reload();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '移除失败');
        } finally {
          setRemoveLoading((prev) => ({ ...prev, [memberId]: false }));
        }
      },
    });
  };

  const handleTransfer = async (values: { userId: string }) => {
    setTransferLoading(true);
    try {
      await transferOrganizationOwnership(org.id, values.userId);
      message.success('组织所有权已转移');
      transferForm.resetFields();
      setTransferModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '转移失败');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async (values: { confirmName: string }) => {
    setDeleteLoading(true);
    try {
      await deleteOrganization(org.id, values.confirmName.trim());
      message.success('组织已删除');
      deleteForm.resetFields();
      setDeleteModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateRoleOpen = () => {
    setEditingRoleId(null);
    setRoleModalTitle('创建角色');
    roleForm.resetFields();
    setRoleModalOpen(true);
  };

  const handleEditRoleOpen = (role: (typeof roles)[0]) => {
    setEditingRoleId(role.id);
    setRoleModalTitle('编辑角色');
    roleForm.setFieldsValue({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = async (values: {
    name: string;
    description?: string;
    permissions: string[];
  }) => {
    setRoleLoading(true);
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim(),
        permissions: values.permissions,
      };
      if (editingRoleId) {
        await updateOrganizationRole(org.id, editingRoleId, payload);
        message.success('角色已更新');
      } else {
        await createOrganizationRole(org.id, payload);
        message.success('角色已创建');
      }
      roleForm.resetFields();
      setRoleModalOpen(false);
      await reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    Modal.confirm({
      title: `确认删除角色「${roleName}」？`,
      icon: <ExclamationCircleOutlined />,
      content: '删除后已分配该角色的成员权限将失效，且不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setRoleActionLoading((prev) => ({ ...prev, [roleId]: true }));
        try {
          await deleteOrganizationRole(org.id, roleId);
          message.success('角色已删除');
          await reload();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        } finally {
          setRoleActionLoading((prev) => ({ ...prev, [roleId]: false }));
        }
      },
    });
  };

  const memberColumns = [
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (text: string, record: (typeof members)[0]) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.userId === org.ownerId && <Tag color="warning">所有者</Tag>}
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: ['user', 'phone'],
      key: 'phone',
    },
    {
      title: '角色',
      key: 'role',
      render: (_: unknown, record: (typeof members)[0]) => {
        if (record.userId === org.ownerId) {
          return <Tag color="warning">{record.role.name}</Tag>;
        }
        if (canManageMembers) {
          return (
            <Select
              value={record.role.id}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              loading={memberRoleLoading[record.id]}
              onChange={(roleId) => handleMemberRoleChange(record.id, roleId)}
              style={{ minWidth: 120 }}
            />
          );
        }
        return <Tag>{record.role.name}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: (typeof members)[0]) => {
        if (record.userId === org.ownerId) return '-';
        if (!canManageMembers) return '-';
        return (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={removeLoading[record.id]}
            onClick={() => handleRemoveMember(record.id)}
          >
            移除
          </Button>
        );
      },
    },
  ];

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: (typeof roles)[0]) => (
        <Space>
          <span>{text}</span>
          {record.system && <Tag>系统预设</Tag>}
          {record.id === currentMembership.role.id && (
            <Tag color="success">我</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text?: string) => text || '-',
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => {
        if (permissions.includes('*')) {
          return <Tag color="warning">全部权限</Tag>;
        }
        return (
          <Space size="small" wrap>
            {permissions.map((p) => (
              <Tag key={p}>{PERMISSION_LABELS[p] ?? p}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: (typeof roles)[0]) => {
        if (record.system || !canManageOrg) return '-';
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditRoleOpen(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={roleActionLoading[record.id]}
              onClick={() => handleDeleteRole(record.id, record.name)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '组织设置' }]}
        actions={
          canManageOrg && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEditOpen}
            >
              编辑组织信息
            </Button>
          )
        }
      />

      <Card className={styles.orgOverviewCard}>
        <div className={styles.orgOverviewHeader}>
          <div className={styles.orgIcon}>
            <TeamOutlined />
          </div>
          <div className={styles.orgMeta}>
            <div className={styles.orgName}>{org.name}</div>
            <div className={styles.orgCode}>组织编码：{org.code}</div>
          </div>
        </div>
        <Descriptions column={1} className={styles.orgDescription}>
          <Descriptions.Item label="组织描述">
            {org.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="所有者">
            {ownerMember
              ? `${ownerMember.user.username} (${ownerMember.user.phone})`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="我的角色">
            <Tag color="success">{currentMembership.role.name}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <DetailSection
        title={
          <span className={styles.sectionTitle}>
            <SafetyCertificateOutlined />
            角色权限
          </span>
        }
        actions={
          canManageOrg && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateRoleOpen}
            >
              创建角色
            </Button>
          )
        }
      >
        <Table
          dataSource={roles}
          columns={roleColumns}
          rowKey={(record) => record.id}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </DetailSection>

      <DetailSection
        title={
          <span className={styles.sectionTitle}>
            <TeamOutlined />
            邀请码
          </span>
        }
      >
        <Row gutter={[24, 0]} align="middle">
          <Col>
            <span className={styles.inviteCode}>
              {org.inviteCode || '未生成'}
            </span>
          </Col>
          <Col>
            <Space>
              {org.inviteCode && (
                <Button icon={<CopyOutlined />} onClick={handleCopyInviteCode}>
                  复制
                </Button>
              )}
              {isOwner && (
                <Button
                  icon={<ReloadOutlined />}
                  loading={refreshing}
                  onClick={handleRefreshInviteCode}
                >
                  刷新邀请码
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </DetailSection>

      <DetailSection
        title={
          <span className={styles.sectionTitle}>
            <TeamOutlined />
            成员管理
          </span>
        }
      >
        <Table
          dataSource={members}
          columns={memberColumns}
          rowKey={(record) => record.id}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </DetailSection>

      {isOwner && (
        <DetailSection
          title={
            <span className={styles.sectionTitle}>
              <ExclamationCircleOutlined />
              危险操作
            </span>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card className={styles.dangerCard} size="small">
              <div className={styles.dangerItem}>
                <div>
                  <div className={styles.dangerTitle}>转移组织所有权</div>
                  <div className={styles.dangerDesc}>
                    将组织所有者身份转让给其他成员，转让后你将变为普通成员。
                  </div>
                </div>
                <Button
                  icon={<SwapOutlined />}
                  disabled={transferableOptions.length === 0}
                  onClick={() => setTransferModalOpen(true)}
                >
                  转移所有权
                </Button>
              </div>
            </Card>
            <Card className={styles.dangerCard} size="small">
              <div className={styles.dangerItem}>
                <div>
                  <div className={styles.dangerTitle}>删除组织</div>
                  <div className={styles.dangerDesc}>
                    删除后组织下所有数据将无法恢复，请谨慎操作。
                  </div>
                </div>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteModalOpen(true)}
                >
                  删除组织
                </Button>
              </div>
            </Card>
          </Space>
        </DetailSection>
      )}

      <Modal
        title="编辑组织信息"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
          className={styles.orgForm}
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
              loading={editLoading}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={roleModalTitle}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={handleRoleSubmit}
          className={styles.orgForm}
        >
          <Form.Item label="角色名称" name="name" rules={nameRule('角色名称')}>
            <Input placeholder="例如：财务" maxLength={64} showCount />
          </Form.Item>
          <Form.Item
            label="角色描述"
            name="description"
            rules={[descriptionRule('角色描述')]}
          >
            <Input.TextArea
              rows={2}
              placeholder="可选"
              maxLength={255}
              showCount
            />
          </Form.Item>
          <Form.Item
            label="权限"
            name="permissions"
            rules={[{ required: true, message: '请至少选择一项权限' }]}
          >
            <Checkbox.Group options={PERMISSION_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={roleLoading}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="转移组织所有权"
        open={transferModalOpen}
        onCancel={() => setTransferModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransfer}
          className={styles.orgForm}
        >
          <Form.Item
            label="选择新所有者"
            name="userId"
            rules={[{ required: true, message: '请选择新所有者' }]}
          >
            <Select
              options={transferableOptions}
              placeholder="请选择要转让的成员"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={transferLoading}
              icon={<SaveOutlined />}
            >
              确认转移
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="删除组织"
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={deleteForm}
          layout="vertical"
          onFinish={handleDelete}
          className={styles.orgForm}
        >
          <div className={styles.deleteHint}>
            请输入组织名称 <strong>「{org.name}」</strong> 以确认删除。
          </div>
          <Form.Item
            name="confirmName"
            rules={[
              { required: true, message: '请输入组织名称确认' },
              {
                validator(_, value) {
                  if (!value || value.trim() === org.name) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('组织名称不一致'));
                },
              },
            ]}
          >
            <Input placeholder="请输入组织名称" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={deleteLoading}
              icon={<DeleteOutlined />}
            >
              确认删除
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
