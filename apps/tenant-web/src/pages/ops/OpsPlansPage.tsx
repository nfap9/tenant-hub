import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Space, Table, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getAdminPlans, createAdminPlan, updateAdminPlan } from "@/api/admin";
import type { Plan } from "@/types/domain";

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
      message.success(row.enabled ? "套餐已停用" : "套餐已启用");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
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
      message.success("套餐已创建");
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "创建失败");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>套餐配置</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增套餐</Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={plans}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "名称", dataIndex: "name" },
            { title: "公寓数", dataIndex: "apartmentLimit" },
            { title: "房间数", dataIndex: "roomLimit" },
            { title: "成员数", dataIndex: "memberLimit" },
            { title: "价格", dataIndex: "price", render: (v: string | number) => `${v}元/年` },
            { title: "状态", dataIndex: "enabled", render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "启用" : "停用"}</Tag> },
            {
              title: "操作",
              render: (_: unknown, row: Plan) => (
                <Button type="link" danger={row.enabled} onClick={() => handleToggle(row)}>
                  {row.enabled ? "停用" : "启用"}
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={modalOpen} title="新增套餐" footer={null} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="套餐名称" rules={[{ required: true }]}>
            <Input />
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
          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
