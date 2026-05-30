// PAGE-504: 套餐配置
import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined, BuildOutlined } from '@ant-design/icons';
import { getAdminPlans, createAdminPlan, updateAdminPlan } from '@/api/admin';
import type { Plan } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';

export default function OpsPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    getAdminPlans()
      .then(setPlans)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (row: Plan) => {
    try {
      await updateAdminPlan(row.id, { enabled: !row.enabled });
      message.success(row.enabled ? '套餐已停用' : '套餐已启用');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createAdminPlan({
        name: String(values.name),
        apartmentLimit: Number(values.apartmentLimit ?? 1),
        roomLimit: Number(values.roomLimit ?? 20),
        memberLimit: Number(values.memberLimit ?? 3),
        price: Number(values.price ?? 0),
      });
      message.success('套餐已创建');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '运营端' }, { label: '套餐配置' }]}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            新增套餐
          </Button>
        }
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={plans}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '名称', dataIndex: 'name', ellipsis: true },
          { title: '公寓数', dataIndex: 'apartmentLimit' },
          { title: '房间数', dataIndex: 'roomLimit' },
          { title: '成员数', dataIndex: 'memberLimit' },
          {
            title: '价格',
            dataIndex: 'price',
            render: (v: string | number) => `${v}元/年`,
          },
          {
            title: '状态',
            dataIndex: 'enabled',
            render: (v: boolean) => (
              <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag>
            ),
          },
          {
            title: '操作',
            fixed: 'right',
            render: (_: unknown, row: Plan) => (
              <Button
                type="link"
                danger={row.enabled}
                onClick={() => handleToggle(row)}
              >
                {row.enabled ? '停用' : '启用'}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={
          <span className="card-title">
            <BuildOutlined className="title-icon" />
            新增套餐
          </span>
        }
        footer={null}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="套餐名称" rules={[{ required: true }]}>
            <Input placeholder="请输入套餐名称" />
          </Form.Item>
          <Space wrap>
            <Form.Item name="apartmentLimit" label="公寓数" initialValue={1}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="roomLimit" label="房间数" initialValue={20}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="memberLimit" label="成员数" initialValue={3}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="price" label="年费价格" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item className="mt-16">
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
