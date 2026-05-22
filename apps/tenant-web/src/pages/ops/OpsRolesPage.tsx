import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from "@ant-design/icons";
import { getAdminRoles, createAdminRole, updateAdminRole, deleteAdminRole } from "@/api/admin";
import PageHeader from "@/components/ui/PageHeader";

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
  { code: "member:manage", name: "管理组织成员" },
];

const permissionNameMap = new Map(permissionOptions.map((item) => [item.code, item.name]));

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  system: boolean;
  permissions: string[];
}

export default function OpsRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | undefined>();
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    getAdminRoles()
      .then(setRoles)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (row: RoleItem) => {
    try {
      await deleteAdminRole(row.id);
      message.success("角色已删除");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const permissions = (values.permissions as string[]) || [];
    const payload = {
      code: String(values.code),
      name: String(values.name),
      description: String(values.description || ""),
      permissions,
    };
    try {
      if (editingRole) {
        await updateAdminRole(editingRole.id, payload);
        message.success("角色已更新");
      } else {
        await createAdminRole(payload);
        message.success("角色已新增");
      }
      setModalOpen(false);
      setEditingRole(undefined);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const openCreate = () => {
    setEditingRole(undefined);
    form.setFieldsValue({
      permissions: ["apartment:view", "room:view", "lease:view", "bill:view"],
    });
    setModalOpen(true);
  };

  const openEdit = (row: RoleItem) => {
    setEditingRole(row);
    form.setFieldsValue({
      ...row,
      permissions: row.permissions ?? [],
    });
    setModalOpen(true);
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: "运营端" }, { label: "角色权限" }]}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
            新增角色
          </Button>
        }
      />

      <Card
        style={{
          borderRadius: "var(--th-radius-lg)",
          boxShadow: "var(--th-shadow)",
        }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={roles}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
          columns={[
            { title: "名称", dataIndex: "name", ellipsis: true },
            { title: "编码", dataIndex: "code" },
            {
              title: "系统预置",
              dataIndex: "system",
              render: (v: boolean) => (v ? <Tag color="warning">是</Tag> : <Tag>否</Tag>),
            },
            {
              title: "权限",
              dataIndex: "permissions",
              render: (items: string[]) =>
                items?.map((item) => (
                  <Tag key={item} color={item === "*" ? "warning" : "default"}>
                    {permissionNameMap.get(item) ?? item}
                  </Tag>
                )),
            },
            {
              title: "操作",
              render: (_: unknown, row: RoleItem) => (
                <Space>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(row)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除角色？"
                    description={row.system ? "系统预置角色不可删除" : "删除后不可恢复"}
                    okText="删除"
                    cancelText="取消"
                    disabled={row.system}
                    onConfirm={() => handleDelete(row)}
                  >
                    <Button type="link" danger disabled={row.system} icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={
          <span style={{ fontWeight: 600, color: "var(--th-foreground)" }}>
            <SafetyOutlined style={{ marginRight: 8 }} />
            {editingRole ? "编辑角色" : "新增角色"}
          </span>
        }
        footer={null}
        onCancel={() => {
          setModalOpen(false);
          setEditingRole(undefined);
          form.resetFields();
        }}
      >
        <Form
          key={editingRole?.id ?? "new-role"}
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input size="large" placeholder="请输入角色名称" style={{ borderRadius: "var(--th-radius)" }} />
          </Form.Item>
          <Form.Item
            name="code"
            label="角色编码"
            rules={[{ required: true }]}
            extra="使用小写字母、数字、下划线或中划线"
          >
            <Input
              size="large"
              disabled={editingRole?.system}
              placeholder="例如：manager"
              style={{ borderRadius: "var(--th-radius)" }}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="角色描述（可选）" style={{ borderRadius: "var(--th-radius)" }} />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限码"
            rules={[{ required: true, message: "请选择权限码" }]}
          >
            <Checkbox.Group
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
            >
              {permissionOptions.map((item) => (
                <Checkbox
                  key={item.code}
                  value={item.code}
                  style={{
                    padding: 8,
                    border: "1px solid var(--th-border-light)",
                    borderRadius: "var(--th-radius-sm)",
                    background: "var(--th-bg)",
                  }}
                >
                  <div style={{ color: "var(--th-foreground)", fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--th-foreground-muted)" }}>{item.code}</div>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large">
            保存
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
