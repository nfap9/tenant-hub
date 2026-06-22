import { useState, useEffect } from 'react';
import {
  Drawer,
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
  Tag,
  Checkbox,
  Table,
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
import { getReservation } from '@/api/reservations';
import { today, nextYear } from '@/utils/format';
import {
  cycleLabels,
  selectableFeeTypes,
  type LeaseFeeFormItem,
  type RentCycle,
} from './constants';
import {
  buildLeaseFeesPayload,
  getHistoricalBillingDates,
  formatHistoricalBillPeriodLabel,
} from './utils';
import styles from './LeaseFormPage.module.scss';
import clsx from 'clsx';

interface LeaseFormDrawerProps {
  open: boolean;
  roomId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

interface HistoricalBillRow {
  id: string;
  billingDate: string;
  currentWater: number;
  currentPower: number;
  settled: boolean;
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
  const [isReserved, setIsReserved] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);
  const [historicalDates, setHistoricalDates] = useState<string[]>([]);
  const [historicalRows, setHistoricalRows] = useState<HistoricalBillRow[]>([]);

  const startDateValue = Form.useWatch('startDate', form);
  const endDateValue = Form.useWatch('endDate', form);
  const cycleValue = Form.useWatch('cycle', form);
  const autoRenewValue = Form.useWatch('autoRenew', form);
  const roomDepositAmount = Form.useWatch('roomDepositAmount', form) ?? 0;
  const keyQuantity = Form.useWatch('keyQuantity', form) ?? 0;
  const keyUnitPrice = Form.useWatch('keyUnitPrice', form) ?? 0;

  useEffect(() => {
    if (!open || !roomId || !currentOrgId) return;
    setIsReserved(false);
    getReservation(currentOrgId, roomId)
      .then((reservation) => {
        if (reservation && reservation.name) {
          setIsReserved(true);
          form.setFieldsValue({
            tenantName: reservation.name,
            tenantPhone: reservation.phone || '',
            roomDepositAmount: Number(reservation.deposit) || 0,
          });
        }
      })
      .catch(() => {});
  }, [open, roomId, currentOrgId, form]);

  useEffect(() => {
    const start = startDateValue ? dayjs(startDateValue as string) : null;
    const end = endDateValue ? dayjs(endDateValue as string) : null;
    const historical = start ? start.isBefore(dayjs(), 'day') : false;
    setIsHistorical(historical);
    setHistoricalRows([]);

    if (historical && start && end && cycleValue) {
      const dates = getHistoricalBillingDates(
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD'),
        cycleValue as RentCycle,
        Boolean(autoRenewValue)
      );
      setHistoricalDates(dates);
    } else {
      setHistoricalDates([]);
    }
  }, [startDateValue, endDateValue, cycleValue, autoRenewValue]);

  const hasDeposit =
    Number(roomDepositAmount || 0) +
      Number(keyQuantity || 0) * Number(keyUnitPrice || 0) >
    0;
  const showDepositSettled = isHistorical && hasDeposit;

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

  const addHistoricalRow = () => {
    const nextDate = historicalDates
      .slice()
      .reverse()
      .find((date) => !historicalRows.some((row) => row.billingDate === date));
    if (!nextDate) return;
    setHistoricalRows((old) => {
      const next: HistoricalBillRow = {
        id: `${nextDate}-${Date.now()}`,
        billingDate: nextDate,
        currentWater: 0,
        currentPower: 0,
        settled: false,
      };
      return [...old, next].sort((a, b) =>
        b.billingDate.localeCompare(a.billingDate)
      );
    });
  };

  const removeHistoricalRow = (id: string) => {
    setHistoricalRows((old) => old.filter((row) => row.id !== id));
  };

  const updateHistoricalRow = (
    id: string,
    field: keyof Omit<HistoricalBillRow, 'id' | 'billingDate'>,
    value: number | boolean
  ) => {
    setHistoricalRows((old) =>
      old.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleCancel = () => {
    form.resetFields();
    setFees([]);
    setHistoricalRows([]);
    setIsHistorical(false);
    setHistoricalDates([]);
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
        cycle: String(values.cycle),
        rentAmount: Number(values.rentAmount),
        roomDepositAmount: Number(values.roomDepositAmount || 0),
        keyQuantity: Number(values.keyQuantity || 0),
        keyUnitPrice: Number(values.keyUnitPrice || 0),
        waterUnitPrice: Number(values.waterUnitPrice || 0),
        powerUnitPrice: Number(values.powerUnitPrice || 0),
        autoRenew: Boolean(values.autoRenew),
        historicalBills: historicalRows.map((row) => ({
          billingDate: row.billingDate,
          currentWater: Number(row.currentWater || 0),
          currentPower: Number(row.currentPower || 0),
          settled: Boolean(row.settled),
        })),
        historicalBaseWater: Number(values.historicalBaseWater || 0),
        historicalBasePower: Number(values.historicalBasePower || 0),
        depositSettled: showDepositSettled && Boolean(values.depositSettled),
        fees: buildLeaseFeesPayload(fees),
      });
      message.success('签约完成');
      form.resetFields();
      setFees([]);
      setHistoricalRows([]);
      setIsHistorical(false);
      setHistoricalDates([]);
      onSuccess();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '签约失败');
    } finally {
      setSaving(false);
    }
  };

  const remainingHistoricalDates = historicalDates.filter(
    (date) => !historicalRows.some((row) => row.billingDate === date)
  );

  const historicalColumns = [
    {
      title: '账单周期',
      dataIndex: 'billingDate',
      render: (date: string) =>
        formatHistoricalBillPeriodLabel(date, cycleValue as RentCycle),
    },
    {
      title: '期末水表读数',
      dataIndex: 'currentWater',
      width: 160,
      render: (_value: number, row: HistoricalBillRow) => (
        <InputNumber
          min={0}
          className="w-full"
          value={row.currentWater}
          onChange={(v) =>
            updateHistoricalRow(row.id, 'currentWater', Number(v ?? 0))
          }
        />
      ),
    },
    {
      title: '期末电表读数',
      dataIndex: 'currentPower',
      width: 160,
      render: (_value: number, row: HistoricalBillRow) => (
        <InputNumber
          min={0}
          className="w-full"
          value={row.currentPower}
          onChange={(v) =>
            updateHistoricalRow(row.id, 'currentPower', Number(v ?? 0))
          }
        />
      ),
    },
    {
      title: '已结清',
      dataIndex: 'settled',
      width: 100,
      render: (_value: boolean, row: HistoricalBillRow) => (
        <Checkbox
          checked={row.settled}
          onChange={(e) =>
            updateHistoricalRow(row.id, 'settled', e.target.checked)
          }
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, row: HistoricalBillRow) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeHistoricalRow(row.id)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <Drawer
      title="签约入住"
      open={open}
      onClose={handleCancel}
      width={760}
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
          cycle: 'MONTHLY',
          autoRenew: true,
          historicalBills: [],
          historicalBaseWater: 0,
          historicalBasePower: 0,
          depositSettled: false,
          waterUnitPrice: 0,
          powerUnitPrice: 0,
        }}
      >
        {isReserved && (
          <Tag color="blue" className="mb-12">
            预留人信息已锁定，如需修改请先取消预留
          </Tag>
        )}
        <Form.Item label="租客姓名" name="tenantName">
          <Input
            placeholder="请输入姓名"
            prefix={<UserOutlined className="text-subtle" />}
            disabled={isReserved}
          />
        </Form.Item>
        <Form.Item label="租客电话" name="tenantPhone">
          <Input
            placeholder="请输入手机号"
            prefix={<PhoneOutlined className="text-subtle" />}
            disabled={isReserved}
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
          <Form.Item label="钥匙数量" name="keyQuantity">
            <InputNumber min={0} className="w-full" placeholder="套" />
          </Form.Item>
          <Form.Item label="钥匙单价" name="keyUnitPrice">
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="每套金额"
            />
          </Form.Item>
        </div>
        <Form.Item label="交租周期" name="cycle" rules={[{ required: true }]}>
          <Select
            options={(['MONTHLY', 'QUARTERLY', 'YEARLY'] as RentCycle[]).map(
              (c) => ({ label: cycleLabels[c], value: c })
            )}
          />
        </Form.Item>
        <div className={styles.formGrid2}>
          <Form.Item label="水费单价（元/吨）" name="waterUnitPrice">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item label="电费单价（元/度）" name="powerUnitPrice">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </div>
        <Form.Item label="自动续约" name="autoRenew" valuePropName="checked">
          <Switch />
        </Form.Item>

        {isHistorical && historicalDates.length > 0 && (
          <>
            <Divider orientation="left" className={styles.sectionDivider}>
              历史账单
            </Divider>
            <div className={clsx(styles.formGrid2, 'mb-16')}>
              <Form.Item label="水表底数" name="historicalBaseWater">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
              <Form.Item label="电表底数" name="historicalBasePower">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </div>
            <div className="mb-16">
              <Table
                dataSource={historicalRows}
                columns={historicalColumns}
                rowKey="id"
                pagination={false}
                size="small"
                className="mb-16"
              />
              {remainingHistoricalDates.length > 0 && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={addHistoricalRow}
                  className="w-full"
                >
                  添加历史账单
                </Button>
              )}
            </div>
          </>
        )}

        {showDepositSettled && (
          <Form.Item
            label="押金已结清"
            name="depositSettled"
            valuePropName="checked"
          >
            <Checkbox>签约时押金已收齐</Checkbox>
          </Form.Item>
        )}

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
