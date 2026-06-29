import { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Button,
  message,
  Space,
  Divider,
} from 'antd';
import {
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
import styles from './LeaseFormPage.module.scss';
import clsx from 'clsx';

interface LeaseFormDrawerProps {
  open: boolean;
  roomId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function LeaseFormDrawer({
  open,
  roomId,
  onCancel,
  onSuccess,
}: LeaseFormDrawerProps) {
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [form] = Form.useForm();

  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFees([]);
    }
  }, [open, form]);

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

  const updateFeeType = (id: string, type: string) => {
    const selected = selectableFeeTypes.find((item) => item.type === type);
    if (!selected) return;
    setFees((old) =>
      old.map((item) =>
        item.id === id
          ? { ...item, type: selected.type, name: selected.label }
          : item
      )
    );
  };

  const updateFeeAmount = (id: string, amount: string) => {
    setFees((old) =>
      old.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const removeFee = (id: string) => {
    setFees((old) => old.filter((item) => item.id !== id));
  };

  const handleCancel = () => {
    form.resetFields();
    setFees([]);
    onCancel();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !roomId) return;
    if (!canManageLease) {
      message.warning('当前角色没有管理租约权限');
      return;
    }
    if (!values.rentAmount) {
      message.warning('请填写租金');
      return;
    }

    setSaving(true);
    try {
      await createLease(currentOrgId, {
        roomId,
        tenantName: values.tenantName
          ? String(values.tenantName).trim()
          : undefined,
        tenantPhone: values.tenantPhone
          ? String(values.tenantPhone).trim()
          : undefined,
        startDate: dayjs(values.startDate as string).format('YYYY-MM-DD'),
        endDate: dayjs(values.endDate as string).format('YYYY-MM-DD'),
        rentCycle: String(values.rentCycle),
        rentAmount: Number(values.rentAmount),
        roomDepositAmount: Number(values.roomDepositAmount || 0),
        keyDepositAmount: Number(values.keyDepositAmount || 0),
        waterUnitPrice: Number(values.waterUnitPrice ?? 0),
        powerUnitPrice: Number(values.powerUnitPrice ?? 0),
        initialWaterReading: Number(values.initialWaterReading ?? 0),
        initialPowerReading: Number(values.initialPowerReading ?? 0),
        fees: buildLeaseFeesPayload(fees),
      });
      message.success('签约完成');
      form.resetFields();
      setFees([]);
      onSuccess();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '签约失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="签约入住"
      open={open}
      onClose={handleCancel}
      width={640}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={handleCancel}>取消</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={() => form.submit()}
            style={{ marginLeft: 8 }}
          >
            确认签约
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          startDate: dayjs(today()),
          endDate: dayjs(nextYear()),
          rentCycle: 'MONTHLY',
          waterUnitPrice: 0,
          powerUnitPrice: 0,
          initialWaterReading: 0,
          initialPowerReading: 0,
        }}
      >
        <Form.Item label="租客姓名" name="tenantName">
          <Input
            placeholder="请输入姓名"
            prefix={<UserOutlined className="text-subtle" />}
          />
        </Form.Item>
        <Form.Item label="租客电话" name="tenantPhone">
          <Input
            placeholder="请输入手机号"
            prefix={<PhoneOutlined className="text-subtle" />}
          />
        </Form.Item>
        <div className={styles.formGrid2}>
          <Form.Item
            label="开始日期"
            name="startDate"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker
              className="w-full"
              prefix={<CalendarOutlined className="text-subtle" />}
            />
          </Form.Item>
          <Form.Item
            label="结束日期"
            name="endDate"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker
              className="w-full"
              prefix={<CalendarOutlined className="text-subtle" />}
            />
          </Form.Item>
        </div>
        <div className={styles.formGrid2}>
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
            />
          </Form.Item>
          <Form.Item label="房间押金" name="roomDepositAmount">
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="请输入房间押金"
            />
          </Form.Item>
        </div>
        <div className={styles.formGrid2}>
          <Form.Item label="钥匙押金" name="keyDepositAmount">
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="请输入钥匙押金"
            />
          </Form.Item>
          <Form.Item
            label="交租周期"
            name="rentCycle"
            rules={[{ required: true }]}
          >
            <Select
              options={(['MONTHLY', 'QUARTERLY', 'YEARLY'] as RentCycle[]).map(
                (c) => ({ label: cycleLabels[c], value: c })
              )}
            />
          </Form.Item>
        </div>

        <Divider orientation="left" className={styles.sectionDivider}>
          水电设置
        </Divider>
        <div className={styles.formGrid2}>
          <Form.Item label="水费单价" name="waterUnitPrice">
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="每吨单价"
            />
          </Form.Item>
          <Form.Item label="电费单价" name="powerUnitPrice">
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="每度单价"
            />
          </Form.Item>
        </div>
        <div className={styles.formGrid2}>
          <Form.Item label="初始水表读数" name="initialWaterReading">
            <InputNumber
              min={0}
              className="w-full"
              placeholder="签约时水表底数"
            />
          </Form.Item>
          <Form.Item label="初始电表读数" name="initialPowerReading">
            <InputNumber
              min={0}
              className="w-full"
              placeholder="签约时电表底数"
            />
          </Form.Item>
        </div>

        <Divider orientation="left" className={styles.sectionDivider}>
          费用项目
        </Divider>
        <div className={clsx(styles.feeList, 'mb-16')}>
          {fees.map((item) => (
            <Space key={item.id} className={styles.feeItem} align="baseline">
              <Select
                value={item.type}
                onChange={(value) => updateFeeType(item.id, value)}
                options={selectableFeeTypes
                  .filter(
                    (t) =>
                      t.type === item.type ||
                      !fees.some((f) => f.type === t.type)
                  )
                  .map((t) => ({ label: t.label, value: t.type }))}
                style={{ width: 120 }}
              />
              <InputNumber
                min={0}
                placeholder="价格"
                value={item.amount ? Number(item.amount) : undefined}
                onChange={(v) => updateFeeAmount(item.id, String(v || 0))}
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
            className="w-full"
          >
            添加费用
          </Button>
        </div>
      </Form>
    </Drawer>
  );
}
