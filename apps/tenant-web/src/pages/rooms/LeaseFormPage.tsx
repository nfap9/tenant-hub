import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Switch,
  Button,
  message,
  Space,
  Divider,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { createLease } from '@/api/leases';
import { today, nextYear } from '@/utils/format';
import {
  cycleLabels,
  selectableFeeTypes,
  type LeaseFeeFormItem,
  type RentCycle,
} from './constants';
import { buildLeaseFeesPayload } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import './LeaseFormPage.scss';

export default function LeaseFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [form] = Form.useForm();

  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addFee = () => {
    const availableTypes = selectableFeeTypes.filter(
      (item) => !fees.some((fee) => fee.type === item.type)
    );
    if (availableTypes.length === 0) {
      message.warning('费用项目已全部添加');
      return;
    }
    const selected = availableTypes[0];
    setFees((old) => [
      ...old,
      {
        id: `${selected.type}-${Date.now()}`,
        type: selected.type,
        name: selected.label,
        amount: '',
      },
    ]);
  };

  const updateFeeAmount = (id: string, amount: string) => {
    setFees((old) =>
      old.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const removeFee = (id: string) => {
    setFees((old) => old.filter((item) => item.id !== id));
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    if (!canManageLease) {
      message.warning('当前角色没有管理租约权限');
      return;
    }
    if (!values.tenantName || !values.tenantPhone || !values.rentAmount) {
      message.warning('请填写租客、电话和租金');
      return;
    }

    setSaving(true);
    try {
      await createLease(currentOrgId, {
        roomId: id,
        tenantName: String(values.tenantName).trim(),
        tenantPhone: String(values.tenantPhone).trim(),
        startDate: dayjs(values.startDate as string).format('YYYY-MM-DD'),
        endDate: dayjs(values.endDate as string).format('YYYY-MM-DD'),
        graceDays: Number(values.graceDays || 0),
        cycle: String(values.cycle),
        rentAmount: Number(values.rentAmount),
        depositAmount: Number(values.depositAmount || 0),
        waterUnitPrice: Number(values.waterUnitPrice || 0),
        powerUnitPrice: Number(values.powerUnitPrice || 0),
        autoRenew: Boolean(values.autoRenew),
        generateHistoricalBills: Boolean(values.generateHistoricalBills),
        fees: buildLeaseFeesPayload(fees),
      });
      message.success('签约完成');
      navigate('/rooms');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '签约失败');
    } finally {
      setSaving(false);
    }
  };

  const startDate = form.getFieldValue('startDate');
  const showHistoricalBills =
    startDate && dayjs(startDate).isBefore(dayjs(), 'day');

  return (
    <div className="page-content">
      <PageHeader
        back="/rooms"
        breadcrumb={[
          { label: '房间管理', path: '/rooms' },
          { label: '签约入住' },
        ]}
      />

      <div className="lease-form-container">
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              startDate: dayjs(today()),
              endDate: dayjs(nextYear()),
              cycle: 'MONTHLY',
              graceDays: 0,
              autoRenew: true,
              generateHistoricalBills: false,
              waterUnitPrice: 0,
              powerUnitPrice: 0,
            }}
          >
            <Form.Item
              label="租客姓名"
              name="tenantName"
              rules={[{ required: true, message: '请输入租客姓名' }]}
            >
              <Input
                placeholder="请输入姓名"
                size="large"
                prefix={<UserOutlined />}
              />
            </Form.Item>
            <Form.Item
              label="租客电话"
              name="tenantPhone"
              rules={[{ required: true, message: '请输入租客电话' }]}
            >
              <Input
                placeholder="请输入手机号"
                size="large"
                prefix={<PhoneOutlined />}
              />
            </Form.Item>
            <div className="form-grid-2">
              <Form.Item
                label="开始日期"
                name="startDate"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker
                  className="w-full"
                  size="large"
                  prefix={<CalendarOutlined />}
                />
              </Form.Item>
              <Form.Item
                label="结束日期"
                name="endDate"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <DatePicker
                  className="w-full"
                  size="large"
                  prefix={<CalendarOutlined />}
                />
              </Form.Item>
            </div>
            <div className="form-grid-2">
              <Form.Item
                label="租金"
                name="rentAmount"
                rules={[{ required: true, message: '请输入租金' }]}
              >
                <InputNumber
                  min={0}
                  className="w-full"
                  prefix="¥"
                  placeholder="每期金额"
                  size="large"
                />
              </Form.Item>
              <Form.Item label="押金" name="depositAmount">
                <InputNumber
                  min={0}
                  className="w-full"
                  prefix="¥"
                  placeholder="请输入押金"
                  size="large"
                />
              </Form.Item>
            </div>
            <Form.Item label="宽限天数" name="graceDays">
              <InputNumber
                min={0}
                className="w-full"
                placeholder="交租日后几日内"
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="交租周期"
              name="cycle"
              rules={[{ required: true }]}
            >
              <Select
                options={(
                  ['MONTHLY', 'QUARTERLY', 'YEARLY'] as RentCycle[]
                ).map((c) => ({ label: cycleLabels[c], value: c }))}
                size="large"
              />
            </Form.Item>
            <div className="form-grid-2">
              <Form.Item label="水费单价（元/吨）" name="waterUnitPrice">
                <InputNumber min={0} className="w-full" size="large" />
              </Form.Item>
              <Form.Item label="电费单价（元/度）" name="powerUnitPrice">
                <InputNumber min={0} className="w-full" size="large" />
              </Form.Item>
            </div>
            <Form.Item
              label="自动续约"
              name="autoRenew"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            {showHistoricalBills && (
              <Form.Item
                label="历史账单"
                name="generateHistoricalBills"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="生成全部"
                  unCheckedChildren="仅当前期"
                />
              </Form.Item>
            )}

            <Divider orientation="left" className="section-divider">
              费用项目
            </Divider>
            <div className="fee-list mb-16">
              {fees.map((item) => (
                <Space key={item.id} className="fee-item" align="baseline">
                  <span className="fee-label">{item.name}</span>
                  <InputNumber
                    min={0}
                    placeholder="价格"
                    value={item.amount ? Number(item.amount) : undefined}
                    onChange={(v) => updateFeeAmount(item.id, String(v || 0))}
                    size="large"
                    prefix="¥"
                  />
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFee(item.id)}
                  >
                    删除
                  </Button>
                </Space>
              ))}
            </div>
            <div className="mb-16">
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addFee}
                size="large"
                className="w-full"
              >
                添加费用
              </Button>
            </div>

            <Form.Item className="form-actions">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={saving}
                size="large"
              >
                确认签约
              </Button>
              <Button
                size="large"
                className="cancel-btn"
                onClick={() => navigate('/rooms')}
              >
                取消
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
