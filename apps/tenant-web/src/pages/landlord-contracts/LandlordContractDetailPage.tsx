// PAGE-117: 房东合同详情页面
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Row,
  Col,
  Popconfirm,
  Table,
  Divider,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DollarOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getLandlordContract,
  deleteLandlordContract,
} from '@/api/landlordContracts';
import type { LandlordContract } from '@/api/landlordContracts';
import {
  getLandlordPayments,
  generateLandlordPayments,
  type LandlordPayment,
} from '@/api/landlordPayments';
import { money, day } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';

const paymentMethodLabels: Record<string, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  HALF_YEARLY: '半年付',
  YEARLY: '年付',
};

const escalationTypeLabels: Record<string, string> = {
  NONE: '无递增',
  FIXED: '固定金额',
  PERCENTAGE: '百分比',
};

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待付款', color: 'orange' },
  PAID: { label: '已付款', color: 'green' },
  OVERDUE: { label: '已逾期', color: 'red' },
};

export default function LandlordContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');

  const [contract, setContract] = useState<LandlordContract | null>(null);
  const [payments, setPayments] = useState<LandlordPayment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getLandlordContract(currentOrgId, id);
      setContract(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载合同详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  const loadPayments = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setPaymentLoading(true);
    try {
      const data = await getLandlordPayments(currentOrgId, {
        contractId: id,
      });
      setPayments(data);
    } catch (e) {
      console.error('加载付款计划失败', e);
    } finally {
      setPaymentLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
    loadPayments();
  }, [loadData, loadPayments]);

  const handleDelete = async () => {
    if (!currentOrgId || !id) return;
    try {
      await deleteLandlordContract(currentOrgId, id);
      message.success('删除成功');
      navigate('/landlord-contracts');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleGenerate = async () => {
    if (!currentOrgId || !id) return;
    try {
      const result = await generateLandlordPayments(currentOrgId, id);
      message.success(`已生成 ${result.generated} 笔付款计划`);
      loadPayments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    }
  };

  if (!contract && !loading) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: '房东合同' }, { label: '详情' }]} />
        <div>合同不存在</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          {
            label: '房东合同',
            path: '/landlord-contracts',
          },
          { label: contract?.contractNo || '详情' },
        ]}
      />

      <Spin spinning={loading}>
        {contract && (
          <>
            <DetailSection
              title={
                <>
                  <FileTextOutlined /> 合同信息
                </>
              }
              actions={
                canManage && (
                  <>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() =>
                        navigate(`/landlord-contracts/${contract.id}/edit`)
                      }
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除？"
                      description="删除后不可恢复"
                      onConfirm={handleDelete}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                )
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="合同编号">
                    {contract.contractNo || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="所属公寓">
                    {contract.apartment?.name || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={contract.isActive ? 'success' : 'default'}>
                      {contract.isActive ? '生效中' : '已结束'}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="开始日期">
                    {day(contract.startDate)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="结束日期">
                    {day(contract.endDate)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="签约日期">
                    {contract.signDate ? day(contract.signDate) : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="月租金">
                    {money(contract.rentAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="押金">
                    {money(contract.depositAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="付款方式">
                    {paymentMethodLabels[contract.paymentMethod] ||
                      contract.paymentMethod}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="免租期">
                    {contract.freeRentDays > 0
                      ? `${contract.freeRentDays} 天`
                      : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="免租起止">
                    {contract.freeRentStart && contract.freeRentEnd
                      ? `${day(contract.freeRentStart)} ~ ${day(contract.freeRentEnd)}`
                      : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="递增类型">
                    {contract.escalationType
                      ? escalationTypeLabels[contract.escalationType]
                      : '-'}
                  </DetailItem>
                </Col>
                {contract.escalationType && (
                  <>
                    <Col span={8}>
                      <DetailItem label="递增数值">
                        {contract.escalationValue || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="递增周期">
                        {contract.escalationCycle
                          ? `${contract.escalationCycle} 个月`
                          : '-'}
                      </DetailItem>
                    </Col>
                  </>
                )}
                <Col span={8}>
                  <DetailItem label="附件">
                    {contract.attachmentUrl ? (
                      <a
                        href={contract.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看附件
                      </a>
                    ) : (
                      '-'
                    )}
                  </DetailItem>
                </Col>
                <Col span={24}>
                  <DetailItem label="备注">{contract.note || '-'}</DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />
            <DetailSection
              title={
                <>
                  <DollarOutlined /> 付款计划
                </>
              }
              actions={
                canManage && (
                  <>
                    <Button icon={<SyncOutlined />} onClick={handleGenerate}>
                      生成付款计划
                    </Button>
                    <Button
                      onClick={() =>
                        navigate(`/landlord-payments?contractId=${contract.id}`)
                      }
                    >
                      查看全部
                    </Button>
                  </>
                )
              }
            >
              <Spin spinning={paymentLoading}>
                {payments.length === 0 ? (
                  <div style={{ color: '#999', padding: '8px 0' }}>
                    暂无付款计划，点击上方按钮生成
                  </div>
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={payments}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '周期',
                        render: (_: unknown, r: LandlordPayment) =>
                          `${r.periodStart} ~ ${r.periodEnd}`,
                      },
                      {
                        title: '应付日期',
                        dataIndex: 'dueDate',
                      },
                      {
                        title: '应付金额',
                        render: (_: unknown, r: LandlordPayment) => (
                          <span style={{ fontWeight: 500 }}>
                            ¥{money(r.plannedAmount)}
                          </span>
                        ),
                      },
                      {
                        title: '实付金额',
                        render: (_: unknown, r: LandlordPayment) =>
                          r.paidAmount ? `¥${money(r.paidAmount)}` : '-',
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (v: string, r: LandlordPayment) => {
                          const isOverdue =
                            v === 'PENDING' && new Date(r.dueDate) < new Date();
                          return (
                            <Tag
                              color={isOverdue ? 'red' : statusMap[v]?.color}
                            >
                              {isOverdue ? '已逾期' : statusMap[v]?.label}
                            </Tag>
                          );
                        },
                      },
                    ]}
                  />
                )}
              </Spin>
            </DetailSection>
          </>
        )}
      </Spin>
    </div>
  );
}
