import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Button,
  message,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import { useAppSession } from '@/context/AppSessionContext';
import { createReservation } from '@/api/reservations';

interface ReservationDrawerProps {
  open: boolean;
  roomId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const PAYMENT_OPTIONS = [
  { value: '现金', label: '现金' },
  { value: '微信', label: '微信' },
  { value: '支付宝', label: '支付宝' },
  { value: '银行转账', label: '银行转账' },
];

export default function ReservationDrawer({
  open,
  roomId,
  onCancel,
  onSuccess,
}: ReservationDrawerProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async () => {
    if (!currentOrgId) return;
    const values = await form.validateFields();
    const deposit = Number(values.deposit || 0);

    setSaving(true);
    try {
      await createReservation(currentOrgId, {
        roomId,
        name: String(values.name).trim(),
        phone: String(values.phone).trim(),
        deposit,
        paymentMethod: deposit > 0 ? values.paymentMethod : undefined,
        expectedMoveInDate: dayjs(values.expectedMoveInDate).format(
          'YYYY-MM-DD'
        ),
      });
      message.success(deposit > 0 ? '房间已预留，定金已登记' : '房间已预留');
      onSuccess();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '预留失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="预留房间"
      open={open}
      onClose={onCancel}
      width={400}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ deposit: 0 }}
      >
        <Form.Item
          name="name"
          label="预留人姓名"
          rules={[{ required: true, message: '请输入预留人姓名' }]}
        >
          <Input placeholder="请输入姓名" maxLength={20} />
        </Form.Item>

        <Form.Item
          name="phone"
          label="预留人手机"
          rules={[
            { required: true, message: '请输入预留人手机号' },
            { pattern: /^1\d{10}$/, message: '请输入正确的手机号' },
          ]}
        >
          <Input placeholder="请输入手机号" maxLength={11} />
        </Form.Item>

        <Form.Item
          name="expectedMoveInDate"
          label="期望入住时间"
          rules={[{ required: true, message: '请选择期望入住时间' }]}
        >
          <DatePicker
            placeholder="请选择期望入住时间"
            style={{ width: '100%' }}
            disabledDate={(current) =>
              current && current < dayjs().startOf('day')
            }
          />
        </Form.Item>

        <Form.Item name="deposit" label="定金">
          <InputNumber
            min={0}
            precision={2}
            placeholder="请输入定金金额（选填）"
            addonBefore="¥"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.deposit !== cur.deposit}
        >
          {({ getFieldValue }) =>
            Number(getFieldValue('deposit')) > 0 && (
              <Form.Item
                name="paymentMethod"
                label="收款方式"
                rules={[{ required: true, message: '请选择收款方式' }]}
              >
                <Select
                  placeholder="请选择收款方式"
                  options={PAYMENT_OPTIONS}
                />
              </Form.Item>
            )
          }
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              确认预留
            </Button>
            <Button onClick={onCancel}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
