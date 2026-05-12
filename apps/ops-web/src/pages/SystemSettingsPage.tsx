import { Button, Card, Form, Switch, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface QuotaLimitValue {
  enabled: boolean;
}

export function SystemSettingsPage() {
  const [quotaLimitEnabled, setQuotaLimitEnabled] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setLoading(true);
    api<{ value?: QuotaLimitValue }>("/admin/settings/quota_limit_enabled")
      .then((data) => {
        setQuotaLimitEnabled((data.value as QuotaLimitValue | undefined)?.enabled ?? true);
      })
      .catch(() => {
        setQuotaLimitEnabled(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/admin/settings/quota_limit_enabled", {
        method: "PUT",
        body: JSON.stringify({
          value: { enabled: quotaLimitEnabled },
          description: "是否开启用量限制：开启后用户需订阅套餐才能使用，关闭后所有用户不限量"
        })
      });
      messageApi.success("系统配置已保存");
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
        <h1>系统配置</h1>
      </div>
      <div className="content-band">
        <Card loading={loading} title="用量限制" style={{ maxWidth: 720 }}>
          <Form layout="vertical">
            <Form.Item
              label="开启用量限制"
              extra="开启后，组织需要订阅套餐才能创建公寓、房间和添加成员；关闭后，所有用户不限量使用资源。"
            >
              <Switch
                checked={quotaLimitEnabled}
                onChange={(checked) => setQuotaLimitEnabled(checked)}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSave} loading={saving}>
                保存配置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </main>
  );
}
