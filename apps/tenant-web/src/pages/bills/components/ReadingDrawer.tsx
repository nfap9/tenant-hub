import { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Select,
  DatePicker,
  InputNumber,
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
  roomId?: string;
}

export default function ReadingDrawer({
  open,
  onClose,
  onSuccess,
  roomId: defaultRoomId,
}: ReadingDrawerProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    if (!currentOrgId) return;

    form.resetFields();
    form.setFieldsValue({
      readingDate: dayjs(today()),
      waterValue: 0,
      powerValue: 0,
    });

    setLoading(true);
    getRooms(currentOrgId)
      .then((data) => {
        setRooms(data);
        const targetId = defaultRoomId ?? (data.length > 0 ? data[0].id : null);
        if (targetId) {
          form.setFieldsValue({ roomId: targetId });
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId, open, form, defaultRoomId]);

  const handleSubmit = async (values: {
    roomId: string;
    readingDate: dayjs.Dayjs;
    waterValue: number;
    powerValue: number;
    note?: string;
  }) => {
    if (!currentOrgId) return;
    const room = rooms.find((r) => r.id === values.roomId);
    if (!room) return;
    setSubmitting(true);
    try {
      await createMeterReading(currentOrgId, {
        roomId: values.roomId,
        readingDate: values.readingDate.format('YYYY-MM-DD'),
        waterValue: Number(values.waterValue),
        powerValue: Number(values.powerValue),
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
            waterValue: 0,
            powerValue: 0,
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
            name="readingDate"
            label="读数日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            name="waterValue"
            label="水表读数"
            rules={[{ required: true, message: '请输入水表读数' }]}
          >
            <InputNumber min={0} className="w-full" placeholder="水表读数" />
          </Form.Item>
          <Form.Item
            name="powerValue"
            label="电表读数"
            rules={[{ required: true, message: '请输入电表读数' }]}
          >
            <InputNumber min={0} className="w-full" placeholder="电表读数" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea placeholder="备注（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
}
