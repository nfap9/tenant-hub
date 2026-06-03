import { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  Spin,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getRooms } from '@/api/rooms';
import { createMeterReading } from '@/api/bills';
import { today } from '@/utils/format';
import dayjs from 'dayjs';
import type { Room } from '@/types/domain';

interface ReadingDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReadingDrawer({
  open,
  onClose,
  onSuccess,
}: ReadingDrawerProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !open) return;
    setLoading(true);
    getRooms(currentOrgId)
      .then((data) => {
        setRooms(data);
        if (data.length > 0 && !form.getFieldValue('roomId')) {
          form.setFieldsValue({ roomId: data[0].id });
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId, open, form]);

  const handleSubmit = async (values: {
    roomId: string;
    meterType: 'WATER' | 'POWER';
    readingDate: dayjs.Dayjs;
    value: string;
    note?: string;
  }) => {
    if (!currentOrgId) return;
    const room = rooms.find((r) => r.id === values.roomId);
    if (!room) return;
    setSubmitting(true);
    try {
      await createMeterReading(currentOrgId, {
        apartmentId: room.apartmentId,
        roomId: values.roomId,
        meterType: values.meterType,
        readingDate: values.readingDate.format('YYYY-MM-DD'),
        value: Number(values.value),
        note: values.note?.trim() || undefined,
      });
      message.success('抄表记录已保存');
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

  return (
    <Drawer
      title="抄表录入"
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={480}
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
          >
            保存读数
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            readingDate: dayjs(today()),
            meterType: 'WATER',
          }}
        >
          <Form.Item
            name="roomId"
            label="房间"
            rules={[{ required: true, message: '请选择房间' }]}
          >
            <Select
              placeholder="选择房间"
              options={rooms.map((r) => ({ label: r.roomNo, value: r.id }))}
            />
          </Form.Item>
          <Form.Item
            name="meterType"
            label="表类型"
            rules={[{ required: true, message: '请选择表类型' }]}
          >
            <Select
              options={[
                { label: '水表', value: 'WATER' },
                { label: '电表', value: 'POWER' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="readingDate"
            label="读数日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            name="value"
            label="读数"
            rules={[{ required: true, message: '请输入读数' }]}
          >
            <Input placeholder="读数" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea placeholder="备注（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
}
