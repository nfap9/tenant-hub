import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  message,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { SaveOutlined, FormOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { createApartmentExpense } from '@/api/apartments';
import { optionalText } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import styles from './ApartmentExpensePage.module.scss';

export default function ApartmentExpensePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
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
      await createApartmentExpense(currentOrgId, id, {
        name: String(values.name).trim(),
        amount: Number(values.amount),
        spentAt: dayjs(values.spentAt as string).format('YYYY-MM-DD'),
        note: optionalText(values.note),
      });
      message.success('经营花费已记录');
      navigate(`/apartments/${id}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '记录花费失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={`/apartments/${id}`}
        breadcrumb={[
          { label: '公寓管理', path: '/apartments' },
          { label: '公寓详情', path: `/apartments/${id}` },
          { label: '记录花费' },
        ]}
      />

      <Card className={styles.expenseFormCard}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="花费名称"
            name="name"
            rules={[{ required: true, message: '请输入花费名称' }]}
          >
            <Input
              size="large"
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
              size="large"
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
            <DatePicker size="large" className="w-full" />
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
              size="large"
            >
              保存花费
            </Button>
            <Button
              size="large"
              className={styles.cancelBtn}
              onClick={() => navigate(`/apartments/${id}`)}
            >
              取消
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
