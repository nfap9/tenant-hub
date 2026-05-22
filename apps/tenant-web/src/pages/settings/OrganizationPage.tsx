import { useState, useEffect } from "react";
import { Card, Form, Input, Button, Empty, List, Tag, Tabs, message, Table } from "antd";
import { PlusOutlined, CopyOutlined } from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import {
  createOrganization,
  joinOrganization,
  getOrganizationInvites,
  createOrganizationInvite,
} from "@/api/organization";
import type { OrgInvite, Membership } from "@/types/domain";

export default function OrganizationPage() {
  const { memberships, currentOrgId, reload } = useAppSession();
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("my-orgs");

  const isInOrg = Boolean(currentOrgId);

  useEffect(() => {
    if (isInOrg && currentOrgId) {
      loadInvites();
    }
  }, [isInOrg, currentOrgId]);

  const loadInvites = async () => {
    if (!currentOrgId) return;
    try {
      const data = await getOrganizationInvites(currentOrgId);
      setInvites(data);
    } catch {
      // 无权限时静默失败
    }
  };

  const handleCreate = async (values: { name: string; description?: string }) => {
    setCreateLoading(true);
    try {
      await createOrganization({
        name: values.name.trim(),
        description: values.description?.trim(),
      });
      message.success("组织创建成功");
      createForm.resetFields();
      await reload();
      setActiveTab("my-orgs");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (values: { inviteCode: string }) => {
    setJoinLoading(true);
    try {
      await joinOrganization({ inviteCode: values.inviteCode.trim() });
      message.success("加入组织成功");
      joinForm.resetFields();
      await reload();
      setActiveTab("my-orgs");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "加入失败");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!currentOrgId) return;
    setInviteLoading(true);
    try {
      await createOrganizationInvite(currentOrgId);
      message.success("邀请码已创建");
      await loadInvites();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "创建邀请码失败");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      message.success("邀请码已复制");
    });
  };

  const orgColumns = [
    {
      title: "组织名称",
      dataIndex: ["organization", "name"],
      key: "name",
    },
    {
      title: "角色",
      dataIndex: ["role", "name"],
      key: "role",
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "组织编码",
      dataIndex: ["organization", "code"],
      key: "code",
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>组织管理</h2>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: "my-orgs",
          label: "我的组织",
          children: (
            <div>
              {memberships.length > 0 ? (
                <Table
                  dataSource={memberships}
                  columns={orgColumns}
                  rowKey={(record: Membership) => record.organization.id}
                  pagination={false}
                  style={{ marginBottom: 24 }}
                />
              ) : (
                <Empty description="暂无组织，请先创建或加入组织" style={{ marginBottom: 24 }} />
              )}

              {isInOrg && (
                <Card title="邀请码管理" style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateInvite}
                    loading={inviteLoading}
                    style={{ marginBottom: 16 }}
                  >
                    创建邀请码
                  </Button>
                  {invites.length > 0 ? (
                    <List
                      size="small"
                      dataSource={invites}
                      renderItem={(invite) => (
                        <List.Item
                          actions={[
                            <Button
                              key="copy"
                              type="link"
                              icon={<CopyOutlined />}
                              onClick={() => copyInviteCode(invite.code)}
                            >
                              复制
                            </Button>,
                          ]}
                        >
                          <div>
                            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600 }}>
                              {invite.code}
                            </div>
                            <div style={{ color: "#888", fontSize: 12 }}>
                              有效期至 {invite.expiresAt.slice(0, 16).replace("T", " ")} · 已用{" "}
                              {invite.usedCount}/{invite.maxUses}
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无邀请码" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>
              )}
            </div>
          ),
        },
        {
          key: "create",
          label: "创建组织",
          children: (
            <Card>
              <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ maxWidth: 480 }}>
                <Form.Item
                  label="组织名称"
                  name="name"
                  rules={[{ required: true, message: "请输入组织名称" }]}
                >
                  <Input placeholder="例如：阳光公寓" />
                </Form.Item>
                <Form.Item label="组织描述（可选）" name="description">
                  <Input.TextArea placeholder="简要描述你的组织" rows={3} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={createLoading} icon={<PlusOutlined />}>
                    创建组织
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
        {
          key: "join",
          label: "加入组织",
          children: (
            <Card>
              <Form form={joinForm} layout="vertical" onFinish={handleJoin} style={{ maxWidth: 480 }}>
                <Form.Item
                  label="邀请码"
                  name="inviteCode"
                  rules={[{ required: true, message: "请输入邀请码" }]}
                >
                  <Input placeholder="请输入邀请码" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={joinLoading}>
                    加入组织
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
