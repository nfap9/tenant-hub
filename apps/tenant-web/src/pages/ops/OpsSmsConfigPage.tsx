import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import {
  SaveOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { getSmsConfig, updateSmsConfig } from '@/api/admin';
import PageHeader from '@/components/ui/PageHeader';
import styles from './OpsSmsConfigPage.module.scss';

const methodOptions = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
  { value: 'PUT', label: 'PUT' },
];

const defaultBodyParams = [
  { paramKey: 'code', value: '{{code}}' },
  { paramKey: 'phoneNumber', value: '{{phoneNumber}}' },
];

export default function OpsSmsConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchEnabled, setSwitchEnabled] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSmsConfig()
      .then((data) => {
        const value = data.value ?? {};
        setSwitchEnabled(Boolean(value.enabled));
        form.setFieldsValue({
          url: value.url ?? '',
          method: value.method ?? 'POST',
          headers: Object.entries(value.headers ?? {}).map(
            ([paramKey, val]) => ({ paramKey, value: val })
          ),
          queryParams: Object.entries(value.queryParams ?? {}).map(
            ([paramKey, val]) => ({ paramKey, value: val })
          ),
          bodyParams: Object.entries(value.bodyParams ?? {}).map(
            ([paramKey, val]) => ({ paramKey, value: val })
          ),
        });
      })
      .catch(() => {
        setSwitchEnabled(false);
        form.setFieldsValue({
          url: '',
          method: 'POST',
          headers: [],
          queryParams: [],
          bodyParams: defaultBodyParams.map((item) => ({ ...item })),
        });
      })
      .finally(() => setLoading(false));
  }, [form]);

  const toRecord = (items: Array<{ paramKey: string; value: string }>) => {
    const record: Record<string, string> = {};
    for (const item of items) {
      if (item.paramKey && item.value !== undefined) {
        record[item.paramKey] = item.value;
      }
    }
    return record;
  };

  const handleSwitchChange = (checked: boolean) => {
    if (checked) {
      const url = form.getFieldValue('url');
      const method = form.getFieldValue('method');
      if (!url || !method) {
        message.warning('请先填写接口地址和请求方式后再开启短信功能');
        return;
      }
    }
    setSwitchEnabled(checked);
  };

  const handleSave = async (values: {
    url: string;
    method: 'GET' | 'POST' | 'PUT';
    headers: Array<{ paramKey: string; value: string }>;
    queryParams: Array<{ paramKey: string; value: string }>;
    bodyParams: Array<{ paramKey: string; value: string }>;
  }) => {
    const payload = {
      value: {
        enabled: switchEnabled,
        url: values.url || '',
        method: values.method,
        headers: toRecord(values.headers),
        queryParams: toRecord(values.queryParams),
        bodyParams: toRecord(values.bodyParams),
      },
      description: '通用短信服务配置',
    };

    setSaving(true);
    try {
      await updateSmsConfig(payload);
      message.success('短信配置已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const renderKeyValueList = (
    name: string,
    keyPlaceholder: string,
    valuePlaceholder: string
  ) => (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <div>
          {fields.map((field) => {
            const { key, ...restField } = field;
            return (
              <Space key={key} align="baseline" className={styles.kvSpace}>
                <Form.Item
                  {...restField}
                  name={[restField.name, 'paramKey']}
                  rules={[{ required: true, message: '请输入字段名' }]}
                  noStyle
                >
                  <Input
                    placeholder={keyPlaceholder}
                    className={styles.kvInputKey}
                  />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[restField.name, 'value']}
                  rules={[{ required: true, message: '请输入字段值' }]}
                  noStyle
                >
                  <Input
                    placeholder={valuePlaceholder}
                    className={styles.kvInputValue}
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  onClick={() => remove(restField.name)}
                >
                  删除
                </Button>
              </Space>
            );
          })}
          <Button
            type="dashed"
            onClick={() => add()}
            block
            className={styles.btnRadiusMd}
          >
            新增字段
          </Button>
        </div>
      )}
    </Form.List>
  );

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '运营端' }, { label: '短信配置' }]} />

      <Card
        loading={loading}
        title={
          <span className="card-title">
            <LinkOutlined className="title-icon" />
            通用短信服务配置
          </span>
        }
        className={styles.smsConfigCard}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className={styles.switchRow}>
            <div>
              <Typography.Text strong>启用短信服务</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                开启后，验证码登录和注册验证码功能将可用
              </Typography.Text>
            </div>
            <Switch checked={switchEnabled} onChange={handleSwitchChange} />
          </div>
          <Form.Item
            name="url"
            label="接口地址"
            rules={[{ required: true, message: '请输入短信接口地址' }]}
          >
            <Input
              prefix={<LinkOutlined className="text-subtle" />}
              placeholder="https://api.example.com/sms/send"
            />
          </Form.Item>
          <Form.Item
            name="method"
            label="请求方式"
            rules={[{ required: true, message: '请选择请求方式' }]}
          >
            <Select options={methodOptions} />
          </Form.Item>
          <Form.Item label="请求头 (Headers)">
            {renderKeyValueList(
              'headers',
              'Header 名称',
              'Header 值，可用 {{code}} {{phoneNumber}} {{expireMinutes}}'
            )}
          </Form.Item>
          <Form.Item label="查询参数 (Query)">
            {renderKeyValueList(
              'queryParams',
              '参数名',
              '参数值，可用 {{code}} {{phoneNumber}} {{expireMinutes}}'
            )}
          </Form.Item>
          <Form.Item label="请求体参数 (Body)">
            {renderKeyValueList(
              'bodyParams',
              '参数名',
              '参数值，可用 {{code}} {{phoneNumber}} {{expireMinutes}}'
            )}
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
            >
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={
          <span className="card-title">
            <InfoCircleOutlined className="title-icon" />
            变量说明
          </span>
        }
        size="small"
        className={styles.smsConfigCardBg}
      >
        <Typography.Paragraph className={styles.smsConfigText}>
          在接口地址、请求头、查询参数、请求体参数中均可使用变量，发送时双花括号内的变量会被自动替换为实际值，其他内容视为普通字符串：
        </Typography.Paragraph>
        <ul className={styles.smsConfigList}>
          <li>
            <Typography.Text code>{'{{code}}'}</Typography.Text> — 短信验证码（6
            位数字）
          </li>
          <li>
            <Typography.Text code>{'{{phoneNumber}}'}</Typography.Text> —
            接收短信的用户手机号
          </li>
          <li>
            <Typography.Text code>{'{{expireMinutes}}'}</Typography.Text> —
            验证码过期时间（分钟）
          </li>
        </ul>
        <Typography.Paragraph type="secondary">
          查询参数 (Query)：所有请求方式均会拼接到 URL Query String。
          <br />
          请求体参数 (Body)：GET 请求时忽略；POST / PUT 请求时作为 JSON Body
          发送。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
