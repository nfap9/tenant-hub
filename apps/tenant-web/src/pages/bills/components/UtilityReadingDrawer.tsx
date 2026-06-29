import { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  InputNumber,
  Button,
  Spin,
  message,
  Descriptions,
} from 'antd';
import { SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { recordUtilityReading, getMeterReadings } from '@/api/bills';
import { money, day } from '@/utils/format';
import {
  nonNegativeIntegerRule,
  readingIncreaseRule,
} from '@/utils/validators';
import type { Bill } from '@/types/domain';

interface UtilityReadingDrawerProps {
  open: boolean;
  bill?: Bill | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UtilityReadingDrawer({
  open,
  bill,
  onClose,
  onSuccess,
}: UtilityReadingDrawerProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bill || !currentOrgId) {
      form.resetFields();
      return;
    }

    const roomId = bill.lease?.roomId;
    if (!roomId) {
      form.resetFields();
      return;
    }

    setLoading(true);
    getMeterReadings(currentOrgId, { roomId })
      .then((readings) => {
        const waterReadings = readings
          .filter((r) => r.meterType === 'WATER')
          .sort(
            (a, b) =>
              new Date(b.readingDate).getTime() -
              new Date(a.readingDate).getTime()
          );
        const powerReadings = readings
          .filter((r) => r.meterType === 'POWER')
          .sort(
            (a, b) =>
              new Date(b.readingDate).getTime() -
              new Date(a.readingDate).getTime()
          );

        const latestWater = waterReadings[0];
        const latestPower = powerReadings[0];

        form.setFieldsValue({
          previousWater: latestWater ? Number(latestWater.value) : 0,
          previousPower: latestPower ? Number(latestPower.value) : 0,
          currentWater: undefined,
          currentPower: undefined,
        });
      })
      .catch(() => {
        message.error('加载历史读数失败');
      })
      .finally(() => setLoading(false));
  }, [open, bill, currentOrgId, form]);

  const handleSubmit = async (values: {
    previousWater: number;
    currentWater: number;
    previousPower: number;
    currentPower: number;
  }) => {
    if (!currentOrgId || !bill) return;
    setSubmitting(true);
    try {
      await recordUtilityReading(currentOrgId, bill.id, {
        previousWater: Number(values.previousWater),
        currentWater: Number(values.currentWater),
        previousPower: Number(values.previousPower),
        currentPower: Number(values.currentPower),
      });
      message.success('水电读数已保存，账单金额已更新');
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const waterItem = bill?.items?.find(
    (item) => item.category === 'UTILITY' && item.name === '水费'
  );
  const powerItem = bill?.items?.find(
    (item) => item.category === 'UTILITY' && item.name === '电费'
  );

  const hasUtilityItems = Boolean(waterItem && powerItem);

  return (
    <Drawer
      title="录入水电读数"
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={520}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={handleClose} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={() => form.submit()}
            disabled={!hasUtilityItems}
          >
            保存并计算
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        {bill && (
          <Descriptions
            size="small"
            column={1}
            bordered
            className="mb-16"
            items={[
              {
                label: '租客',
                children: bill.lease?.tenantName || '-',
              },
              {
                label: '房间',
                children: `${bill.lease?.room?.apartment?.name ?? ''} · ${bill.lease?.room?.roomNo ?? ''}`,
              },
              {
                label: '账期',
                children: waterItem
                  ? `${day(waterItem.periodStart)} ~ ${day(waterItem.periodEnd)}`
                  : '-',
              },
              {
                label: '当前水电费',
                children: (
                  <span>
                    <ThunderboltOutlined /> 水费 ¥
                    {money(waterItem?.amount ?? 0)} / 电费 ¥
                    {money(powerItem?.amount ?? 0)}
                  </span>
                ),
              },
            ]}
          />
        )}

        {!hasUtilityItems && (
          <div style={{ color: '#ff4d4f', marginBottom: 16 }}>
            该账单不包含水电项目，无法录入水电读数。
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={!hasUtilityItems}
        >
          <Form.Item
            name="previousWater"
            label="上期水表读数"
            rules={nonNegativeIntegerRule('上期水表读数')}
          >
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              placeholder="上期读数"
            />
          </Form.Item>
          <Form.Item
            name="currentWater"
            label="本期水表读数"
            rules={[
              ...nonNegativeIntegerRule('本期水表读数'),
              readingIncreaseRule('previousWater', '本期水表读数'),
            ]}
          >
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              placeholder="本期读数"
            />
          </Form.Item>
          <Form.Item
            name="previousPower"
            label="上期电表读数"
            rules={nonNegativeIntegerRule('上期电表读数')}
          >
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              placeholder="上期读数"
            />
          </Form.Item>
          <Form.Item
            name="currentPower"
            label="本期电表读数"
            rules={[
              ...nonNegativeIntegerRule('本期电表读数'),
              readingIncreaseRule('previousPower', '本期电表读数'),
            ]}
          >
            <InputNumber
              min={0}
              precision={0}
              className="w-full"
              placeholder="本期读数"
            />
          </Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
}
