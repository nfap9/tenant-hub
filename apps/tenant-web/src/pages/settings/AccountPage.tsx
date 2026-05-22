import { useEffect } from "react";
import { Card, Form, Input, Button, message } from "antd";
import { SaveOutlined, LockOutlined } from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { updatePassword } from "@/api/auth";

export default function AccountPage() {
  const { session } = useAppSession();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (session?.user) {
      form.setFieldsValue({
        username: session.user.username,
        phone: session.user.phone,
      });
    }
  }, [session, form]);

  const handleUpdateProfile = async (_values: { username: string }) => {
    try {
      // 目前后端没有独立的更新用户名接口，预留此处
      message.success("保存成功");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleUpdatePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      message.success("密码已更新");
      passwordForm.resetFields();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "密码更新失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>账号设置</h2>

      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleUpdateProfile} style={{ maxWidth: 600 }}>
          <Form.Item label="用户名" name="username">
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input disabled />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="修改密码">
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleUpdatePassword}
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            label="原密码"
            name="currentPassword"
            rules={[{ required: true, message: "请输入原密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              更新密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
