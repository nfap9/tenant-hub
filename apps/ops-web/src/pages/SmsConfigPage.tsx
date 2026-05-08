import { Button, Card, Form, Input, Space, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface SmsConfigValue {
  templateCode?: string;
  name?: string;
  bodyTemplate?: Record<string, string>;
}

export function SmsConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setLoading(true);
    api<{ value?: SmsConfigValue }>("/admin/settings/sms_spug_config")
      .then((data) => {
        const value = data.value ?? {};
        form.setFieldsValue({
          templateCode: value.templateCode ?? "",
          name: value.name ?? "TenantHub",
          bodyTemplate: Object.entries(value.bodyTemplate ?? { code: "{{code}}", targets: "{{targets}}", name: "{{name}}" }).map(
            ([key, val]) => ({ key, value: val })
          )
        });
      })
      .catch(() => {
        form.setFieldsValue({
          templateCode: "",
          name: "TenantHub",
          bodyTemplate: [
            { key: "code", value: "{{code}}" },
            { key: "targets", value: "{{targets}}" },
            { key: "name", value: "{{name}}" }
          ]
        });
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async (values: {
    templateCode: string;
    name: string;
    bodyTemplate: Array<{ key: string; value: string }>;
  }) => {
    const bodyTemplate: Record<string, string> = {};
    for (const item of values.bodyTemplate) {
      if (item.key && item.value !== undefined) {
        bodyTemplate[item.key] = item.value;
      }
    }

    const payload = {
      value: {
        templateCode: values.templateCode,
        name: values.name,
        bodyTemplate
      } as SmsConfigValue,
      description: "Spug 短信推送配置"
    };

    setSaving(true);
    try {
      await api("/admin/settings/sms_spug_config", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      messageApi.success("短信配置已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>短信配置</h1>
      </div>
      <div className="content-band">
        <Card loading={loading} title="Spug 推送助手配置" style={{ maxWidth: 720 }}>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="templateCode" label="模板编码" rules={[{ required: true, message: "请输入模板编码" }]}>
              <Input placeholder="在 https://push.spug.cc/ 获取的模版编码" />
            </Form.Item>
            <Form.Item name="name" label="推送名称" rules={[{ required: true, message: "请输入推送名称" }]}>
              <Input placeholder="如 TenantHub" />
            </Form.Item>
            <Form.Item label="请求体模板">
              <Form.List name="bodyTemplate" initialValue={[{ key: "code", value: "{{code}}" }]}>
                {(fields, { add, remove }) => (
                  <div>
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, "key"]}
                          rules={[{ required: true, message: "字段名" }]}
                          noStyle
                        >
                          <Input placeholder="字段名" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "value"]}
                          rules={[{ required: true, message: "字段值" }]}
                          noStyle
                        >
                          <Input placeholder="字段值，可用 {{code}} {{targets}} {{name}}" style={{ width: 320 }} />
                        </Form.Item>
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block>
                      新增字段
                    </Button>
                  </div>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存配置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </main>
  );
}
