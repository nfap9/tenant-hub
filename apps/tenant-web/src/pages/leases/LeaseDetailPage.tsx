import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Divider,
  Row,
  Col,
  Table,
  Space,
} from 'antd';
import {
  FileTextOutlined,
  HomeOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getLease } from '@/api/leases';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import type { Lease, LeaseStatus, BillItem } from '@/types/domain';
import { money, day } from '@/utils/format';
import { cycleLabels, terminationLabels } from '@/pages/rooms/constants';
import {
  billItemTypeText,
  statusLabels as billStatusLabels,
  toneForBillStatus,
} from '@/pages/bills/constants';
import { groupBills, type BillGroup } from '@/pages/bills/utils';

const statusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效中',
  TERMINATED: '已终止',
  EXPIRED: '已到期',
};

const statusColors: Record<LeaseStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  TERMINATED: 'warning',
  EXPIRED: 'error',
};

const billModeLabels: Record<string, string> = {
  PREPAID: '周期账单',
  POSTPAID: '水电账单',
  DEPOSIT: '押金账单',
};

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();

  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getLease(currentOrgId, id);
      setLease(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载租约详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roomDeposit = useMemo(
    () => lease?.deposits?.find((d) => d.type === 'ROOM'),
    [lease?.deposits]
  );
  const keyDeposit = useMemo(
    () => lease?.deposits?.find((d) => d.type === 'KEY'),
    [lease?.deposits]
  );

  const groupedBills = useMemo(
    () => groupBills(lease?.bills ?? []),
    [lease?.bills]
  );

  if (!lease && !loading) {
    return (
      <div className="page-content">
        <PageHeader
          back="/leases"
          breadcrumb={[
            { label: '租务管理', path: '/leases' },
            { label: '租约详情' },
          ]}
        />
        <EmptyState
          title="租约不存在"
          action={{
            label: '返回租约列表',
            onClick: () => navigate('/leases'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back="/leases"
        breadcrumb={[
          { label: '租务管理', path: '/leases' },
          {
            label: lease?.tenantName
              ? `${lease.tenantName} 的租约`
              : '租约详情',
          },
        ]}
      />

      <Spin spinning={loading}>
        {lease && (
          <>
            <DetailSection
              title={
                <>
                  <UserOutlined className="text-primary" /> 租客与房间
                </>
              }
              actions={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadData}
                  loading={loading}
                >
                  刷新
                </Button>
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="租客姓名">
                    {lease.tenantName || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="手机号">
                    {lease.tenantPhone || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={statusColors[lease.status]}>
                      {statusLabels[lease.status]}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="房间号">
                    <Link to={`/rooms/${lease.roomId}`}>
                      {lease.room?.roomNo ?? '-'}
                    </Link>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="所属公寓">
                    {lease.room?.apartment?.name ?? '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="租约编号">{lease.id}</DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />

            <DetailSection
              title={
                <>
                  <FileTextOutlined className="text-primary" /> 租约信息
                </>
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="租期">
                    {day(lease.startDate)} ~ {day(lease.endDate)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="付款周期">
                    {cycleLabels[lease.cycle]}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="自动续约">
                    {lease.autoRenew ? '是' : '否'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="月租金">
                    ¥{money(lease.rentAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="房间押金">
                    ¥{money(roomDeposit?.amount ?? lease.roomDepositAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="钥匙押金">
                    ¥{money(keyDeposit?.amount ?? 0)}（{lease.keyQuantity} 套）
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="水费单价">
                    ¥{money(lease.waterUnitPrice)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="电费单价">
                    ¥{money(lease.powerUnitPrice)}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            {lease.fees && lease.fees.length > 0 && (
              <>
                <Divider />
                <DetailSection
                  title={
                    <>
                      <HomeOutlined className="text-primary" /> 附加费用
                    </>
                  }
                >
                  <Row gutter={[24, 0]}>
                    {lease.fees.map((fee) => (
                      <Col span={8} key={fee.id}>
                        <DetailItem label={fee.name}>
                          ¥{money(fee.amount)}
                        </DetailItem>
                      </Col>
                    ))}
                  </Row>
                </DetailSection>
              </>
            )}

            {groupedBills.length > 0 && (
              <>
                <Divider />
                <DetailSection title="账单记录">
                  <Table<BillGroup>
                    rowKey="id"
                    dataSource={groupedBills}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                    expandable={{
                      expandedRowRender: (row: BillGroup) => {
                        const itemRows = row.bills.flatMap((bill) =>
                          (bill.items ?? []).map((item) => ({ item, bill }))
                        );
                        return (
                          <Table<{
                            item: BillItem;
                            bill: BillGroup['bills'][0];
                          }>
                            rowKey={(record) =>
                              `${record.bill.id}_${record.item.id}`
                            }
                            dataSource={itemRows}
                            pagination={false}
                            size="small"
                            columns={[
                              {
                                title: '费用项目类型',
                                render: (_: unknown, { item }) => (
                                  <span>{billItemTypeText(item.type)}</span>
                                ),
                              },
                              {
                                title: '账期',
                                render: (_: unknown, { item }) => (
                                  <span>
                                    {day(item.periodStart)} ~{' '}
                                    {day(item.periodEnd)}
                                  </span>
                                ),
                              },
                              {
                                title: '金额',
                                render: (_: unknown, { item }) => (
                                  <span>¥{money(item.amount)}</span>
                                ),
                              },
                            ]}
                          />
                        );
                      },
                    }}
                    columns={[
                      {
                        title: '出账日期',
                        render: (_: unknown, row: BillGroup) => (
                          <span>{day(row.billingDate)}</span>
                        ),
                      },
                      {
                        title: '账单类型',
                        render: (_: unknown, row: BillGroup) => {
                          const modes = Array.from(
                            new Set(row.bills.map((bill) => bill.mode))
                          );
                          return (
                            <Space wrap>
                              {modes.map((mode) => (
                                <Tag key={mode}>
                                  {billModeLabels[mode] ?? mode}
                                </Tag>
                              ))}
                            </Space>
                          );
                        },
                      },
                      {
                        title: '到期时间',
                        render: (_: unknown, row: BillGroup) => (
                          <span>{day(row.dueDate)}</span>
                        ),
                      },
                      {
                        title: '金额',
                        render: (_: unknown, row: BillGroup) => (
                          <span>¥{money(row.totalAmount)}</span>
                        ),
                      },
                      {
                        title: '已付',
                        render: (_: unknown, row: BillGroup) => (
                          <span>¥{money(row.paidAmount)}</span>
                        ),
                      },
                      {
                        title: '状态',
                        render: (_: unknown, row: BillGroup) => (
                          <Tag color={toneForBillStatus(row.status)}>
                            {billStatusLabels[row.status]}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                </DetailSection>
              </>
            )}

            {lease.settlement && (
              <>
                <Divider />
                <DetailSection title="退租结算">
                  <Row gutter={[24, 0]}>
                    <Col span={8}>
                      <DetailItem label="退租类型">
                        {terminationLabels[lease.settlement.type]}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="退租日期">
                        {day(lease.settlement.terminatedAt)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="退租原因">
                        {lease.settlement.reason || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="水表读数">
                        {lease.settlement.previousWater} →{' '}
                        {lease.settlement.currentWater}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="电表读数">
                        {lease.settlement.previousPower} →{' '}
                        {lease.settlement.currentPower}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="水电费用">
                        ¥{money(lease.settlement.utilityAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租金调整">
                        ¥{money(lease.settlement.rentAdjustmentAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="其他费用">
                        ¥{money(lease.settlement.otherFeeAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="违约金">
                        ¥{money(lease.settlement.penaltyAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="赔偿金">
                        ¥{money(lease.settlement.compensationAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="房间押金退还">
                        ¥{money(lease.settlement.roomDepositRefundAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="钥匙押金退还">
                        ¥{money(lease.settlement.keyDepositRefundAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="房间押金扣款">
                        ¥{money(lease.settlement.roomDepositDeductionAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="钥匙押金扣款">
                        ¥{money(lease.settlement.keyDepositDeductionAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="押金扣款原因">
                        {lease.settlement.depositDeductionReason || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="应收金额">
                        <span className="text-error">
                          ¥{money(lease.settlement.receivableAmount)}
                        </span>
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="应退金额">
                        <span className="text-success">
                          ¥{money(lease.settlement.refundableAmount)}
                        </span>
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="净额">
                        <strong>¥{money(lease.settlement.netAmount)}</strong>
                      </DetailItem>
                    </Col>
                  </Row>

                  {lease.settlement.payments &&
                    lease.settlement.payments.length > 0 && (
                      <>
                        <Divider />
                        <Table
                          rowKey="id"
                          dataSource={lease.settlement.payments}
                          pagination={false}
                          columns={[
                            {
                              title: '方向',
                              dataIndex: 'direction',
                              render: (direction: string) =>
                                direction === 'RECEIVE' ? '收款' : '退款',
                            },
                            {
                              title: '金额',
                              dataIndex: 'amount',
                              render: (amount: number | string) => (
                                <span>¥{money(amount)}</span>
                              ),
                            },
                            {
                              title: '方式',
                              dataIndex: 'method',
                            },
                            {
                              title: '操作人',
                              dataIndex: ['user', 'username'],
                            },
                            {
                              title: '备注',
                              dataIndex: 'note',
                              render: (note?: string) => note || '-',
                            },
                          ]}
                        />
                      </>
                    )}
                </DetailSection>
              </>
            )}

            <Button
              style={{ marginTop: 24 }}
              onClick={() => navigate('/leases')}
            >
              返回列表
            </Button>
          </>
        )}
      </Spin>
    </div>
  );
}
