import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Select, Space, Typography, message } from "antd";
import { getSmsConfig, updateSmsConfig } from "@/api/admin";

const methodOptions = [
  { value: "POST", label: "POST" },
  { value: "GET", label: "GET" },
  { value: "PUT", label: "PUT" },
];

const defaultParams = [
  { key: "code", value: "{{code}}" },
  { key: "targets", value: "{{targets}}" },
  { key: "name", value: "{{name}}" },
  { key: "number", value: "{{number}}" },
];


export default function OpsSmsConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSmsConfig()
      .then((data) => {
        const value = data.value ?? {};
        form.setFieldsValue({
          url: value.url ?? "",
          method: value.method ?? "POST",
          headers: Object.entries(value.headers ?? {}).map(([key, val]) => ({ key, value: val })),
          params: Object.entries(value.params ?? {}).map(([key, val]) => ({ key, value: val })),
        });
      })
      .catch(() => {
        form.setFieldsValue({
          url: "",
          method: "POST",
          headers: [],
          params: defaultParams.map((item) => ({ ...item })),
        });
      })
      .finally(() => setLoading(false));
  }, [form]);

  const toRecord = (items: Array<{ key: string; value: string }>) => {
    const record: Record<string, string> = {};
    for (const item of items) {
      if (item.key && item.value !== undefined) {
        record[item.key] = item.value;
      }
    }
    return record;
  };

  const handleSave = async (values: {
    url: string;
    method: "GET" | "POST" | "PUT";
    headers: Array<{ key: string; value: string }>;
    params: Array<{ key: string; value: string }>;
  }) => {
    const payload = {
      value: {
        url: values.url || "",
        method: values.method,
        headers: toRecord(values.headers),
        params: toRecord(values.params),
      },
      description: "通用短信服务配置",
    };

    setSaving(true);
    try {
      await updateSmsConfig(payload);
      message.success("短信配置已保存");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const renderKeyValueList = (name: string, keyPlaceholder: string, valuePlaceholder: string) => (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <div>
          {fields.map((field) => (
            <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
              <Form.Item
                {...field}
                name={[field.name, "key"]}
                rules={[{ required: true, message: "请输入字段名" }]}
                noStyle
              >
                <Input placeholder={keyPlaceholder} style={{ width: 160 }} />
              </Form.Item>
              <Form.Item
                {...field}
                name={[field.name, "value"]}
                rules={[{ required: true, message: "请输入字段值" }]}
                noStyle
              >
                <Input placeholder={valuePlaceholder} style={{ width: 320 }} />
              </Form.Item>
              <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>
            </Space>
          ))}
          <Button type="dashed" onClick={() => add()} block>新增字段</Button>
        </div>
      )}
    </Form.List>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>短信配置</h2>
      <Card loading={loading} title="通用短信服务配置" style={{ maxWidth: 720 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="url" label="接口地址" rules={[{ required: true, message: "请输入短信接口地址" }]}>
            <Input placeholder="https://api.example.com/sms/send" />
          </Form.Item>
          <Form.Item name="method" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}>
            <Select options={methodOptions} />
          </Form.Item>
          <Form.Item label="请求头 (Headers)">
            {renderKeyValueList("headers", "Header 名称", "Header 值，可用 {{code}} {{targets}} {{name}} {{number}}")}
          </Form.Item>
          <Form.Item label="请求参数 (Params)">
            {renderKeyValueList("params", "参数名", "参数值，可用 {{code}} {{targets}} {{name}} {{number}}")}
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>保存配置</Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="变量说明" size="small" style={{ maxWidth: 720, marginTop: 16, background: "#fffaf0" }}>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          在 URL、Headers、Params 中均可使用以下变量，发送时会被自动替换为实际值：
        </Typography.Paragraph>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><Typography.Text code>{"{{code}}"}</Typography.Text> — 验证码（6 位数字）</li>
          <li><Typography.Text code>{"{{targets}}"}</Typography.Text> — 接收短信的手机号</li>
          <li><Typography.Text code>{"{{name}}"}</Typography.Text> — 应用名称（默认 TenantHub）</li>
          <li><Typography.Text code>{"{{number}}"}</Typography.Text> — 验证码过期时间（分钟），取自环境变量 <Typography.Text code>OTP_EXPIRES_IN_MINUTES</Typography.Text>（默认 5）</li>
        </ul>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          GET 请求：参数自动拼接到 URL Query String。<br />
          POST / PUT 请求：参数作为 JSON Body 发送。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
