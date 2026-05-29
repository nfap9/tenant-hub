import { useState } from 'react';
import {
  Card,
  Tabs,
  DatePicker,
  Button,
  Table,
  Tag,
  message,
  Row,
  Col,
} from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getReceivablesReport,
  getIncomeExpenseReport,
  getCollectionRateReport,
  getOccupancyReport,
  getCollectionRateTrend,
  getOccupancyTrend,
} from '@/api/reports';
import PageHeader from '@/components/ui/PageHeader';
import { money } from '@/utils/format';
import dayjs from 'dayjs';

export default function ReportsPage() {
  const { currentOrgId } = useAppSession();
  const [activeTab, setActiveTab] = useState('receivables');
  const [loading, setLoading] = useState(false);
  const [receivablesData, setReceivablesData] = useState<{
    bills: unknown[];
    summary: unknown;
  } | null>(null);
  const [incomeExpenseData, setIncomeExpenseData] = useState<{
    income: { total: number; byCategory: Record<string, number> };
    expense: { total: number; byCategory: Record<string, number> };
    grossProfit: number;
  } | null>(null);
  const [collectionRateData, setCollectionRateData] = useState<{
    collectionRate: number;
    overdueTenants: unknown[];
  } | null>(null);
  const [occupancyData, setOccupancyData] = useState<{
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    overallOccupancyRate: number;
    byApartment: unknown[];
  } | null>(null);
  const [collectionRateTrend, setCollectionRateTrend] = useState<
    { month: string; collectionRate: number }[]
  >([]);
  const [occupancyTrend, setOccupancyTrend] = useState<
    { month: string; occupancyRate: number }[]
  >([]);
  const [reportDate, setReportDate] = useState(dayjs());

  const fetchReport = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const year = reportDate.year();
      const month = reportDate.month() + 1;
      switch (activeTab) {
        case 'receivables':
          setReceivablesData(await getReceivablesReport(currentOrgId));
          break;
        case 'income-expense':
          setIncomeExpenseData(
            await getIncomeExpenseReport(currentOrgId, year, month)
          );
          break;
        case 'collection-rate':
          setCollectionRateData(
            await getCollectionRateReport(currentOrgId, year, month)
          );
          setCollectionRateTrend(
            (await getCollectionRateTrend(currentOrgId)).months
          );
          break;
        case 'occupancy':
          setOccupancyData(await getOccupancyReport(currentOrgId));
          setOccupancyTrend((await getOccupancyTrend(currentOrgId)).months);
          break;
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '财务报表' }]} />
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <DatePicker.MonthPicker
          value={reportDate}
          onChange={(d) => d && setReportDate(d)}
          placeholder="选择月份"
        />
        <Button type="primary" onClick={fetchReport} loading={loading}>
          查询
        </Button>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="应收应付" key="receivables">
          {receivablesData && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 48 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      ¥
                      {money(
                        (receivablesData.summary as { totalReceivable: number })
                          .totalReceivable
                      )}
                    </div>
                    <div style={{ color: '#6B7280' }}>应收总额</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      ¥
                      {money(
                        (receivablesData.summary as { totalReceived: number })
                          .totalReceived
                      )}
                    </div>
                    <div style={{ color: '#6B7280' }}>已收总额</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#DC2626',
                      }}
                    >
                      ¥
                      {money(
                        (receivablesData.summary as { totalUnpaid: number })
                          .totalUnpaid
                      )}
                    </div>
                    <div style={{ color: '#6B7280' }}>未收总额</div>
                  </div>
                </div>
              </Card>
              <Table
                rowKey="id"
                dataSource={receivablesData.bills}
                pagination={{ pageSize: 20 }}
                columns={[
                  {
                    title: '租客',
                    dataIndex: ['lease', 'tenantName'],
                    key: 'tenant',
                  },
                  {
                    title: '房间',
                    dataIndex: ['lease', 'room', 'roomNo'],
                    key: 'room',
                  },
                  {
                    title: '金额',
                    dataIndex: 'totalAmount',
                    render: (v: number) => `¥${money(v)}`,
                  },
                  {
                    title: '已收',
                    dataIndex: 'paidAmount',
                    render: (v: number) => `¥${money(v)}`,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (v: string) => <Tag>{v}</Tag>,
                  },
                ]}
              />
            </>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab="收支报表" key="income-expense">
          {incomeExpenseData && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 48 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#22C55E',
                      }}
                    >
                      ¥{money(incomeExpenseData.income.total)}
                    </div>
                    <div style={{ color: '#6B7280' }}>收入</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#DC2626',
                      }}
                    >
                      ¥{money(incomeExpenseData.expense.total)}
                    </div>
                    <div style={{ color: '#6B7280' }}>支出</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      ¥{money(incomeExpenseData.grossProfit)}
                    </div>
                    <div style={{ color: '#6B7280' }}>毛利</div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab="收缴率分析" key="collection-rate">
          {collectionRateData && (
            <>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: '#2563EB',
                      }}
                    >
                      {collectionRateData.collectionRate}%
                    </div>
                    <div style={{ color: '#6B7280' }}>本月收缴率</div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>
                      ¥
                      {money(
                        (collectionRateData as { totalReceivable?: number })
                          .totalReceivable ?? 0
                      )}
                    </div>
                    <div style={{ color: '#6B7280' }}>本月应收</div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>
                      ¥
                      {money(
                        (collectionRateData as { totalReceived?: number })
                          .totalReceived ?? 0
                      )}
                    </div>
                    <div style={{ color: '#6B7280' }}>本月实收</div>
                  </Card>
                </Col>
              </Row>
              <Card title="收缴率趋势" style={{ marginBottom: 16 }}>
                <div style={{ height: 300 }}>
                  {collectionRateTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={collectionRateTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v: string) => {
                            const [, m] = v.split('-');
                            return `${Number(m)}月`;
                          }}
                          tick={{ fontSize: 12, fill: '#6B7280' }}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(v: number) => `${v}%`}
                          tick={{ fontSize: 12, fill: '#6B7280' }}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value}%`, '收缴率']}
                          labelFormatter={(label) => {
                            const [, m] = String(label).split('-');
                            return `${Number(m)}月`;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="collectionRate"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#10B981' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                      }}
                    >
                      暂无数据
                    </div>
                  )}
                </div>
              </Card>
              <Table
                rowKey="tenantName"
                dataSource={collectionRateData.overdueTenants}
                pagination={false}
                columns={[
                  { title: '租客', dataIndex: 'tenantName' },
                  { title: '房间', dataIndex: 'roomNo' },
                  { title: '公寓', dataIndex: 'apartmentName' },
                  {
                    title: '欠费金额',
                    dataIndex: 'amount',
                    render: (v: number) => `¥${money(v)}`,
                  },
                ]}
              />
            </>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab="入住率分析" key="occupancy">
          {occupancyData && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 48 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      {occupancyData.totalRooms}
                    </div>
                    <div style={{ color: '#6B7280' }}>总房间</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#22C55E',
                      }}
                    >
                      {occupancyData.occupiedRooms}
                    </div>
                    <div style={{ color: '#6B7280' }}>已租</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#DC2626',
                      }}
                    >
                      {occupancyData.vacantRooms}
                    </div>
                    <div style={{ color: '#6B7280' }}>空置</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      {occupancyData.overallOccupancyRate}%
                    </div>
                    <div style={{ color: '#6B7280' }}>入住率</div>
                  </div>
                </div>
              </Card>
              <Card title="入住率趋势" style={{ marginBottom: 16 }}>
                <div style={{ height: 300 }}>
                  {occupancyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={occupancyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v: string) => {
                            const [, m] = v.split('-');
                            return `${Number(m)}月`;
                          }}
                          tick={{ fontSize: 12, fill: '#6B7280' }}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(v: number) => `${v}%`}
                          tick={{ fontSize: 12, fill: '#6B7280' }}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value}%`, '入住率']}
                          labelFormatter={(label) => {
                            const [, m] = String(label).split('-');
                            return `${Number(m)}月`;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="occupancyRate"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#3B82F6' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                      }}
                    >
                      暂无数据
                    </div>
                  )}
                </div>
              </Card>
              <Table
                rowKey="apartmentId"
                dataSource={occupancyData.byApartment}
                pagination={false}
                columns={[
                  { title: '公寓', dataIndex: 'apartmentName' },
                  { title: '总房间', dataIndex: 'totalRooms' },
                  { title: '已租', dataIndex: 'occupiedRooms' },
                  {
                    title: '入住率',
                    dataIndex: 'occupancyRate',
                    render: (v: number) => `${v}%`,
                  },
                ]}
              />
            </>
          )}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
