import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Spin, message } from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBillDetail, recordUtilityReading } from '@/api/bills';
import styles from './UtilityPage.module.scss';

interface UtilityModalProps {
  open: boolean;
  billId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UtilityModal({
  open,
  billId,
  onClose,
  onSuccess,
}: UtilityModalProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !billId || !open) return;
    setLoading(true);
    getBillDetail(currentOrgId, billId)
      .then((bill) => {
        const water = bill.items?.find((item) => item.type === 'WATER');
        const power = bill.items?.find((item) => item.type === 'POWER');
        form.setFieldsValue({
          previousWater: water?.previousWater ?? '',
          currentWater: water?.currentWater ?? '',
          previousPower: power?.previousPower ?? '',
          currentPower: power?.currentPower ?? '',
        });
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId, billId, open, form]);

  const handleSubmit = async () => {
    if (!currentOrgId || !billId) return;
    const values = form.getFieldsValue();
    setSubmitting(true);
    try {
      await recordUtilityReading(currentOrgId, billId, {
        previousWater: Number(values.previousWater || 0),
        currentWater: Number(values.currentWater || 0),
        previousPower: Number(values.previousPower || 0),
        currentPower: Number(values.currentPower || 0),
      });
      message.success('水电读数已录入');
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '水电录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="录入本期水电"
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
      width={520}
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className={styles.utilitySpaceFull}
        >
          <div className={styles.utilityMb24}>
            <div className={styles.utilityCardTitle}>
              <DashboardOutlined />
              水表读数
            </div>
            <Form.Item name="previousWater" style={{ marginBottom: 12 }}>
              <Input
                placeholder="上期水表读数"
                prefix={<ThunderboltOutlined />}
              />
            </Form.Item>
            <Form.Item name="currentWater" style={{ marginBottom: 0 }}>
              <Input
                placeholder="本期水表读数"
                prefix={<ThunderboltOutlined />}
              />
            </Form.Item>
          </div>
          <div className={styles.utilityMb24}>
            <div className={styles.utilityCardTitle}>
              <DashboardOutlined />
              电表读数
            </div>
            <Form.Item name="previousPower" style={{ marginBottom: 12 }}>
              <Input
                placeholder="上期电表读数"
                prefix={<ThunderboltOutlined />}
              />
            </Form.Item>
            <Form.Item name="currentPower" style={{ marginBottom: 0 }}>
              <Input
                placeholder="本期电表读数"
                prefix={<ThunderboltOutlined />}
              />
            </Form.Item>
          </div>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            htmlType="submit"
            block
          >
            保存水电读数
          </Button>
        </Form>
      </Spin>
    </Modal>
  );
}
