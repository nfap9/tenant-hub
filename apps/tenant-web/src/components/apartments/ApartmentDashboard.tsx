// PAGE-106: 公寓可视化看板
import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  getApartmentDashboard,
  getApartmentOccupancyTrend,
  getApartmentRentDistribution,
} from '@/api/apartments';
import { money } from '@/utils/format';

interface ApartmentDashboardProps {
  apartmentId: string;
  currentOrgId: string;
}

export default function ApartmentDashboard({
  apartmentId,
  currentOrgId,
}: ApartmentDashboardProps) {
  const [dashboard, setDashboard] = useState<{
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    maintenanceRooms: number;
    occupancyRate: string;
    currentMonth: {
      receivable: number;
      received: number;
      overdue: number;
    };
  } | null>(null);
  const [occupancyTrend, setOccupancyTrend] = useState<
    { month: string; occupancyRate: number }[]
  >([]);
  const [rentDistribution, setRentDistribution] = useState<
    { range: string; count: number }[]
  >([]);

  const loadDashboard = useCallback(async () => {
    try {
      const [dash, trend, dist] = await Promise.all([
        getApartmentDashboard(currentOrgId, apartmentId),
        getApartmentOccupancyTrend(currentOrgId, apartmentId),
        getApartmentRentDistribution(currentOrgId, apartmentId),
      ]);
      setDashboard(dash);
      setOccupancyTrend(trend);
      setRentDistribution(dist);
    } catch (e) {
      console.error('看板数据加载失败', e);
    }
  }, [currentOrgId, apartmentId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div>
      {dashboard && (
        <>
          <Row gutter={16} className="mb-16">
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="总房间"
                  value={dashboard.totalRooms}
                  suffix="间"
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="已租"
                  value={dashboard.occupiedRooms}
                  suffix="间"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="空置"
                  value={dashboard.vacantRooms}
                  suffix="间"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="维修中"
                  value={dashboard.maintenanceRooms}
                  suffix="间"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={16} className="mb-16">
            <Col xs={12} sm={8}>
              <Card size="small">
                <Statistic
                  title="本月应收"
                  value={money(dashboard.currentMonth.receivable)}
                  prefix="¥"
                />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Statistic
                  title="本月已收"
                  value={money(dashboard.currentMonth.received)}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Statistic
                  title="本月逾期"
                  value={money(dashboard.currentMonth.overdue)}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card size="small" title="入住率趋势（最近12个月）" className="mb-16">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}%`, '入住率']}
                  />
                  <Line
                    type="monotone"
                    dataKey="occupancyRate"
                    stroke="#1890ff"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="租金单价分布" className="mb-16">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rentDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0} 间`, '房间数']}
                  />
                  <Bar dataKey="count" fill="#52c41a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
