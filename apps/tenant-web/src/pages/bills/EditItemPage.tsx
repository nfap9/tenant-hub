import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Button, message } from 'antd';
import { SaveOutlined, TagOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { updateBillItem } from '@/api/bills';
import PageHeader from '@/components/ui/PageHeader';
import styles from './EditItemPage.module.scss';

export default function EditItemPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const billId = searchParams.get('billId');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      name: searchParams.get('name') || '',
      amount: Number(searchParams.get('amount') || 0),
      note: searchParams.get('note') || '',
    });
  }, [searchParams, form]);

  const handleSubmit = async (values: {
    name: string;
    amount: number;
    note?: string;
  }) => {
    if (!currentOrgId || !billId || !id) return;
    setSubmitting(true);
    try {
      await updateBillItem(currentOrgId, billId, id, {
        amount: values.amount,
        note: values.note,
      });
      message.success('保存成功');
      navigate(-1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '编辑账单项目' },
        ]}
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className={styles.editItemForm}
        >
          <Form.Item label="名称" name="name">
            <Input disabled prefix={<TagOutlined />} />
          </Form.Item>
          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber min={0} className="w-full" prefix="¥" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={submitting}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
