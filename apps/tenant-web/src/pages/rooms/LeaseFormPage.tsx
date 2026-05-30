// PAGE-208: 租约签订向导页面
import { useState, useEffect } from 'react';
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
  Checkbox,
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
import { getTenants } from '@/api/tenants';
import type { Tenant } from '@/types/domain';
import { today, nextYear } from '@/utils/format';
import {
  cycleLabels,
  selectableFeeTypes,
  type LeaseFeeFormItem,
  type RentCycle,
} from './constants';
import { buildLeaseFeesPayload } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import styles from './LeaseFormPage.module.scss';
import clsx from 'clsx';

export default function LeaseFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [form] = Form.useForm();

  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    if (!currentOrgId) return;
    getTenants(currentOrgId)
      .then(setTenants)
      .catch(() => undefined);
  }, [currentOrgId]);

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
        tenantId: values.tenantId ? String(values.tenantId) : undefined,
        tenantName: String(values.tenantName).trim(),
        tenantPhone: String(values.tenantPhone).trim(),
        startDate: dayjs(values.startDate as string).format('YYYY-MM-DD'),
        endDate: dayjs(values.endDate as string).format('YYYY-MM-DD'),
        billDay: Number(values.billDay || 1),
        utilityBillDay: Number(values.utilityBillDay || values.billDay || 1),
        graceDays: Number(values.graceDays || 0),
        cycle: String(values.cycle),
        rentAmount: Number(values.rentAmount),
        depositMonths: Number(values.depositMonths || 1),
        depositAmount: Number(values.depositAmount || 0),
        waterUnitPrice: Number(values.waterUnitPrice || 0),
        powerUnitPrice: Number(values.powerUnitPrice || 0),
        waterPricingTiers: values.enableWaterTiers
          ? (values.waterPricingTiers as Array<{
              limit: number;
              price: number;
            }>)
          : undefined,
        powerPricingTiers: values.enablePowerTiers
          ? (values.powerPricingTiers as Array<{
              limit: number;
              price: number;
            }>)
          : undefined,
        lateFeeRate: Number(values.lateFeeRate || 0.0005),
        freeRentDays: Number(values.freeRentDays || 0),
        freeRentStart: values.freeRentStart
          ? dayjs(values.freeRentStart as string).format('YYYY-MM-DD')
          : undefined,
        freeRentEnd: values.freeRentEnd
          ? dayjs(values.freeRentEnd as string).format('YYYY-MM-DD')
          : undefined,
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

      <div className={styles.leaseFormContainer}>
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              startDate: dayjs(today()),
              endDate: dayjs(nextYear()),
              cycle: 'MONTHLY',
              billDay: 1,
              graceDays: 0,
              depositMonths: 1,
              lateFeeRate: 0.0005,
              autoRenew: true,
              generateHistoricalBills: false,
              waterUnitPrice: 0,
              powerUnitPrice: 0,
            }}
          >
            <Form.Item label="选择已有租客" name="tenantId">
              <Select
                placeholder="可选：从已有租客中选择，将自动填充姓名和电话"
                allowClear
                showSearch
                optionFilterProp="label"
                options={tenants.map((t) => ({
                  label: `${t.name} ${t.phone}`,
                  value: t.id,
                }))}
                onChange={(value) => {
                  const tenant = tenants.find((t) => t.id === value);
                  if (tenant) {
                    form.setFieldsValue({
                      tenantName: tenant.name,
                      tenantPhone: tenant.phone,
                    });
                  }
                }}
              />
            </Form.Item>
            <Form.Item
              label="租客姓名"
              name="tenantName"
              rules={[{ required: true, message: '请输入租客姓名' }]}
            >
              <Input
                placeholder="请输入姓名"
                prefix={<UserOutlined className="text-subtle" />}
              />
            </Form.Item>
            <Form.Item
              label="租客电话"
              name="tenantPhone"
              rules={[{ required: true, message: '请输入租客电话' }]}
            >
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
              <Form.Item label="押金" name="depositAmount">
                <InputNumber
                  min={0}
                  className="w-full"
                  prefix="¥"
                  placeholder="请输入押金"
                />
              </Form.Item>
            </div>
            <div className={styles.formGrid2}>
              <Form.Item label="押金月数" name="depositMonths">
                <InputNumber min={0} className="w-full" placeholder="例如 1" />
              </Form.Item>
              <Form.Item label="账单日" name="billDay">
                <InputNumber
                  min={1}
                  max={28}
                  className="w-full"
                  placeholder="每月几号出账"
                />
              </Form.Item>
              <Form.Item label="水电账单日" name="utilityBillDay">
                <InputNumber
                  min={1}
                  max={28}
                  className="w-full"
                  placeholder="默认与账单日相同"
                />
              </Form.Item>
            </div>
            <Form.Item label="宽限天数" name="graceDays">
              <InputNumber
                min={0}
                className="w-full"
                placeholder="交租日后几日内"
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

            <Divider orientation="left" className={styles.sectionDivider}>
              阶梯单价配置
            </Divider>
            <Form.Item
              name="enableWaterTiers"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>启用阶梯水价</Checkbox>
            </Form.Item>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('enableWaterTiers') ? (
                  <Form.List name="waterPricingTiers" initialValue={[]}>
                    {(fields, { add, remove }) => (
                      <div>
                        {fields.map((field, index) => (
                          <Space
                            key={field.key}
                            className={styles.feeItem}
                            align="baseline"
                          >
                            <Form.Item
                              {...field}
                              name={[field.name, 'limit']}
                              rules={[{ required: true }]}
                              label={index === 0 ? '用量上限' : ''}
                            >
                              <InputNumber
                                min={0}
                                placeholder="吨"
                                style={{ width: 100 }}
                              />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'price']}
                              rules={[{ required: true }]}
                              label={index === 0 ? '单价' : ''}
                            >
                              <InputNumber
                                min={0}
                                placeholder="元/吨"
                                prefix="¥"
                                style={{ width: 120 }}
                              />
                            </Form.Item>
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            >
                              删除
                            </Button>
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add()}
                          className="w-full mb-16"
                        >
                          添加阶梯
                        </Button>
                      </div>
                    )}
                  </Form.List>
                ) : null
              }
            </Form.Item>

            <Form.Item
              name="enablePowerTiers"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>启用阶梯电价</Checkbox>
            </Form.Item>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('enablePowerTiers') ? (
                  <Form.List name="powerPricingTiers" initialValue={[]}>
                    {(fields, { add, remove }) => (
                      <div>
                        {fields.map((field, index) => (
                          <Space
                            key={field.key}
                            className={styles.feeItem}
                            align="baseline"
                          >
                            <Form.Item
                              {...field}
                              name={[field.name, 'limit']}
                              rules={[{ required: true }]}
                              label={index === 0 ? '用量上限' : ''}
                            >
                              <InputNumber
                                min={0}
                                placeholder="度"
                                style={{ width: 100 }}
                              />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'price']}
                              rules={[{ required: true }]}
                              label={index === 0 ? '单价' : ''}
                            >
                              <InputNumber
                                min={0}
                                placeholder="元/度"
                                prefix="¥"
                                style={{ width: 120 }}
                              />
                            </Form.Item>
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            >
                              删除
                            </Button>
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add()}
                          className="w-full mb-16"
                        >
                          添加阶梯
                        </Button>
                      </div>
                    )}
                  </Form.List>
                ) : null
              }
            </Form.Item>
            <Form.Item label="滞纳金日费率" name="lateFeeRate">
              <InputNumber
                min={0}
                step={0.0001}
                className="w-full"
                placeholder="默认万分之五（0.0005）"
              />
            </Form.Item>
            <div className={styles.formGrid2}>
              <Form.Item label="免租期天数" name="freeRentDays">
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="免租天数"
                />
              </Form.Item>
            </div>
            <div className={styles.formGrid2}>
              <Form.Item label="免租开始" name="freeRentStart">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item label="免租结束" name="freeRentEnd">
                <DatePicker className="w-full" />
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

            <Divider orientation="left" className={styles.sectionDivider}>
              费用项目
            </Divider>
            <div className={clsx(styles.feeList, 'mb-16')}>
              {fees.map((item) => (
                <Space
                  key={item.id}
                  className={styles.feeItem}
                  align="baseline"
                >
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

            <Form.Item className={styles.formActions}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={saving}
              >
                确认签约
              </Button>
              <Button
                className={styles.cancelBtn}
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
