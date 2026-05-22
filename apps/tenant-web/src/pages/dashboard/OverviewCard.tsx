import { compactMoney } from '@/utils/format';
import { Card, Col, Row } from 'antd';
import './OverviewCard.scss';

interface Props {
  monthlyIncome: number;
  paidThisMonth: number;
  unpaidTotal: number;
  thisMonthExpense: number;
}
export default function Overview({
  monthlyIncome,
  paidThisMonth,
  unpaidTotal,
  thisMonthExpense,
}: Props) {
  return (
    <Card
      className="overview-card"
      bodyStyle={{ padding: 'var(--th-space-6)' }}
    >
      <div className="overview-label">本月经营概览</div>
      <div className="overview-total">¥{compactMoney(monthlyIncome)}</div>
      <Row gutter={16}>
        <Col span={8}>
          <div className="overview-stat-label">已收</div>
          <div className="overview-stat-value">
            ¥{compactMoney(paidThisMonth)}
          </div>
        </Col>
        <Col span={8}>
          <div className="overview-stat-label">待收</div>
          <div className="overview-stat-value">
            ¥{compactMoney(unpaidTotal)}
          </div>
        </Col>
        <Col span={8}>
          <div className="overview-stat-label">支出</div>
          <div className="overview-stat-value">
            ¥{compactMoney(thisMonthExpense)}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
