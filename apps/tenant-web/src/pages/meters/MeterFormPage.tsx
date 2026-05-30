// PAGE-215: 表具新增/编辑页面
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, Button, message, Spin, Select } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getMeters, createMeter, updateMeter } from '@/api/meters';
import { getAllApartments } from '@/api/apartments';
import { getRooms } from '@/api/rooms';
import type { Meter } from '@/types/domain';
import type { Apartment, Room } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import styles from './MeterFormPage.module.scss';

const meterTypeOptions = [
  { label: '水表', value: 'WATER' },
  { label: '电表', value: 'POWER' },
  { label: '气表', value: 'GAS' },
];

export default function MeterFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const initializedRef = useRef(false);

  const [meter, setMeter] = useState<Meter | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    Promise.all([
      getAllApartments(currentOrgId),
      isEdit && id
        ? getMeters(currentOrgId).then(
            (ms) => ms.find((m) => m.id === id) || null
          )
        : Promise.resolve(null),
    ])
      .then(([aData, mData]) => {
        setApartments(aData);
        if (mData) {
          setMeter(mData);
          if (mData.apartmentId) {
            getRooms(currentOrgId).then((data) =>
              setRooms(data.filter((r) => r.apartmentId === mData.apartmentId))
            );
          }
        }
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载数据失败');
      })
      .finally(() => setLoading(false));
  }, [isEdit, id, currentOrgId]);

  useEffect(() => {
    if (isEdit && meter && !initializedRef.current) {
      form.setFieldsValue({
        apartmentId: meter.apartmentId,
        roomId: meter.roomId,
        name: meter.name,
        meterType: meter.meterType,
        meterNo: meter.meterNo,
        parentId: meter.parentId,
      });
      initializedRef.current = true;
    }
  }, [isEdit, meter, form]);

  const handleApartmentChange = async (apartmentId: string) => {
    if (!currentOrgId || !apartmentId) return;
    form.setFieldsValue({ roomId: undefined });
    try {
      const data = await getRooms(currentOrgId);
      setRooms(data.filter((r) => r.apartmentId === apartmentId));
    } catch {
      setRooms([]);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateMeter(currentOrgId, id, {
          name: values.name as string,
          meterNo: values.meterNo as string,
          roomId: values.roomId as string,
        });
        message.success('保存成功');
        navigate(`/meters/${id}`);
      } else {
        const created = await createMeter(
          currentOrgId,
          values as {
            apartmentId: string;
            name: string;
            meterType: string;
            roomId?: string;
            meterNo?: string;
            parentId?: string;
          }
        );
        message.success('创建成功');
        navigate(`/meters/${created.id}`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '表具管理', path: '/meters' },
          { label: isEdit ? '编辑表具' : '新增表具' },
        ]}
      />

      <Spin spinning={loading}>
        <Card className={styles.formCard}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className={styles.form}
          >
            <Form.Item
              label="所属公寓"
              name="apartmentId"
              rules={[{ required: true, message: '请选择公寓' }]}
            >
              <Select
                placeholder="请选择公寓"
                options={apartments.map((a) => ({
                  label: a.name,
                  value: a.id,
                }))}
                onChange={handleApartmentChange}
                disabled={isEdit}
              />
            </Form.Item>

            <div className={styles.formRow}>
              <Form.Item
                label="表具名称"
                name="name"
                rules={[{ required: true, message: '请输入表具名称' }]}
              >
                <Input placeholder="如：1楼水表" />
              </Form.Item>
              <Form.Item
                label="表具类型"
                name="meterType"
                rules={[{ required: true, message: '请选择表具类型' }]}
              >
                <Select
                  placeholder="请选择表具类型"
                  options={meterTypeOptions}
                  disabled={isEdit}
                />
              </Form.Item>
            </div>

            <div className={styles.formRow}>
              <Form.Item label="表具编号" name="meterNo">
                <Input placeholder="请输入表具编号" />
              </Form.Item>
              <Form.Item label="所属房间" name="roomId">
                <Select
                  placeholder="请选择房间（可选）"
                  options={rooms.map((r) => ({
                    label: r.roomNo,
                    value: r.id,
                  }))}
                  allowClear
                  disabled={!rooms.length}
                />
              </Form.Item>
            </div>

            <div className={styles.formActions}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(isEdit ? `/meters/${id}` : '/meters')}
              >
                返回
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
              >
                保存
              </Button>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
