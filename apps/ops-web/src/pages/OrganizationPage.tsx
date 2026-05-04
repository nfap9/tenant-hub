import { Button, Form, Input, Modal, Space, Table, message } from "antd";
import { useState } from "react";
import { api, writeSession } from "../api/client";

export function OrganizationPage({ memberships, onChanged }: { memberships: any[]; onChanged: () => void }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>组织管理</h1>
        <Space>
          <Button onClick={() => setJoinOpen(true)}>加入组织</Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            创建组织
          </Button>
        </Space>
      </div>
      <div className="content-band">
        <Table
          rowKey={(row) => row.organization.id}
          dataSource={memberships}
          columns={[
            { title: "组织名称", render: (_, row) => row.organization.name },
            { title: "组织编码", render: (_, row) => row.organization.code },
            { title: "角色", render: (_, row) => row.role.name },
            {
              title: "操作",
              render: (_, row) => (
                <Button onClick={() => writeSession({ organizationId: row.organization.id })} type="link">
                  设为当前
                </Button>
              )
            }
          ]}
        />
      </div>
      <Modal open={createOpen} title="创建组织" footer={null} onCancel={() => setCreateOpen(false)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api("/organizations", { method: "POST", body: JSON.stringify(values) });
            messageApi.success("组织已创建");
            setCreateOpen(false);
            onChanged();
          }}
        >
          <Form.Item name="name" label="组织名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
      <Modal open={joinOpen} title="加入组织" footer={null} onCancel={() => setJoinOpen(false)}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api("/organizations/join", { method: "POST", body: JSON.stringify(values) });
            messageApi.success("已加入组织");
            setJoinOpen(false);
            onChanged();
          }}
        >
          <Form.Item name="code" label="组织编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            加入
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
