import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Checkbox,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import {
  listPresetRoles,
  updatePresetRole,
  type PresetRole,
} from '@/api/admin';
import {
  PERMISSIONS,
  PERMISSION_LABELS,
} from '@/utils/permissions';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { nameRule, descriptionRule } from '@/utils/validators';

const PERMISSION_OPTIONS = Object.values(PERMISSIONS).map((value) => ({
  label: PERMISSION_LABELS[value] ?? value,
  value,
}));

type RoleFormValues = {
  name: string;
  description?: string;
  permissions: string[];
};

export default function PresetRolesPage() {
  const [roles, setRoles] = useState<PresetRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PresetRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<RoleFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPresetRoles();
      setRoles(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEditOpen = (role: PresetRole) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: RoleFormValues) => {
    if (!editingRole) return;
    setSubmitting(true);
    try {
      await updatePresetRole(editingRole.id, {
        name: values.name.trim(),
        description: values.description?.trim(),
        permissions: values.permissions,
      });
      message.success('角色已更新');
      setModalOpen(false);
      setEditingRole(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag>{code}</Tag>,
    },
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
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
      render: (_: unknown, record: PresetRole) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEditOpen(record)}
        >
          编辑权限
        </Button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '系统管理' }, { label: '预设角色' }]}
      />

      {!loading && roles.length === 0 ? (
        <EmptyState
          title="暂无预设角色"
          description="系统预设角色在服务启动时自动创建"
        />
      ) : (
        <Table
          dataSource={roles}
          columns={columns}
          rowKey={(record) => record.id}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}

      <Modal
        title={`编辑预设角色 - ${editingRole?.code ?? ''}`}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRole(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="角色名称" name="name" rules={nameRule('角色名称')}>
            <Input placeholder="请输入角色名称" maxLength={64} showCount />
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
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
