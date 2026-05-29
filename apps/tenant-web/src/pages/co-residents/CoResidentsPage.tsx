import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getCoResidents,
  createCoResident,
  updateCoResident,
  deleteCoResident,
  type CoResident,
} from '@/api/coResidents';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function CoResidentsPage() {
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('lease:manage');
  const [residents, setResidents] = useState<CoResident[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const initializedRef = useRef(false);

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getCoResidents(currentOrgId);
      setResidents(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    initializedRef.current = false;
    setModalOpen(true);
  };

  const openEdit = (record: CoResident) => {
    setEditingId(record.id);
    form.resetFields();
    initializedRef.current = false;
    form.setFieldsValue({
      tenantId: record.tenantId,
      leaseId: record.leaseId,
      name: record.name,
      idCard: record.idCard,
      phone: record.phone,
      relation: record.relation,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    try {
      if (editingId) {
        await updateCoResident(
          currentOrgId,
          editingId,
          values as Parameters<typeof updateCoResident>[2]
        );
        message.success('同住人已更新');
      } else {
        await createCoResident(
          currentOrgId,
          values as Omit<CoResident, 'id' | 'tenant' | 'lease'>
        );
        message.success('同住人已添加');
      }
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteCoResident(currentOrgId, id);
      message.success('已删除');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '身份证号', dataIndex: 'idCard', key: 'idCard' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '关系', dataIndex: 'relation', key: 'relation' },
    {
      title: '主租客',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      render: (_: unknown, r: CoResident) => r.tenant?.name,
    },
    {
      title: '房间',
      key: 'room',
      render: (_: unknown, r: CoResident) => r.lease?.room?.roomNo,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: CoResident) => (
        <Space>
          {canManage && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="删除同住人"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '同住人管理' }]}
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              添加同住人
            </Button>
          )
        }
      />
      {residents.length === 0 && !loading ? (
        <EmptyState title="暂无同住人记录" description="点击右上角添加同住人" />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={residents}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      )}
      <Modal
        title={editingId ? '编辑同住人' : '添加同住人'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="tenantId"
            label="主租客ID"
            rules={[{ required: true }]}
          >
            <Input placeholder="租客ID" disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="leaseId" label="租约ID" rules={[{ required: true }]}>
            <Input placeholder="租约ID" disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="idCard" label="身份证号">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="relation" label="关系">
            <Input placeholder="配偶/父母/子女/朋友等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
