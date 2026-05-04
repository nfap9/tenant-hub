import { Button, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type AdminSection = "users" | "plans" | "organizations" | "roles";

const titles: Record<AdminSection, string> = {
  users: "用户管理",
  plans: "套餐配置",
  organizations: "组织管理",
  roles: "角色权限"
};

const platformRoleOptions = [
  { value: "NONE", label: "无运营权限" },
  { value: "OPERATOR", label: "运营人员" },
  { value: "ADMIN", label: "管理员" },
  { value: "SUPER_ADMIN", label: "超级管理员" }
];

const platformRoleMap = new Map(platformRoleOptions.map((item) => [item.value, item.label]));

const permissionOptions = [
  { code: "*", name: "全部权限" },
  { code: "apartment:view", name: "查看公寓" },
  { code: "apartment:manage", name: "管理公寓" },
  { code: "room:view", name: "查看房间" },
  { code: "room:manage", name: "管理房间" },
  { code: "lease:view", name: "查看租约" },
  { code: "lease:manage", name: "管理租约" },
  { code: "bill:view", name: "查看账单" },
  { code: "bill:manage", name: "管理账单" },
  { code: "org:manage", name: "管理组织信息" },
  { code: "member:manage", name: "管理组织成员" }
];

const permissionNameMap = new Map(permissionOptions.map((item) => [item.code, item.name]));

export function AdminPage({ section }: { section: AdminSection }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>();
  const [messageApi, contextHolder] = message.useMessage();
  const load = () => {
    api<any[]>("/admin/plans").then(setPlans).catch((error) => messageApi.error(error.message));
    api<any[]>("/admin/organizations").then(setOrgs).catch(() => undefined);
    api<any[]>("/admin/roles").then(setRoles).catch(() => undefined);
    api<any[]>(`/admin/users${userKeyword ? `?keyword=${encodeURIComponent(userKeyword)}` : ""}`).then(setUsers).catch(() => undefined);
  };

  useEffect(load, []);

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>{titles[section]}</h1>
        {section === "plans" ? (
          <Button type="primary" onClick={() => setPlanOpen(true)}>
            新增套餐
          </Button>
        ) : null}
        {section === "roles" ? (
          <Button
            type="primary"
            onClick={() => {
              setEditingRole(undefined);
              setRoleOpen(true);
            }}
          >
            新增角色
          </Button>
        ) : null}
      </div>
      {section === "users" ? (
        <div className="content-band">
          <div className="toolbar">
            <Input.Search
              allowClear
              placeholder="搜索手机号或用户名"
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              onSearch={load}
              style={{ width: 280 }}
            />
          </div>
          <Table
            rowKey="id"
            dataSource={users}
            columns={[
              { title: "用户名", dataIndex: "username" },
              { title: "手机号", dataIndex: "phone" },
              { title: "组织数", render: (_, row) => row._count?.memberships ?? 0 },
              {
                title: "运营权限",
                dataIndex: "effectivePlatformRole",
                render: (value, row) => (
                  <Space>
                    <Tag color={value === "NONE" ? "default" : "green"}>{platformRoleMap.get(value) ?? value}</Tag>
                    {row.bootstrapAdmin ? <Tag color="gold">初始化管理员</Tag> : null}
                  </Space>
                )
              },
              {
                title: "操作",
                render: (_, row) => (
                  <Select
                    value={row.platformRole}
                    style={{ width: 150 }}
                    options={platformRoleOptions}
                    disabled={row.bootstrapAdmin}
                    onChange={async (platformRole) => {
                      await api(`/admin/users/${row.id}/platform-role`, { method: "PUT", body: JSON.stringify({ platformRole }) });
                      messageApi.success("运营权限已更新");
                      load();
                    }}
                  />
                )
              }
            ]}
          />
        </div>
      ) : null}
      {section === "plans" ? (
        <div className="content-band">
          <Table
            rowKey="id"
            dataSource={plans}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "公寓数", dataIndex: "apartmentLimit" },
              { title: "房间数", dataIndex: "roomLimit" },
              { title: "成员数", dataIndex: "memberLimit" },
              { title: "价格", dataIndex: "price", render: (value) => `${value}元/年` },
              { title: "状态", dataIndex: "enabled", render: (value) => <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag> },
              {
                title: "操作",
                render: (_, row) => (
                  <Button
                    type="link"
                    danger={row.enabled}
                    onClick={async () => {
                      await api(`/admin/plans/${row.id}`, { method: "PUT", body: JSON.stringify({ enabled: !row.enabled }) });
                      messageApi.success(row.enabled ? "套餐已停用" : "套餐已启用");
                      load();
                    }}
                  >
                    {row.enabled ? "停用" : "启用"}
                  </Button>
                )
              }
            ]}
          />
        </div>
      ) : null}
      {section === "organizations" ? (
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
      ) : null}
      {section === "roles" ? (
        <div className="content-band">
          <Table
            rowKey="id"
            dataSource={roles}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "编码", dataIndex: "code" },
              { title: "系统预置", dataIndex: "system", render: (value) => (value ? "是" : "否") },
              {
                title: "权限",
                dataIndex: "permissions",
                render: (items: string[]) =>
                  items?.map((item) => (
                    <Tag key={item} color={item === "*" ? "gold" : "default"}>
                      {permissionNameMap.get(item) ?? item}
                      <span className="tag-code">{item}</span>
                    </Tag>
                  ))
              },
              {
                title: "操作",
                render: (_, row) => (
                  <Space>
                    <Button
                      type="link"
                      onClick={() => {
                        setEditingRole(row);
                        setRoleOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除角色？"
                      description={row.system ? "系统预置角色不可删除" : "删除后不可恢复"}
                      okText="删除"
                      cancelText="取消"
                      disabled={row.system}
                      onConfirm={async () => {
                        await api(`/admin/roles/${row.id}`, { method: "DELETE" });
                        messageApi.success("角色已删除");
                        load();
                      }}
                    >
                      <Button type="link" danger disabled={row.system}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        </div>
      ) : null}
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
            <Form.Item name="price" label="年费价格" initialValue={0}>
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
      <Modal
        open={roleOpen}
        title={editingRole ? "编辑角色" : "新增角色"}
        footer={null}
        onCancel={() => {
          setRoleOpen(false);
          setEditingRole(undefined);
        }}
      >
        <Form
          key={editingRole?.id ?? "new-role"}
          layout="vertical"
          initialValues={
            editingRole
              ? { ...editingRole, permissions: editingRole.permissions ?? [] }
              : { permissions: ["apartment:view", "room:view", "lease:view", "bill:view"] }
          }
          onFinish={async (values) => {
            const permissions = values.permissions || [];
            const payload = { code: values.code, name: values.name, description: values.description, permissions };
            if (editingRole) {
              await api(`/admin/roles/${editingRole.id}`, { method: "PUT", body: JSON.stringify(payload) });
              messageApi.success("角色已更新");
            } else {
              await api("/admin/roles", { method: "POST", body: JSON.stringify(payload) });
              messageApi.success("角色已新增");
            }
            setRoleOpen(false);
            setEditingRole(undefined);
            load();
          }}
        >
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true }]} extra="使用小写字母、数字、下划线或中划线">
            <Input disabled={editingRole?.system} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="permissions" label="权限码" rules={[{ required: true, message: "请选择权限码" }]}>
            <Checkbox.Group className="permission-checks">
              {permissionOptions.map((item) => (
                <Checkbox key={item.code} value={item.code}>
                  {item.name}
                  <span className="permission-code">{item.code}</span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </main>
  );
}
