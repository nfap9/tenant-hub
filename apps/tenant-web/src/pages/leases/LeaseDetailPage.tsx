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
  Tabs,
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
import type {
  Lease,
  LeaseStatus,
  BillItem,
  MeterReading,
} from '@/types/domain';
import { money, day } from '@/utils/format';
import { cycleLabels } from '@/pages/rooms/constants';
import {
  billItemTypeText,
  billingMethodText,
  toneForBillBillingMethod,
  statusLabels as billStatusLabels,
  toneForBillStatus,
} from '@/pages/bills/constants';
import { groupBills, type BillGroup } from '@/pages/bills/utils';

type ReadingGroup = {
  id: string;
  readingDate: string;
  waterReading?: MeterReading;
  powerReading?: MeterReading;
  note?: string;
};

const groupReadingsByDate = (
  readings: MeterReading[] | undefined
): ReadingGroup[] => {
  const map = new Map<string, ReadingGroup>();
  for (const reading of readings ?? []) {
    const date = day(reading.readingDate);
    const key = date;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        readingDate: reading.readingDate,
        note: reading.note,
      });
    }
    const group = map.get(key)!;
    if (reading.meterType === 'WATER') {
      group.waterReading = reading;
    } else {
      group.powerReading = reading;
    }
    if (reading.note && !group.note) {
      group.note = reading.note;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime()
  );
};

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

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();

  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'bills' | 'readings'>(
    'detail'
  );

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

  const groupedReadings = useMemo(
    () => groupReadingsByDate(lease?.meterReadings),
    [lease?.meterReadings]
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
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      <Spin spinning={loading}>
        {lease && (
          <Tabs
            activeKey={activeTab}
            onChange={(key) =>
              setActiveTab(key as 'detail' | 'bills' | 'readings')
            }
            items={[
              {
                key: 'detail',
                label: '租约详情',
                children: (
                  <>
                    <DetailSection
                      title={
                        <>
                          <UserOutlined className="text-primary" /> 租客与房间
                        </>
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
                            {cycleLabels[lease.rentCycle]}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="月租金">
                            ¥{money(lease.rentAmount)}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="房间押金">
                            ¥{money(roomDeposit?.amount ?? lease.depositAmount)}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="钥匙押金">
                            ¥
                            {money(
                              keyDeposit?.amount ?? lease.keyDepositAmount
                            )}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="水费单价">
                            ¥{money(lease.waterUnitPrice ?? 0)}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="电费单价">
                            ¥{money(lease.powerUnitPrice ?? 0)}
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
                  </>
                ),
              },
              {
                key: 'bills',
                label: '账单记录',
                children:
                  groupedBills.length === 0 ? (
                    <EmptyState
                      title="暂无账单记录"
                      description="当前租约还没有生成账单"
                    />
                  ) : (
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
                                    <span>
                                      {billItemTypeText(
                                        item.category,
                                        item.name
                                      )}
                                    </span>
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
                          title: '出账方式',
                          render: (_: unknown, row: BillGroup) => {
                            const method =
                              row.bills[0]?.billingMethod ?? 'AUTO';
                            return (
                              <Tag color={toneForBillBillingMethod(method)}>
                                {billingMethodText[method]}
                              </Tag>
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
                  ),
              },
              {
                key: 'readings',
                label: '水电抄表记录',
                children:
                  groupedReadings.length === 0 ? (
                    <EmptyState
                      title="暂无抄表记录"
                      description="当前租约还没有水电抄表记录"
                    />
                  ) : (
                    <Table<ReadingGroup>
                      rowKey="id"
                      dataSource={groupedReadings}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 'max-content' }}
                      columns={[
                        {
                          title: '读数日期',
                          width: 120,
                          render: (_: unknown, row: ReadingGroup) =>
                            day(row.readingDate),
                        },
                        {
                          title: '水表读数',
                          width: 120,
                          align: 'right' as const,
                          render: (_: unknown, row: ReadingGroup) => (
                            <Tag color="blue">
                              {row.waterReading?.value ?? '-'}
                            </Tag>
                          ),
                        },
                        {
                          title: '电表读数',
                          width: 120,
                          align: 'right' as const,
                          render: (_: unknown, row: ReadingGroup) => (
                            <Tag color="orange">
                              {row.powerReading?.value ?? '-'}
                            </Tag>
                          ),
                        },
                        {
                          title: '备注',
                          ellipsis: true,
                          render: (_: unknown, row: ReadingGroup) =>
                            row.note || '-',
                        },
                      ]}
                    />
                  ),
              },
            ]}
          />
        )}
      </Spin>
    </div>
  );
}
