import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  message,
} from 'antd';
import { SaveOutlined, FormOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { createApartmentExpense } from '@/api/apartments';
import { optionalText } from '@/utils/format';
import styles from './ApartmentExpensePage.module.scss';

interface ApartmentExpenseModalProps {
  open: boolean;
  apartmentId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function ApartmentExpenseModal({
  open,
  apartmentId,
  onCancel,
  onSuccess,
}: ApartmentExpenseModalProps) {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !apartmentId) return;
    if (!canManageApartment) {
      message.warning('当前角色没有管理公寓权限');
      return;
    }
    if (!values.name || !values.amount) {
      message.warning('请填写花费名称和金额');
      return;
    }

    setSaving(true);
    try {
      await createApartmentExpense(currentOrgId, apartmentId, {
        name: String(values.name).trim(),
        amount: Number(values.amount),
        spentAt: dayjs(values.spentAt as string).format('YYYY-MM-DD'),
        note: optionalText(values.note),
      });
      message.success('经营花费已记录');
      form.resetFields();
      onSuccess();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '记录花费失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="记录花费"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label="花费名称"
          name="name"
          rules={[{ required: true, message: '请输入花费名称' }]}
        >
          <Input
            prefix={<FormOutlined className="text-subtle" />}
            placeholder="例如 维修材料"
          />
        </Form.Item>
        <Form.Item
          label="金额"
          name="amount"
          rules={[{ required: true, message: '请输入金额' }]}
        >
          <InputNumber
            min={0}
            className="w-full"
            prefix={<DollarOutlined className="text-subtle" />}
            placeholder="请输入金额"
          />
        </Form.Item>
        <Form.Item
          label="日期"
          name="spentAt"
          rules={[{ required: true, message: '请选择日期' }]}
          initialValue={dayjs()}
        >
          <DatePicker className="w-full" />
        </Form.Item>
        <Form.Item label="备注" name="note">
          <Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={saving}
          >
            保存花费
          </Button>
          <Button className={styles.cancelBtn} onClick={handleCancel}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
