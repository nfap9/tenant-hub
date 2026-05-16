import { Button, Card, Form, Input, Switch, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface QuotaLimitValue {
  enabled: boolean;
}

interface PlatformInfoValue {
  name: string;
  logoUrl: string;
  contactPhone: string;
}

export function SystemSettingsPage() {
  const [quotaLimitEnabled, setQuotaLimitEnabled] = useState<boolean | undefined>(undefined);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfoValue>({ name: "", logoUrl: "", contactPhone: "" });
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState(false);
  const [savingQuota, setSavingQuota] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setLoadingQuota(true);
    api<{ value?: QuotaLimitValue }>("/admin/settings/quota_limit_enabled")
      .then((data) => {
        setQuotaLimitEnabled((data.value as QuotaLimitValue | undefined)?.enabled ?? false);
      })
      .catch(() => {
        setQuotaLimitEnabled(false);
      })
      .finally(() => setLoadingQuota(false));
  }, []);

  useEffect(() => {
    setLoadingPlatform(true);
    api<{ value?: PlatformInfoValue }>("/admin/settings/platform_info")
      .then((data) => {
        const value = (data.value as PlatformInfoValue | undefined) ?? { name: "", logoUrl: "", contactPhone: "" };
        setPlatformInfo(value);
      })
      .catch(() => {
        setPlatformInfo({ name: "", logoUrl: "", contactPhone: "" });
      })
      .finally(() => setLoadingPlatform(false));
  }, []);

  const handleSaveQuota = async () => {
    setSavingQuota(true);
    try {
      await api("/admin/settings/quota_limit_enabled", {
        method: "PUT",
        body: JSON.stringify({
          value: { enabled: quotaLimitEnabled },
          description: "是否开启用量限制：开启后用户需订阅套餐才能使用，关闭后所有用户不限量"
        })
      });
      messageApi.success("用量限制配置已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingQuota(false);
    }
  };

  const handleSavePlatform = async () => {
    setSavingPlatform(true);
    try {
      await api("/admin/settings/platform_info", {
        method: "PUT",
        body: JSON.stringify({
          value: {
            name: platformInfo.name || "Tenant Hub",
            logoUrl: platformInfo.logoUrl,
            contactPhone: platformInfo.contactPhone
          },
          description: "平台基础信息：名称、Logo、客服电话"
        })
      });
      messageApi.success("平台基础信息已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingPlatform(false);
    }
  };

  return (
    <main className="page">
      {contextHolder}
      <div className="page-title">
        <h1>系统配置</h1>
      </div>
      <div className="content-band">
        <Card loading={loadingPlatform} title="平台基础信息" style={{ maxWidth: 720 }}>
          <Form layout="vertical">
            <Form.Item label="平台名称" required>
              <Input
                placeholder="Tenant Hub"
                value={platformInfo.name}
                onChange={(e) => setPlatformInfo((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Logo URL" extra="填写图片地址，将在小程序端展示">
              <Input
                placeholder="https://example.com/logo.png"
                value={platformInfo.logoUrl}
                onChange={(e) => setPlatformInfo((prev) => ({ ...prev, logoUrl: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="客服电话">
              <Input
                placeholder="400-xxx-xxxx"
                value={platformInfo.contactPhone}
                onChange={(e) => setPlatformInfo((prev) => ({ ...prev, contactPhone: e.target.value }))}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSavePlatform} loading={savingPlatform}>
                保存平台信息
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card loading={loadingQuota} title="用量限制" style={{ maxWidth: 720, marginTop: 24 }}>
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
              <Button type="primary" onClick={handleSaveQuota} loading={savingQuota}>
                保存用量配置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </main>
  );
}
