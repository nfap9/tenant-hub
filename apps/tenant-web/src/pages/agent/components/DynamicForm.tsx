import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Switch,
  Button,
  Space,
  Card,
} from 'antd';
import dayjs from 'dayjs';
import type { FormField } from '@/api/agent';
import styles from '../AgentChatPage.module.scss';

interface DynamicFormProps {
  fields: FormField[];
  reason?: string;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel?: () => void;
}

function renderField(field: FormField) {
  if (field.type === 'number') {
    return (
      <InputNumber
        style={{ width: '100%' }}
        min={field.min}
        max={field.max}
        placeholder={field.description}
      />
    );
  }

  if (field.type === 'boolean') {
    return <Switch />;
  }

  if (field.type === 'date') {
    return <DatePicker style={{ width: '100%' }} placeholder={field.label} />;
  }

  if (field.type === 'select' && field.options) {
    return (
      <Select placeholder={field.description || `请选择${field.label}`}>
        {field.options.map((opt) => (
          <Select.Option key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Option>
        ))}
      </Select>
    );
  }

  if (field.type === 'array' || field.type === 'object') {
    return (
      <Input.TextArea
        rows={3}
        placeholder={`请以 JSON 格式填写${field.label}`}
      />
    );
  }

  return (
    <Input
      placeholder={field.description}
      minLength={field.minLength}
      maxLength={field.maxLength}
    />
  );
}

function normalizeDefaultValue(field: FormField): unknown {
  if (field.defaultValue === undefined) return undefined;

  if (field.type === 'date') {
    const value = field.defaultValue;
    if (value instanceof Date) return dayjs(value);
    if (typeof value === 'string') return dayjs(value);
    return value;
  }

  return field.defaultValue;
}

function getInitialValues(fields: FormField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const normalized = normalizeDefaultValue(field);
    if (normalized !== undefined) {
      values[field.name] = normalized;
    }
  }
  return values;
}

export function DynamicForm({
  fields,
  reason,
  onSubmit,
  onCancel,
}: DynamicFormProps) {
  const [form] = Form.useForm();

  const handleFinish = (values: Record<string, unknown>) => {
    const parsed = { ...values };
    for (const field of fields) {
      if (field.type === 'array' || field.type === 'object') {
        const raw = parsed[field.name];
        if (typeof raw === 'string' && raw.trim()) {
          try {
            parsed[field.name] = JSON.parse(raw);
          } catch {
            // 保持原字符串，让后端校验
          }
        }
      } else if (field.type === 'date') {
        const raw = parsed[field.name];
        if (dayjs.isDayjs(raw)) {
          parsed[field.name] = raw.toISOString();
        }
      }
    }
    onSubmit(parsed);
  };

  return (
    <Card
      size="small"
      title={reason || '请补充以下信息'}
      className={styles.agentFormCard}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={getInitialValues(fields)}
        onFinish={handleFinish}
      >
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={[
              {
                required: field.required,
                message: `请填写${field.label}`,
              },
            ]}
            valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
          >
            {renderField(field)}
          </Form.Item>
        ))}
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              提交
            </Button>
            {onCancel && <Button onClick={onCancel}>取消</Button>}
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
