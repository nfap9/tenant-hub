import { Button, Form, Input, Segmented, Space, Tabs, message } from "antd";
import { useState } from "react";
import { api, type Session } from "../api/client";

export function AuthPage({ onAuthed }: { onAuthed: (session: Session) => void }) {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [messageApi, contextHolder] = message.useMessage();

  const sendOtp = async (phone: string, purpose: "REGISTER" | "LOGIN") => {
    try {
      await api("/auth/otp", { method: "POST", body: JSON.stringify({ phone, purpose }) });
      messageApi.success("验证码已发送，请查看后端控制台");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "验证码发送失败");
    }
  };

  return (
    <div className="auth-shell">
      {contextHolder}
      <div className="auth-panel">
        <h1 className="brand">Tenant Hub</h1>
        <Tabs
          items={[
            {
              key: "login",
              label: "登录",
              children: (
                <>
                  <Segmented block value={mode} onChange={(value) => setMode(value as "password" | "otp")} options={[{ label: "密码", value: "password" }, { label: "验证码", value: "otp" }]} />
                  <Form
                    layout="vertical"
                    style={{ marginTop: 18 }}
                    onFinish={async (values) => {
                      try {
                        const result = await api<Session>(mode === "password" ? "/auth/login/password" : "/auth/login/otp", {
                          method: "POST",
                          body: JSON.stringify(values)
                        });
                        onAuthed(result);
                      } catch (error) {
                        messageApi.error(error instanceof Error ? error.message : "登录失败");
                      }
                    }}
                  >
                    <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    {mode === "password" ? (
                      <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                        <Input.Password />
                      </Form.Item>
                    ) : (
                      <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => (
                          <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="code" label="验证码" rules={[{ required: true }]} style={{ flex: 1 }}>
                              <Input />
                            </Form.Item>
                            <Button style={{ marginTop: 30 }} onClick={() => sendOtp(getFieldValue("phone"), "LOGIN")}>
                              获取
                            </Button>
                          </Space.Compact>
                        )}
                      </Form.Item>
                    )}
                    <Button block type="primary" htmlType="submit">
                      登录
                    </Button>
                  </Form>
                </>
              )
            },
            {
              key: "register",
              label: "注册",
              children: (
                <Form
                  layout="vertical"
                  onFinish={async (values) => {
                    try {
                      const result = await api<Session>("/auth/register", { method: "POST", body: JSON.stringify(values) });
                      onAuthed(result);
                    } catch (error) {
                      messageApi.error(error instanceof Error ? error.message : "注册失败");
                    }
                  }}
                >
                  <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item name="confirmPassword" label="确认密码" rules={[{ required: true, min: 8 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <Space.Compact style={{ width: "100%" }}>
                        <Form.Item name="code" label="验证码" rules={[{ required: true }]} style={{ flex: 1 }}>
                          <Input />
                        </Form.Item>
                        <Button style={{ marginTop: 30 }} onClick={() => sendOtp(getFieldValue("phone"), "REGISTER")}>
                          获取
                        </Button>
                      </Space.Compact>
                    )}
                  </Form.Item>
                  <Button block type="primary" htmlType="submit">
                    注册
                  </Button>
                </Form>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
