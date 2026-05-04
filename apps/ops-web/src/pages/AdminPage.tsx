import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

export function AdminPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const load = () => {
    api<any[]>("/admin/plans").then(setPlans).catch((error) => messageApi.error(error.message));
    api<any[]>("/admin/organizations").then(setOrgs).catch(() => undefined);
    api<any[]>("/admin/roles").then(setRoles).catch(() => undefined);
  };

  useEffect(load, []);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>运营配置</h1>
      </div>
      <Tabs
        items={[
          {
            key: "plans",
            label: "套餐",
            children: (
              <div className="content-band">
                <div className="toolbar">
                  <Button type="primary" onClick={() => setPlanOpen(true)}>
                    新增套餐
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  dataSource={plans}
                  columns={[
                    { title: "名称", dataIndex: "name" },
                    { title: "公寓数", dataIndex: "apartmentLimit" },
                    { title: "房间数", dataIndex: "roomLimit" },
                    { title: "成员数", dataIndex: "memberLimit" },
                    { title: "价格", dataIndex: "price" },
                    { title: "状态", dataIndex: "enabled", render: (value) => <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag> }
                  ]}
                />
              </div>
            )
          },
          {
            key: "orgs",
            label: "组织",
            children: (
              <div className="content-band">
                <Table
                  rowKey="id"
                  dataSource={orgs}
                  columns={[
                    { title: "组织", dataIndex: "name" },
                    { title: "编码", dataIndex: "code" },
                    { title: "公寓", render: (_, row) => row._count?.apartments },
                    { title: "成员", render: (_, row) => row._count?.members },
                    { title: "状态", dataIndex: "status" },
                    {
                      title: "操作",
                      render: (_, row) => (
                        <Select
                          value={row.status}
                          style={{ width: 116 }}
                          options={["ACTIVE", "SUSPENDED", "DELETED"].map((value) => ({ value, label: value }))}
                          onChange={async (status) => {
                            await api(`/admin/organizations/${row.id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
                            load();
                          }}
                        />
                      )
                    }
                  ]}
                />
              </div>
            )
          },
          {
            key: "roles",
            label: "角色权限",
            children: (
              <div className="content-band">
                <Table
                  rowKey="id"
                  dataSource={roles}
                  columns={[
                    { title: "名称", dataIndex: "name" },
                    { title: "编码", dataIndex: "code" },
                    { title: "系统预置", dataIndex: "system", render: (value) => (value ? "是" : "否") },
                    { title: "权限", dataIndex: "permissions", render: (items: string[]) => items?.map((item) => <Tag key={item}>{item}</Tag>) }
                  ]}
                />
              </div>
            )
          }
        ]}
      />
      <Modal open={planOpen} title="新增套餐" footer={null} onCancel={() => setPlanOpen(false)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api("/admin/plans", { method: "POST", body: JSON.stringify(values) });
            setPlanOpen(false);
            load();
          }}
        >
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
            <Form.Item name="price" label="价格" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
