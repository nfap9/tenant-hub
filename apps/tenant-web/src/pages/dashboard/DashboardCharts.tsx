import { Card, Row, Col } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import type { Room } from '@/types/domain';
import { money } from '@/utils/format';
import styles from './index.module.scss';

interface Props {
  occupancyTrend: { month: string; occupancyRate: number }[];
  incomeExpenseTrend: { month: string; income: number; expense: number }[];
  rooms: Room[];
}

const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

export default function DashboardCharts({
  occupancyTrend,
  incomeExpenseTrend,
  rooms,
}: Props) {
  // 租金单价分布
  const rentDistribution = (() => {
    const ranges: Record<string, number> = {
      '800以下': 0,
      '800-1000': 0,
      '1000-1500': 0,
      '1500-2000': 0,
      '2000+': 0,
    };
    rooms.forEach((room) => {
      const lease = room.leases?.find((l) => l.status === 'ACTIVE');
      if (!lease) return;
      const rent = Number(lease.rentAmount);
      if (rent < 800) ranges['800以下']++;
      else if (rent < 1000) ranges['800-1000']++;
      else if (rent < 1500) ranges['1000-1500']++;
      else if (rent < 2000) ranges['1500-2000']++;
      else ranges['2000+']++;
    });
    return Object.entries(ranges)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  })();

  const formatMonth = (m: string) => {
    const [, month] = m.split('-');
    return `${Number(month)}月`;
  };

  return (
    <Row gutter={[16, 16]} className={styles.statGrid}>
      {/* 入住率趋势 */}
      <Col xs={24} lg={12}>
        <Card
          title={<span className={styles.dashboardCardTitle}>入住率趋势</span>}
        >
          <div style={{ height: 260 }}>
            {occupancyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, '入住率']}
                    labelFormatter={(label) => formatMonth(String(label))}
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
      </Col>

      {/* 租金单价分布 */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <span className={styles.dashboardCardTitle}>租金单价分布</span>
          }
        >
          <div style={{ height: 260 }}>
            {rentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rentDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}间`, name]} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
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
      </Col>

      {/* 收支对比 */}
      <Col xs={24}>
        <Card
          title={<span className={styles.dashboardCardTitle}>收支对比</span>}
        >
          <div style={{ height: 260 }}>
            {incomeExpenseTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpenseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    tickFormatter={(v) => `¥${money(Number(v))}`}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `¥${money(Number(value))}`,
                      name === 'income' ? '收入' : '支出',
                    ]}
                    labelFormatter={(label) => formatMonth(String(label))}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'income' ? '收入' : '支出'
                    }
                  />
                  <Bar dataKey="income" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
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
      </Col>
    </Row>
  );
}
