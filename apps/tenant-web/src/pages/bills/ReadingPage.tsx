import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, DatePicker, Space, Spin, message } from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  HomeOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getRooms } from '@/api/rooms';
import { createMeterReading } from '@/api/bills';
import { today } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import type { Room } from '@/types/domain';
import styles from './ReadingPage.module.scss';
import dayjs from 'dayjs';

export default function ReadingPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({
    roomId: '',
    meterType: 'WATER' as 'WATER' | 'POWER',
    readingDate: today(),
    value: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getRooms(currentOrgId)
      .then((data) => {
        setRooms(data);
        if (data.length > 0) {
          setForm((old) => ({ ...old, roomId: data[0].id }));
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const handleSubmit = async () => {
    if (!currentOrgId || !form.roomId || !form.value.trim()) return;
    const room = rooms.find((r) => r.id === form.roomId);
    if (!room) return;
    setSubmitting(true);
    try {
      await createMeterReading(currentOrgId, {
        apartmentId: room.apartmentId,
        roomId: form.roomId,
        meterType: form.meterType,
        readingDate: form.readingDate,
        value: Number(form.value),
        note: form.note.trim() || undefined,
      });
      message.success('抄表记录已保存');
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
          { label: '抄表录入' },
        ]}
      />

      <Spin spinning={loading}>
        <Card
          title={
            <span className={styles.readingCardTitle}>
              <HomeOutlined />
              选择房间
            </span>
          }
          className={styles.readingMb24}
        >
          <Space wrap>
            {rooms.map((room) => (
              <Button
                key={room.id}
                type={form.roomId === room.id ? 'primary' : 'default'}
                onClick={() => setForm((old) => ({ ...old, roomId: room.id }))}
              >
                {room.roomNo}
              </Button>
            ))}
          </Space>
        </Card>

        <Card
          title={
            <span className={styles.readingCardTitle}>
              <DashboardOutlined />
              表类型
            </span>
          }
          className={styles.readingMb24}
        >
          <Space>
            {(['WATER', 'POWER'] as const).map((type) => (
              <Button
                key={type}
                type={form.meterType === type ? 'primary' : 'default'}
                onClick={() => setForm((old) => ({ ...old, meterType: type }))}
              >
                {type === 'WATER' ? '水表' : '电表'}
              </Button>
            ))}
          </Space>
        </Card>

        <Card
          title={
            <span className={styles.readingCardTitle}>
              <ThunderboltOutlined />
              读数信息
            </span>
          }
        >
          <Space
            direction="vertical"
            className={styles.readingSpaceFull}
            size="large"
          >
            <DatePicker
              className="w-full"
              size="large"
              value={form.readingDate ? dayjs(form.readingDate) : undefined}
              onChange={(date) =>
                setForm((old) => ({
                  ...old,
                  readingDate: date ? date.format('YYYY-MM-DD') : today(),
                }))
              }
            />
            <Input
              placeholder="读数"
              prefix={<ThunderboltOutlined />}
              size="large"
              value={form.value}
              onChange={(e) =>
                setForm((old) => ({ ...old, value: e.target.value }))
              }
            />
            <Input.TextArea
              placeholder="备注（可选）"
              value={form.note}
              onChange={(e) =>
                setForm((old) => ({ ...old, note: e.target.value }))
              }
              rows={3}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              size="large"
            >
              保存读数
            </Button>
          </Space>
        </Card>
      </Spin>
    </div>
  );
}
