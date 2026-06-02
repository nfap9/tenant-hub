import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Spin,
  Empty,
  Popconfirm,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  FileTextOutlined,
  DollarOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { LandlordContract, LandlordPayment } from '@/types/domain';
import { money, day } from '@/utils/format';
import {
  getApartmentContract,
  getApartmentPayments,
  generateApartmentPaymentPlan,
  recordApartmentPayment,
  deleteApartmentPayment,
  updateApartmentContract,
} from '@/api/apartments';

const paymentMethodLabels: Record<string, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  HALF_YEARLY: '半年付',
  YEARLY: '年付',
};

const paymentMethodOptions = [
  { label: '月付', value: 'MONTHLY' },
  { label: '季付', value: 'QUARTERLY' },
  { label: '半年付', value: 'HALF_YEARLY' },
  { label: '年付', value: 'YEARLY' },
];

const escalationTypeOptions = [
  { label: '无递增', value: 'NONE' },
  { label: '固定金额', value: 'FIXED_AMOUNT' },
  { label: '百分比', value: 'PERCENTAGE' },
];

interface Props {
  apartmentId: string;
  organizationId: string;
  canManage: boolean;
}

export default function ApartmentContractSection({
  apartmentId,
  organizationId,
  canManage,
}: Props) {
  const [contract, setContract] = useState<LandlordContract | null>(null);
  const [payments, setPayments] = useState<LandlordPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractForm] = Form.useForm();
  const [contractSubmitting, setContractSubmitting] = useState(false);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm] = Form.useForm();
  const [currentPayment, setCurrentPayment] = useState<LandlordPayment | null>(
    null
  );

  const loadContract = useCallback(async () => {
    try {
      const data = await getApartmentContract(organizationId, apartmentId);
      setContract(data);
    } catch {
      setContract(null);
    }
  }, [organizationId, apartmentId]);

  const loadPayments = useCallback(async () => {
    try {
      const data = await getApartmentPayments(organizationId, apartmentId);
      setPayments(data);
    } catch {
      setPayments([]);
    }
  }, [organizationId, apartmentId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadContract(), loadPayments()]);
    setLoading(false);
  }, [loadContract, loadPayments]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleGeneratePayments = async () => {
    try {
      await generateApartmentPaymentPlan(organizationId, apartmentId);
      message.success('付款计划已生成');
      loadPayments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    }
  };

  const handleEditContract = () => {
    if (!contract) return;
    contractForm.setFieldsValue({
      contractNo: contract.contractNo,
      signDate: contract.signDate ? dayjs(contract.signDate) : undefined,
      startDate: contract.startDate ? dayjs(contract.startDate) : undefined,
      endDate: contract.endDate ? dayjs(contract.endDate) : undefined,
      rentAmount: contract.rentAmount ? Number(contract.rentAmount) : undefined,
      depositAmount: contract.depositAmount
        ? Number(contract.depositAmount)
        : undefined,
      paymentMethod: contract.paymentMethod,
      escalationType: contract.escalationType || 'NONE',
      escalationValue: contract.escalationValue
        ? Number(contract.escalationValue)
        : undefined,
      escalationCycle: contract.escalationCycle,
      freeRentDays: contract.freeRentDays,
      freeRentStart: contract.freeRentStart
        ? dayjs(contract.freeRentStart)
        : undefined,
      freeRentEnd: contract.freeRentEnd
        ? dayjs(contract.freeRentEnd)
        : undefined,
      attachmentUrl: contract.attachmentUrl,
      note: contract.note,
    });
    setContractModalOpen(true);
  };

  const handleContractSubmit = async (values: Record<string, unknown>) => {
    setContractSubmitting(true);
    try {
      const payload = {
        contractNo: values.contractNo as string | undefined,
        startDate: (values.startDate as dayjs.Dayjs)?.toISOString(),
        endDate: (values.endDate as dayjs.Dayjs)?.toISOString(),
        rentAmount: Number(values.rentAmount || 0),
        depositAmount: values.depositAmount
          ? Number(values.depositAmount)
          : undefined,
        paymentMethod: String(values.paymentMethod || 'MONTHLY'),
        escalationType:
          values.escalationType === 'NONE'
            ? undefined
            : (values.escalationType as string | undefined),
        escalationValue: values.escalationValue
          ? Number(values.escalationValue)
          : undefined,
        escalationCycle: values.escalationCycle
          ? Number(values.escalationCycle)
          : undefined,
        freeRentDays: values.freeRentDays
          ? Number(values.freeRentDays)
          : undefined,
        freeRentStart: values.freeRentStart
          ? (values.freeRentStart as dayjs.Dayjs).toISOString()
          : undefined,
        freeRentEnd: values.freeRentEnd
          ? (values.freeRentEnd as dayjs.Dayjs).toISOString()
          : undefined,
        signDate: values.signDate
          ? (values.signDate as dayjs.Dayjs).toISOString()
          : undefined,
        attachmentUrl: values.attachmentUrl as string | undefined,
        note: values.note as string | undefined,
      };
      await updateApartmentContract(organizationId, apartmentId, payload);
      message.success('合同信息已更新');
      setContractModalOpen(false);
      loadContract();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleRecordPay = (payment: LandlordPayment) => {
    setCurrentPayment(payment);
    payForm.setFieldsValue({
      paidAmount: Number(payment.plannedAmount),
      paidAt: dayjs(),
    });
    setPayModalOpen(true);
  };

  const handlePaySubmit = async (values: Record<string, unknown>) => {
    if (!currentPayment) return;
    setPayLoading(true);
    try {
      await recordApartmentPayment(
        organizationId,
        apartmentId,
        currentPayment.id,
        {
          paidAmount: Number(values.paidAmount),
          paidAt: (values.paidAt as dayjs.Dayjs).toISOString(),
          voucherNo: values.voucherNo as string | undefined,
          paymentMethod: values.paymentMethod as string | undefined,
          note: values.note as string | undefined,
          createExpense: values.createExpense as boolean | undefined,
        }
      );
      message.success('付款已记录');
      setPayModalOpen(false);
      payForm.resetFields();
      loadPayments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '记录失败');
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deleteApartmentPayment(organizationId, apartmentId, paymentId);
      message.success('付款计划已删除');
      loadPayments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!contract) {
    return (
      <Empty description="暂无合同信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }

  const statusColors: Record<string, string> = {
    PENDING: 'default',
    PAID: 'success',
    OVERDUE: 'error',
  };

  const statusLabels: Record<string, string> = {
    PENDING: '待付',
    PAID: '已付',
    OVERDUE: '逾期',
  };

  return (
    <div>
      {/* 合同详情卡片 */}
      <Card
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            合同详情
          </span>
        }
        extra={
          canManage && (
            <Button icon={<EditOutlined />} onClick={handleEditContract}>
              编辑合同
            </Button>
          )
        }
        style={{ marginBottom: 24 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
          }}
        >
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>合同编号</div>
            <div>{contract.contractNo || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>签约日期</div>
            <div>{contract.signDate ? day(contract.signDate) : '-'}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>付款方式</div>
            <div>
              {paymentMethodLabels[contract.paymentMethod] ||
                contract.paymentMethod}
            </div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>合同期</div>
            <div>
              {day(contract.startDate)} ~ {day(contract.endDate)}
            </div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>月租金</div>
            <div>¥{money(contract.rentAmount)}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>押金</div>
            <div>¥{money(contract.depositAmount)}</div>
          </div>
          {contract.escalationType && contract.escalationType !== 'NONE' && (
            <>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>递增类型</div>
                <div>
                  {contract.escalationType === 'FIXED_AMOUNT'
                    ? '固定金额'
                    : '百分比'}
                </div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>递增数值</div>
                <div>{contract.escalationValue}</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>递增周期</div>
                <div>{contract.escalationCycle} 个月</div>
              </div>
            </>
          )}
          {contract.freeRentDays > 0 && (
            <>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>免租期</div>
                <div>{contract.freeRentDays} 天</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>免租起止</div>
                <div>
                  {contract.freeRentStart ? day(contract.freeRentStart) : '-'} ~{' '}
                  {contract.freeRentEnd ? day(contract.freeRentEnd) : '-'}
                </div>
              </div>
            </>
          )}
          {contract.note && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#888', fontSize: 12 }}>备注</div>
              <div>{contract.note}</div>
            </div>
          )}
        </div>
      </Card>

      {/* 付款计划 */}
      <Card
        title={
          <span>
            <DollarOutlined style={{ marginRight: 8 }} />
            付款计划
          </span>
        }
        extra={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleGeneratePayments}
            >
              生成付款计划
            </Button>
          )
        }
      >
        <Table
          dataSource={payments}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: '周期',
              render: (_, record: LandlordPayment) =>
                `${day(record.periodStart)} ~ ${day(record.periodEnd)}`,
            },
            {
              title: '应付日期',
              dataIndex: 'dueDate',
              render: (v: string) => day(v),
            },
            {
              title: '应付金额',
              dataIndex: 'plannedAmount',
              render: (v: string | number) => `¥${money(v)}`,
            },
            {
              title: '实付金额',
              dataIndex: 'paidAmount',
              render: (v?: string | number) => (v ? `¥${money(v)}` : '-'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) => (
                <Tag color={statusColors[v] || 'default'}>
                  {statusLabels[v] || v}
                </Tag>
              ),
            },
            {
              title: '凭证号',
              dataIndex: 'voucherNo',
              render: (v?: string) => v || '-',
            },
            {
              title: '操作',
              render: (_, record: LandlordPayment) => (
                <span>
                  {record.status === 'PENDING' && canManage && (
                    <>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleRecordPay(record)}
                      >
                        付款
                      </Button>
                      <Popconfirm
                        title="删除付款计划"
                        description="确认删除该付款计划？"
                        onConfirm={() => handleDeletePayment(record.id)}
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑合同弹窗 */}
      <Modal
        title="编辑合同信息"
        open={contractModalOpen}
        onCancel={() => setContractModalOpen(false)}
        onOk={() => contractForm.submit()}
        confirmLoading={contractSubmitting}
        width={720}
      >
        <Form
          form={contractForm}
          layout="vertical"
          onFinish={handleContractSubmit}
        >
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <Form.Item label="合同编号" name="contractNo">
              <Input placeholder="例如 HT-2024-001" />
            </Form.Item>
            <Form.Item label="签约日期" name="signDate">
              <DatePicker className="w-full" placeholder="选择签约日期" />
            </Form.Item>
            <Form.Item
              label="开始日期"
              name="startDate"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker className="w-full" placeholder="选择开始日期" />
            </Form.Item>
            <Form.Item
              label="结束日期"
              name="endDate"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker className="w-full" placeholder="选择结束日期" />
            </Form.Item>
            <Form.Item
              label="月租金"
              name="rentAmount"
              rules={[{ required: true, message: '请输入月租金' }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="元/月"
              />
            </Form.Item>
            <Form.Item label="押金" name="depositAmount">
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="元"
              />
            </Form.Item>
            <Form.Item
              label="付款方式"
              name="paymentMethod"
              rules={[{ required: true, message: '请选择付款方式' }]}
            >
              <Select
                placeholder="请选择付款方式"
                options={paymentMethodOptions}
              />
            </Form.Item>
            <Form.Item label="递增类型" name="escalationType">
              <Select
                placeholder="请选择递增类型"
                options={escalationTypeOptions}
                allowClear
              />
            </Form.Item>
            <Form.Item label="递增数值" name="escalationValue">
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="金额或百分比"
              />
            </Form.Item>
            <Form.Item label="递增周期（月）" name="escalationCycle">
              <InputNumber min={1} className="w-full" placeholder="例如 12" />
            </Form.Item>
            <Form.Item label="免租天数" name="freeRentDays">
              <InputNumber min={0} className="w-full" placeholder="天" />
            </Form.Item>
            <Form.Item label="免租开始日期" name="freeRentStart">
              <DatePicker className="w-full" placeholder="选择日期" />
            </Form.Item>
            <Form.Item label="免租结束日期" name="freeRentEnd">
              <DatePicker className="w-full" placeholder="选择日期" />
            </Form.Item>
            <Form.Item label="附件链接" name="attachmentUrl">
              <Input placeholder="合同扫描件链接" />
            </Form.Item>
            <Form.Item label="备注" name="note">
              <Input placeholder="合同备注" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 记录付款弹窗 */}
      <Modal
        title="记录付款"
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false);
          payForm.resetFields();
        }}
        onOk={() => payForm.submit()}
        confirmLoading={payLoading}
      >
        <Form form={payForm} layout="vertical" onFinish={handlePaySubmit}>
          <Form.Item
            label="付款金额"
            name="paidAmount"
            rules={[{ required: true, message: '请输入付款金额' }]}
          >
            <InputNumber min={0} step={0.01} className="w-full" />
          </Form.Item>
          <Form.Item
            label="付款日期"
            name="paidAt"
            rules={[{ required: true, message: '请选择付款日期' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="凭证号" name="voucherNo">
            <Input placeholder="例如 银行流水号" />
          </Form.Item>
          <Form.Item label="付款方式" name="paymentMethod">
            <Select
              placeholder="请选择付款方式"
              options={[
                { label: '现金', value: 'CASH' },
                { label: '银行转账', value: 'BANK_TRANSFER' },
                { label: '微信', value: 'WECHAT' },
                { label: '支付宝', value: 'ALIPAY' },
              ]}
              allowClear
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input placeholder="备注" />
          </Form.Item>
          <Form.Item name="createExpense" valuePropName="checked">
            <input type="checkbox" /> 同时创建运营支出记录
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
