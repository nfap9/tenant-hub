import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getMaintenanceOrders,
  createMaintenanceOrder,
  updateMaintenanceOrder,
  updateMaintenanceOrderStatus,
  deleteMaintenanceOrder,
  type MaintenanceOrder,
} from '@/api/maintenance';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'red' },
  DISPATCHED: { label: '已派单', color: 'orange' },
  IN_PROGRESS: { label: '处理中', color: 'blue' },
  AWAITING_ACCEPTANCE: { label: '待验收', color: 'purple' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const priorityMap: Record<string, { label: string; color: string }> = {
  URGENT: { label: '紧急', color: 'red' },
  NORMAL: { label: '一般', color: 'blue' },
  LOW: { label: '低', color: 'default' },
};

const typeMap: Record<string, string> = {
  WATER_ELECTRIC: '水电',
  DOOR_WINDOW: '门窗',
  WALL: '墙面',
  FURNITURE_APPLIANCE: '家具家电',
  NETWORK: '网络',
  PIPE: '管道',
  CLEANING: '清洁',
  OTHER: '其他',
};

export default function MaintenancePage() {
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('lease:manage');
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);
  const [form] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getMaintenanceOrders(currentOrgId, statusFilter);
      setOrders(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    try {
      const payload = {
        ...values,
        materialCost: values.materialCost
          ? Number(values.materialCost)
          : undefined,
        laborCost: values.laborCost ? Number(values.laborCost) : undefined,
        scheduledDate: values.scheduledDate
          ? (values.scheduledDate as dayjs.Dayjs).toISOString()
          : undefined,
      };
      if (editing) {
        await updateMaintenanceOrder(currentOrgId, editing.id, payload);
        message.success('工单已更新');
      } else {
        await createMaintenanceOrder(currentOrgId, payload as MaintenanceOrder);
        message.success('工单已创建');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteMaintenanceOrder(currentOrgId, id);
      message.success('工单已删除');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!currentOrgId) return;
    try {
      await updateMaintenanceOrderStatus(currentOrgId, id, { status });
      message.success('状态已更新');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => typeMap[v] || v,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (v: string) => (
        <Tag color={priorityMap[v]?.color}>{priorityMap[v]?.label}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusMap[v]?.color}>{statusMap[v]?.label}</Tag>
      ),
    },
    { title: '报修人', dataIndex: 'reporterName', key: 'reporterName' },
    {
      title: '费用',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (v: string | number) => `¥${money(v)}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: MaintenanceOrder) => (
        <Space>
          {canManage && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record);
                  form.setFieldsValue({
                    ...record,
                    materialCost: record.materialCost
                      ? Number(record.materialCost)
                      : undefined,
                    laborCost: record.laborCost
                      ? Number(record.laborCost)
                      : undefined,
                    scheduledDate: record.scheduledDate
                      ? dayjs(record.scheduledDate)
                      : undefined,
                  });
                  setModalOpen(true);
                }}
              >
                编辑
              </Button>
              <Select
                size="small"
                value={record.status}
                style={{ width: 100 }}
                onChange={(v) => handleStatusChange(record.id, v)}
                options={Object.entries(statusMap).map(
                  ([value, { label }]) => ({
                    value,
                    label,
                  })
                )}
              />
              <Popconfirm
                title="删除工单"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '维修工单' }]}
        actions={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setModalOpen(true);
              }}
            >
              新建工单
            </Button>
          )
        }
      />
      <Space style={{ marginBottom: 16 }}>
        <span>状态筛选:</span>
        <Select
          allowClear
          placeholder="全部状态"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 120 }}
          options={Object.entries(statusMap).map(([value, { label }]) => ({
            value,
            label,
          }))}
        />
      </Space>
      {orders.length === 0 && !loading ? (
        <EmptyState title="暂无维修工单" description="点击右上角新建工单" />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={orders}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      )}
      <Modal
        title={editing ? '编辑工单' : '新建工单'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(typeMap).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="NORMAL">
            <Select
              options={[
                { value: 'URGENT', label: '紧急' },
                { value: 'NORMAL', label: '一般' },
                { value: 'LOW', label: '低' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="问题描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="reporterName" label="报修人">
            <Input />
          </Form.Item>
          <Form.Item name="reporterPhone" label="联系电话">
            <Input />
          </Form.Item>
          <Form.Item name="assignedTo" label="指派给">
            <Input placeholder="维修人员姓名" />
          </Form.Item>
          <Form.Item name="scheduledDate" label="预约上门时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <Form.Item name="materialCost" label="材料费用">
              <InputNumber min={0} className="w-full" prefix="¥" />
            </Form.Item>
            <Form.Item name="laborCost" label="人工费用">
              <InputNumber min={0} className="w-full" prefix="¥" />
            </Form.Item>
          </div>
          <Form.Item name="beforePhotoUrl" label="维修前照片URL">
            <Input placeholder="请输入照片链接" />
          </Form.Item>
          <Form.Item name="afterPhotoUrl" label="维修后照片URL">
            <Input placeholder="请输入照片链接" />
          </Form.Item>
          <Form.Item name="acceptanceNote" label="验收备注">
            <Input.TextArea rows={2} placeholder="验收意见" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
