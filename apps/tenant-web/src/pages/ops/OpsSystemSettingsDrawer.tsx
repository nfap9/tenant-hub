import { useEffect, useState } from 'react';
import {
  Drawer,
  Button,
  Form,
  Input,
  Switch,
  Space,
  Divider,
  message,
} from 'antd';
import {
  SaveOutlined,
  SettingOutlined,
  BlockOutlined,
  GlobalOutlined,
  PhoneOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  getQuotaLimitEnabled,
  updateQuotaLimitEnabled,
  getPlatformInfoSetting,
  updatePlatformInfoSetting,
} from '@/api/admin';

interface OpsSystemSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function OpsSystemSettingsDrawer({
  open,
  onClose,
}: OpsSystemSettingsDrawerProps) {
  const [platformForm] = Form.useForm();
  const [quotaLimitEnabled, setQuotaLimitEnabled] = useState<boolean>(false);
  const [loadingPlatform, setLoadingPlatform] = useState(false);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savingQuota, setSavingQuota] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingPlatform(true);
    getPlatformInfoSetting()
      .then((data) =>
        platformForm.setFieldsValue(
          data.value ?? { name: '', logoUrl: '', contactPhone: '' }
        )
      )
      .catch(() =>
        platformForm.setFieldsValue({ name: '', logoUrl: '', contactPhone: '' })
      )
      .finally(() => setLoadingPlatform(false));
  }, [open, platformForm]);

  useEffect(() => {
    if (!open) return;
    setLoadingQuota(true);
    getQuotaLimitEnabled()
      .then((data) => setQuotaLimitEnabled(data.value?.enabled ?? false))
      .catch(() => setQuotaLimitEnabled(false))
      .finally(() => setLoadingQuota(false));
  }, [open]);

  const handleCancel = () => {
    platformForm.resetFields();
    onClose();
  };

  const handleSavePlatform = async () => {
    const values = await platformForm.validateFields();
    setSavingPlatform(true);
    try {
      await updatePlatformInfoSetting({
        value: {
          name: values.name || 'Tenant Hub',
          logoUrl: values.logoUrl,
          contactPhone: values.contactPhone,
        },
        description: '平台基础信息：名称、Logo、客服电话',
      });
      message.success('平台基础信息已保存');
    } catch (e) {
      if (e instanceof Error) {
        message.error(e.message);
      }
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleSaveQuota = async () => {
    setSavingQuota(true);
    try {
      await updateQuotaLimitEnabled({
        value: { enabled: quotaLimitEnabled },
        description:
          '是否开启用量限制：开启后用户需订阅套餐才能使用，关闭后所有用户不限量',
      });
      message.success('用量限制配置已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingQuota(false);
    }
  };

  return (
    <Drawer
      title="系统配置"
      open={open}
      onClose={handleCancel}
      width={520}
      footer={
        <Space>
          <Button onClick={handleCancel}>关闭</Button>
        </Space>
      }
    >
      <Divider orientation="left">
        <GlobalOutlined /> 平台基础信息
      </Divider>
      <Form form={platformForm} layout="vertical" disabled={loadingPlatform}>
        <Form.Item label="平台名称" name="name">
          <Input
            placeholder="Tenant Hub"
            prefix={<SettingOutlined className="text-subtle" />}
          />
        </Form.Item>
        <Form.Item label="Logo URL" name="logoUrl">
          <Input
            placeholder="https://example.com/logo.png"
            prefix={<LinkOutlined className="text-subtle" />}
          />
        </Form.Item>
        <Form.Item label="客服电话" name="contactPhone">
          <Input
            placeholder="400-xxx-xxxx"
            prefix={<PhoneOutlined className="text-subtle" />}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSavePlatform}
            loading={savingPlatform}
            icon={<SaveOutlined />}
          >
            保存平台信息
          </Button>
        </Form.Item>
      </Form>

      <Divider>
        <BlockOutlined /> 用量限制
      </Divider>
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
            loading={loadingQuota}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSaveQuota}
            loading={savingQuota}
            icon={<SaveOutlined />}
          >
            保存用量配置
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
