// PAGE-212: 换房页面/弹窗
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Button,
  message,
  Spin,
  Select,
  DatePicker,
  InputNumber,
  Input,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getLeases, roomChange } from '@/api/leases';
import { getRooms } from '@/api/rooms';
import type { Lease, Room } from '@/types/domain';
import { money } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import DetailItem from '@/components/ui/DetailItem';
import dayjs from 'dayjs';
import styles from './LeaseRoomChangePage.module.scss';

export default function LeaseRoomChangePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();

  const [lease, setLease] = useState<Lease | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    Promise.all([
      getLeases(currentOrgId).then(
        (data) => data.find((l) => l.id === id) || null
      ),
      getRooms(currentOrgId),
    ])
      .then(([lData, rData]) => {
        if (lData) {
          setLease(lData);
          form.setFieldsValue({
            startDate: dayjs(),
            endDate: dayjs(lData.endDate),
            rentAmount: Number(lData.rentAmount),
          });
        }
        setRooms(rData.filter((r) => r.status === 'VACANT'));
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '加载数据失败');
      })
      .finally(() => setLoading(false));
  }, [currentOrgId, id, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    setSaving(true);
    try {
      const payload = {
        newRoomId: values.newRoomId as string,
        startDate: dayjs(values.startDate as string).format('YYYY-MM-DD'),
        endDate: dayjs(values.endDate as string).format('YYYY-MM-DD'),
        rentAmount: values.rentAmount as number,
        remark: values.remark as string,
      };
      await roomChange(currentOrgId, id, payload);
      message.success('换房成功');
      navigate('/leases');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '换房失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '租约管理', path: '/leases' }, { label: '换房' }]}
      />

      <Spin spinning={loading}>
        {lease && (
          <>
            <Card className={styles.infoCard}>
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="租客">{lease.tenantName}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="当前房间">
                    {lease.room?.apartment?.name} {lease.room?.roomNo}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="当前租金">
                    {money(lease.rentAmount)}
                  </DetailItem>
                </Col>
              </Row>
            </Card>

            <Card className={styles.formCard}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                className={styles.form}
              >
                <Form.Item
                  label="目标房间"
                  name="newRoomId"
                  rules={[{ required: true, message: '请选择目标房间' }]}
                >
                  <Select
                    placeholder="请选择目标房间（仅展示空闲房间）"
                    options={rooms.map((r) => ({
                      label: `${r.apartment?.name || ''} ${r.roomNo}`,
                      value: r.id,
                    }))}
                  />
                </Form.Item>

                <div className={styles.formRow}>
                  <Form.Item
                    label="开始日期"
                    name="startDate"
                    rules={[{ required: true, message: '请选择开始日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    label="结束日期"
                    name="endDate"
                    rules={[{ required: true, message: '请选择结束日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </div>

                <Form.Item
                  label="新租金"
                  name="rentAmount"
                  rules={[{ required: true, message: '请输入租金' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={2}
                    placeholder="请输入新租金"
                  />
                </Form.Item>

                <Form.Item label="备注" name="remark">
                  <Input.TextArea rows={3} placeholder="请输入备注" />
                </Form.Item>

                <div className={styles.formActions}>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/leases')}
                  >
                    返回
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={saving}
                  >
                    确认换房
                  </Button>
                </div>
              </Form>
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
}
